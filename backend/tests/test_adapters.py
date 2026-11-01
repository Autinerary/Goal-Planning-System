"""Shared starter models (api/routes/adapters.py): the checks before anything is public, and using one.

What must hold: nothing is shared unless the owner approved a scrubbed training set, their memory check passed and
their title and description name no one; the files are an adapter and a config with nothing from the owner's
computer; the public list never says who shared one; only the owner edits or takes one down; nobody rates their own;
reports go to the moderation queue; and it's all off unless SHARED_ADAPTERS=on.

Run from backend/:  python -m unittest tests.test_adapters -v
"""
import asyncio
import json
import os
import struct
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from api.routes import adapters
from core import scrubber

OWNER, OTHER = "owner-1", "other-1"
CONSENT = "c0000000-0000-4000-8000-000000000001"
BASE = "mlx-community/Llama-3.2-3B-Instruct-bf16"


def weights(header=None, metadata=None):
    header = header or {"model.layers.0.self_attn.q_proj.lora_a": {"dtype": "F32", "shape": [8, 8], "data_offsets": [0, 256]},
                        "model.layers.0.self_attn.q_proj.lora_b": {"dtype": "F32", "shape": [8, 8], "data_offsets": [256, 512]}}
    if metadata is not None:
        header = {"__metadata__": metadata, **header}
    raw = json.dumps(header).encode()
    return struct.pack("<Q", len(raw)) + raw + b"\0" * 512


CLEAN_CONFIG = {"fine_tune_type": "lora", "num_layers": 8, "lora_parameters": {"rank": 8, "scale": 20.0, "dropout": 0.05}, "model": BASE}


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.row = db, table, [], "select", None

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filters.append(lambda r, k=k, v=v: r.get(k) == v)
        return self

    def in_(self, k, values):
        self.filters.append(lambda r, k=k, values=values: r.get(k) in values)
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_):
        return self

    def insert(self, row):
        self.op, self.row = "insert", row
        return self

    def upsert(self, row, on_conflict=""):
        self.op, self.row, self.keys = "upsert", row, on_conflict.split(",")
        return self

    def update(self, row):
        self.op, self.row = "update", row
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        if self.table in self.db.missing:
            raise RuntimeError(f'relation "{self.table}" does not exist')
        rows = self.db.tables.setdefault(self.table, [])
        match = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            rows.append({"created_at": "2026-10-31T12:00:00+00:00", **self.row})
            return SimpleNamespace(data=[self.row])
        if self.op == "upsert":
            same = [r for r in rows if all(r.get(k) == self.row.get(k) for k in self.keys)]
            if same:
                same[0].update(self.row)
            else:
                rows.append(dict(self.row))
            return SimpleNamespace(data=[self.row])
        if self.op == "update":
            for r in match:
                r.update(self.row)
            return SimpleNamespace(data=match)
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in match]
            return SimpleNamespace(data=match)
        return SimpleNamespace(data=[dict(r) for r in match])


class FakeBucket:
    def __init__(self, db):
        self.db = db

    def create_signed_upload_url(self, path):
        return {"signed_url": f"https://storage/upload/{path}?token=t", "token": "t", "path": path}

    def list(self, folder):
        return [{"name": name.split("/", 1)[1], "metadata": {"size": len(data)}}
                for name, data in self.db.files.items() if name.startswith(f"{folder}/")]

    def create_signed_url(self, path, expires, options=None):
        return {"signedURL": f"https://storage/sign/{path}?expires={expires}" + (f"&download={options['download']}" if options else "")}

    def remove(self, paths):
        for p in paths:
            self.db.files.pop(p, None)
        return []


class FakeDB:
    def __init__(self, missing=()):
        self.missing = set(missing)
        self.files = {}
        self.tables = {"training_set_consents": [{"id": CONSENT, "user_id": OWNER, "created_at": "2026-10-31T10:00:00+00:00",
                                                  "item_count": 24, "scrubber_version": "2026-10-31.1+patterns"}],
                       "profiles": [{"id": OWNER, "display_name": "Priya Sharma", "username": "priya_s"}]}
        self.storage = SimpleNamespace(from_=lambda bucket: FakeBucket(self))

    def table(self, name):
        return FakeQuery(self, name)

    def fetch(self, url):
        path = url.split("/sign/", 1)[1].split("?", 1)[0]
        return self.files[path]


def body(**changes):
    data = {"title": "Calm first steps", "description": "Small steps for starting a job search, in plain words.",
            "tags": ["autism", "work"], "baseModel": BASE, "consentId": CONSENT,
            "memoryCheck": {"model": "my-model", "probes": 20, "skipped": 4, "failed": 0, "maxCloseness": 0.31}}
    data.update(changes)
    return adapters.AdapterIn(**data)


def run(fn, db, *args, flag="on", **kwargs):
    with patch.dict(os.environ, {"SHARED_ADAPTERS": flag}), patch.object(adapters, "get_supabase", return_value=db), \
         patch.object(adapters, "_first_bytes", side_effect=db.fetch), patch.object(scrubber, "_ner", return_value=None):
        return asyncio.run(fn(*args, **kwargs))


