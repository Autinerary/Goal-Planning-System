"""Building a training set (api/routes/training.py): a person's items, scrubbing them, and recording consent.

What must hold: only the caller's own writing is read; each answered question is its own item; the person's profile
name is always replaced; consent records ids, a count and the scrubber's version, never text, and only for the
caller's own items and the scrubber that runs now; and nothing prints the text.

Run from backend/:  python -m unittest tests.test_training -v
"""
import asyncio
import contextlib
import io
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from api.routes import training
from core import scrubber

U1, U2 = "u1", "u2"
R1 = "11111111-1111-4111-8111-111111111111"
R2 = "22222222-2222-4222-8222-222222222222"
R3 = "33333333-3333-4333-8333-333333333333"
N1 = "44444444-4444-4444-8444-444444444444"
N2 = "55555555-5555-4555-8555-555555555555"


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.row = db, table, {}, None

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filters[k] = v
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_):
        return self

    def insert(self, row):
        self.row = row
        return self

    def execute(self):
        if self.table in self.db.missing:
            raise RuntimeError(f'relation "{self.table}" does not exist')
        rows = self.db.tables.setdefault(self.table, [])
        if self.row is not None:
            saved = {**self.row, "id": f"c{len(rows) + 1}", "created_at": "2026-10-31T12:00:00+00:00"}
            rows.append(saved)
            return SimpleNamespace(data=[saved])
        return SimpleNamespace(data=[r for r in rows if all(r.get(k) == v for k, v in self.filters.items())])


class FakeDB:
    def __init__(self, missing=()):
        self.missing = set(missing)
        self.tables = {
            "reflections": [
                {"id": R1, "user_id": U1, "created_at": "2026-10-20T09:00:00+00:00", "context_type": "path",
                 "questions": [{"question": "What went well?", "answer": "I swam twice with my friend Priya."},
                               {"question": "What got in the way?", "answer": ""},
                               {"question": "What will you try next?", "answer": "Go before work at Loblaws."}],
                 "free_form_text": "I swam twice with my friend Priya.\nGo before work at Loblaws."},
                {"id": R2, "user_id": U1, "created_at": "2026-10-25T09:00:00+00:00", "context_type": "task",
                 "questions": [], "free_form_text": "Jordan Ellis here. Call me at 416-555-0199."},
                {"id": R3, "user_id": U2, "created_at": "2026-10-26T09:00:00+00:00", "context_type": "path",
                 "questions": [{"question": "What went well?", "answer": "Someone else's words."}], "free_form_text": ""},
            ],
            "future_notes": [
                {"id": N1, "user_id": U1, "created_at": "2026-10-28T09:00:00+00:00", "kind": "do_better",
                 "body": "Do it in two sittings; I'm autistic and got overwhelmed."},
                {"id": N2, "user_id": U2, "created_at": "2026-10-29T09:00:00+00:00", "kind": "note", "body": "Not yours."},
            ],
            "profiles": [{"id": U1, "display_name": "Jordan Ellis", "username": "jordan_e"}],
            "training_set_consents": [],
        }

    def table(self, name):
        return FakeQuery(self, name)


def call(fn, db, *args, user=U1):
    with patch.object(training, "get_supabase", return_value=db):
        return asyncio.run(fn(*args, user_id=user))


class ItemTests(unittest.TestCase):
    def test_each_answered_question_is_an_item_and_free_text_only_when_none_was_answered(self):
        items = training.load_items(FakeDB(), U1)
        self.assertEqual([(i["kind"], i["id"]) for i in items],
                         [("note", N1), ("reflection", f"{R2}:free"), ("reflection", f"{R1}:0"), ("reflection", f"{R1}:2")])
        by_id = {i["id"]: i for i in items}
        self.assertEqual((by_id[f"{R1}:0"]["prompt"], by_id[f"{R1}:0"]["label"]), ("What went well?", "Journal"))
        self.assertEqual(by_id[f"{R2}:free"]["prompt"], training.FREE_TEXT_PROMPT)
        self.assertEqual(by_id[f"{R2}:free"]["label"], "Reflection on a step")
        self.assertEqual(by_id[N1]["prompt"], training.NOTE_PROMPTS["do_better"][1])

    def test_only_the_callers_own_items(self):
        out = call(training.my_items, FakeDB())
        self.assertNotIn("Someone else's words.", str(out))
        self.assertNotIn("Not yours.", str(out))


class ScrubTests(unittest.TestCase):
    def test_chosen_items_before_and_after_and_another_persons_ids_are_skipped(self):
        body = training.ScrubIn(items=[{"kind": "reflection", "id": f"{R1}:0"}, {"kind": "reflection", "id": f"{R2}:free"},
                                       {"kind": "reflection", "id": f"{R3}:0"}])
        with patch.object(scrubber, "_ner", return_value=None):
            out = call(training.scrub_mine, FakeDB(), body)
        self.assertEqual(out["version"], f"{scrubber.SCRUBBER_VERSION}+patterns")
        self.assertEqual(out["missing"], 1)
        by_id = {i["id"]: i for i in out["items"]}
        self.assertEqual(set(by_id), {f"{R1}:0", f"{R2}:free"})
        self.assertEqual(by_id[f"{R1}:0"]["before"], "I swam twice with my friend Priya.")
        self.assertEqual(by_id[f"{R1}:0"]["after"], "I swam twice with my friend [NAME].")
        # The person's own name from their profile, every time.
        self.assertEqual(by_id[f"{R2}:free"]["after"], "[NAME] here. Call me at [PHONE].")
        self.assertEqual(by_id[f"{R2}:free"]["found"], {"name": 1, "phone": 1})

    def test_edited_text_is_scrubbed_again(self):
        body = training.ScrubIn(texts=["Actually it was Jordan and my sister Ama.", "fine"])
        with patch.object(scrubber, "_ner", return_value=None):
            out = call(training.scrub_mine, FakeDB(), body)
        self.assertEqual([t["after"] for t in out["texts"]], ["Actually it was [NAME] and my sister [NAME].", "fine"])

    def test_items_or_texts_not_both_or_neither(self):
        for body in (training.ScrubIn(), training.ScrubIn(items=[], texts=["x"])):
            with self.assertRaises(HTTPException) as caught:
                call(training.scrub_mine, FakeDB(), body)
            self.assertEqual(caught.exception.status_code, 422)

    def test_nothing_prints_the_text(self):
        printed = io.StringIO()
        body = training.ScrubIn(items=[{"kind": "reflection", "id": f"{R1}:0"}, {"kind": "note", "id": N1}])
        with contextlib.redirect_stdout(printed), contextlib.redirect_stderr(printed):
            call(training.scrub_mine, FakeDB(), body)
            call(training.my_items, FakeDB())
        for words in ("Priya", "swam", "overwhelmed", "Loblaws"):
            self.assertNotIn(words, printed.getvalue())


class ConsentTests(unittest.TestCase):
    def setUp(self):
        self.ner = patch.object(scrubber, "_ner", return_value=None)
        self.ner.start()
        self.version = f"{scrubber.SCRUBBER_VERSION}+patterns"

    def tearDown(self):
        self.ner.stop()

    def test_ids_a_count_and_the_version_never_text(self):
        db = FakeDB()
        body = training.ConsentIn(items=[{"kind": "reflection", "id": f"{R1}:0"}, {"kind": "note", "id": N1},
                                         {"kind": "note", "id": N1}], scrubberVersion=self.version)
        out = call(training.record_consent, db, body)
        self.assertEqual((out["saved"], out["itemCount"], out["scrubberVersion"]), (True, 2, self.version))
        row = db.tables["training_set_consents"][0]
        self.assertEqual(set(row), {"user_id", "item_refs", "item_count", "scrubber_version", "id", "created_at"})
        self.assertEqual(row["item_refs"], [{"kind": "reflection", "id": f"{R1}:0"}, {"kind": "note", "id": N1}])
        self.assertNotIn("swam", str(row))
        records = call(training.my_consents, db)["records"]
        self.assertEqual((len(records), records[0]["itemCount"]), (1, 2))

    def test_refused_for_another_scrubber_another_persons_items_or_a_made_up_id(self):
        cases = [
            (training.ConsentIn(items=[{"kind": "note", "id": N1}], scrubberVersion="2020-01-01+patterns"), 409),
            (training.ConsentIn(items=[{"kind": "note", "id": N2}], scrubberVersion=self.version), 422),
            (training.ConsentIn(items=[{"kind": "reflection", "id": f"{R3}:0"}], scrubberVersion=self.version), 422),
            (training.ConsentIn(items=[{"kind": "reflection", "id": R1 + "xx"}], scrubberVersion=self.version), 422),
        ]
        for body, status in cases:
            db = FakeDB()
            with self.assertRaises(HTTPException) as caught:
                call(training.record_consent, db, body)
            self.assertEqual(caught.exception.status_code, status, body)
            self.assertEqual(db.tables["training_set_consents"], [])

    def test_without_step_95_nothing_is_recorded_and_the_person_is_told(self):
        body = training.ConsentIn(items=[{"kind": "note", "id": N1}], scrubberVersion=self.version)
        with self.assertRaises(HTTPException) as caught:
            call(training.record_consent, FakeDB(missing=["training_set_consents"]), body)
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(call(training.my_consents, FakeDB(missing=["training_set_consents"])), {"records": [], "available": False})


if __name__ == "__main__":
    unittest.main()