def share(db, **changes):
    """Check, create, upload the clean files, publish: the whole way, as the page does it."""
    made = run(adapters.create_adapter, db, body(**changes), user_id=OWNER)
    db.files[f"{made['id']}/adapters.safetensors"] = weights()
    db.files[f"{made['id']}/adapter_config.json"] = json.dumps(CLEAN_CONFIG).encode()
    return made, run(adapters.publish_adapter, db, made["id"], user_id=OWNER)


class CheckTests(unittest.TestCase):
    def test_all_three_pass_for_a_clean_adapter(self):
        out = run(adapters.check_adapter, FakeDB(), body(), user_id=OWNER)
        self.assertTrue(out["passed"], out)
        self.assertEqual(out["checks"]["scrub_review"]["itemCount"], 24)
        self.assertTrue(out["checks"]["memorization"]["selfReported"])

    def test_no_scrub_review_no_sharing(self):
        out = run(adapters.check_adapter, FakeDB(), body(consentId="c0000000-0000-4000-8000-000000000999"), user_id=OWNER)
        self.assertFalse(out["checks"]["scrub_review"]["passed"])
        # Someone else's approval doesn't count either.
        out = run(adapters.check_adapter, FakeDB(), body(), user_id=OTHER)
        self.assertFalse(out["passed"])

    def test_a_model_that_says_training_answers_back_isnt_shared(self):
        for memory in ({"model": "m", "probes": 20, "failed": 3, "maxCloseness": 1.0},
                       {"model": "m", "probes": 20, "failed": 0, "maxCloseness": 0.5},
                       {"model": "m", "probes": 2, "failed": 0, "maxCloseness": 0.1},
                       {"model": "m", "probes": 30, "failed": 0, "maxCloseness": 0.1}):    # more than the 24 approved
            out = run(adapters.check_adapter, FakeDB(), body(memoryCheck=memory), user_id=OWNER)
            self.assertFalse(out["checks"]["memorization"]["passed"], memory)

    def test_personal_information_in_the_title_or_description_blocks_it(self):
        # The owner's own name (from their profile) is the likeliest, even where nothing else would spot it.
        for title, description in (("Priya's planner", "Mine."), ("Calm steps", "From priya_s."),
                                   ("Calm steps", "Made with my friend Ama."), ("Calm steps", "Email me at sam@example.org"),
                                   ("Calm steps", "Made at Humber College, my school."),
                                   ("Calm steps", "My therapist Dr. Okafor helped."), ("Calm steps", "Call 416-555-0199")):
            out = run(adapters.check_adapter, FakeDB(), body(title=title, description=description), user_id=OWNER)
            self.assertFalse(out["checks"]["metadata"]["passed"], (title, description))
        # Saying which community it's for names no one.
        out = run(adapters.check_adapter, FakeDB(), body(description="For autistic adults with ADHD starting work."), user_id=OWNER)
        self.assertTrue(out["checks"]["metadata"]["passed"], out["checks"]["metadata"])

    def test_tags_and_base_models_from_the_lists_only(self):
        self.assertFalse(run(adapters.check_adapter, FakeDB(), body(tags=["my-school"]), user_id=OWNER)["passed"])
        self.assertFalse(run(adapters.check_adapter, FakeDB(), body(baseModel="meta-llama/Llama-3.1-70B"), user_id=OWNER)["passed"])


class FileTests(unittest.TestCase):
    def test_the_weights_must_be_a_lora_adapter_with_nothing_hidden(self):
        self.assertIsNone(adapters.weights_problem(weights()))
        self.assertIsNone(adapters.weights_problem(weights(metadata={"format": "mlx"})))
        raw = json.dumps({"__metadata__": None, "model.layers.0.mlp.up_proj.lora_a": {"dtype": "F32"}}).encode()
        self.assertIsNone(adapters.weights_problem(struct.pack("<Q", len(raw)) + raw), "as mlx writes it")
        self.assertIn("extra information", adapters.weights_problem(weights(metadata={"author": "Jordan Ellis"})))
        self.assertIn("not a whole model", adapters.weights_problem(weights(header={"model.layers.0.mlp.up_proj.weight": {"dtype": "F32"}})))
        self.assertIsNotNone(adapters.weights_problem(b"PK\x03\x04 a zip"))
        self.assertIsNotNone(adapters.weights_problem(b""))

    def test_the_config_has_only_the_four_settings_so_no_path_from_the_owners_computer(self):
        self.assertIsNone(adapters.config_problem(CLEAN_CONFIG, BASE))
        leaky = {**CLEAN_CONFIG, "data": "/Users/jordanellis/.autinerary-model/my-model/data"}
        self.assertIn("may only have", adapters.config_problem(leaky, BASE))
        self.assertIn("different base model", adapters.config_problem({**CLEAN_CONFIG, "model": "other"}, BASE))

    def test_publishing_checks_the_files_that_arrived(self):
        db = FakeDB()
        made = run(adapters.create_adapter, db, body(), user_id=OWNER)
        self.assertEqual([u["path"] for u in made["uploads"]], [f"{made['id']}/adapters.safetensors", f"{made['id']}/adapter_config.json"])
        self.assertNotIn(OWNER, json.dumps(made["uploads"]), "the owner's id is in no file's path")
        with self.assertRaises(HTTPException) as caught:
            run(adapters.publish_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 422)
        db.files[f"{made['id']}/adapters.safetensors"] = weights()
        db.files[f"{made['id']}/adapter_config.json"] = json.dumps({**CLEAN_CONFIG, "adapter_path": "/Users/jordan/x"}).encode()
        with self.assertRaises(HTTPException):
            run(adapters.publish_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual(db.tables["shared_adapters"][0]["moderation_status"], "pending")
        db.files[f"{made['id']}/adapter_config.json"] = json.dumps(CLEAN_CONFIG).encode()
        out = run(adapters.publish_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual(out["status"], "approved")


class UsingTests(unittest.TestCase):
    def test_the_public_list_never_says_who_shared_it(self):
        db = FakeDB()
        made, _ = share(db)
        listed = run(adapters.list_adapters, db, caller=None)["adapters"]
        self.assertEqual([a["id"] for a in listed], [made["id"]])
        self.assertNotIn(OWNER, json.dumps(listed))
        self.assertNotIn(CONSENT, json.dumps(listed))
        self.assertEqual(listed[0]["ollamaBase"], "llama3.2:3b")
        self.assertTrue(run(adapters.list_adapters, db, caller=OWNER)["adapters"][0]["mine"])

    def test_pending_ones_arent_listed_or_downloadable_by_others(self):
        db = FakeDB()
        made = run(adapters.create_adapter, db, body(), user_id=OWNER)
        self.assertEqual(run(adapters.list_adapters, db, caller=None)["adapters"], [])
        with self.assertRaises(HTTPException):
            run(adapters.download_adapter, db, made["id"], caller=OTHER)

    def test_download_links_with_friendly_names(self):
        db = FakeDB()
        made, _ = share(db)
        out = run(adapters.download_adapter, db, made["id"], caller=None)
        self.assertEqual([f["name"] for f in out["files"]], ["calm-first-steps.safetensors", "calm-first-steps.adapter_config.json"])
        self.assertTrue(all("expires=600" in f["url"] for f in out["files"]))

    def test_ratings_but_not_your_own(self):
        db = FakeDB()
        made, _ = share(db)
        out = run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=4), user_id=OTHER)
        self.assertEqual(out["rating"], {"average": 4.0, "count": 1})
        run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=2), user_id=OTHER)
        self.assertEqual(run(adapters.list_adapters, db, caller=OTHER)["adapters"][0]["rating"], {"average": 2.0, "count": 1})
        with self.assertRaises(HTTPException) as caught:
            run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=5), user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 403)

    def test_a_report_goes_to_the_moderation_queue(self):
        db = FakeDB()
        made, _ = share(db)
        run(adapters.report_adapter, db, made["id"], adapters.ReportIn(reason="It says a real name"), user_id=OTHER)
        self.assertEqual(db.tables["community_reports"], [{"reporter_id": OTHER, "target_type": "adapter",
                                                           "target_id": made["id"], "reason": "It says a real name"}])

    def test_only_the_owner_edits_or_takes_it_down_and_an_edit_is_checked(self):
        db = FakeDB()
        made, _ = share(db)
        with self.assertRaises(HTTPException):
            run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Taken over"), user_id=OTHER)
        with self.assertRaises(HTTPException) as caught:
            run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calm", description="Ask Priya Sharma"), user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 422)
        run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calmer first steps", tags=["adhd"]), user_id=OWNER)
        self.assertEqual(db.tables["shared_adapters"][0]["title"], "Calmer first steps")
        with self.assertRaises(HTTPException):
            run(adapters.delete_adapter, db, made["id"], user_id=OTHER)
        run(adapters.delete_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual((db.tables["shared_adapters"], db.files), ([], {}))


class SwitchTests(unittest.TestCase):
    def test_off_unless_switched_on(self):
        self.assertEqual(run(adapters.list_adapters, FakeDB(), caller=None, flag=""), {"enabled": False, "adapters": []})
        self.assertFalse(run(adapters.status, FakeDB(), flag="")["enabled"])
        with self.assertRaises(HTTPException) as caught:
            run(adapters.create_adapter, FakeDB(), body(), user_id=OWNER, flag="")
        self.assertEqual(caught.exception.status_code, 404)

    def test_without_step_96_nothing_is_half_made(self):
        db = FakeDB(missing=["shared_adapters"])
        with self.assertRaises(HTTPException) as caught:
            run(adapters.create_adapter, db, body(), user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
