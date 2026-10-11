"""Saved plans keep other people apart, in plan_matches (STEP 68).

Run from backend/:  python -m unittest tests.test_plan_matches -v
"""
import copy
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from api.routes import onboarding
from core import similar_group as sg
from core.path_privacy import other_people, without_other_people

EXAMPLE = json.loads((Path(__file__).parent / "fixtures/plan_with_other_people.json").read_text())


class Table:
    def __init__(self, db, name):
        self.db, self.name, self.filters, self.write = db, name, [], None

    def select(self, *_):
        return self

    def eq(self, column, value):
        self.filters.append(lambda r: r.get(column) == value)
        return self

    def in_(self, column, values):
        values = set(values)
        self.filters.append(lambda r: r.get(column) in values)
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def update(self, row):
        self.write = ("update", row)
        return self

    def upsert(self, row, **_):
        self.write = ("upsert", row)
        return self

    def execute(self):
        if self.name in self.db.missing:
            raise RuntimeError(f'relation "public.{self.name}" does not exist')
        if self.write:
            kind, row = self.write
            if kind == "upsert":
                self.db.tables.setdefault(self.name, []).append(copy.deepcopy(row))
            return SimpleNamespace(data=[row])
        return SimpleNamespace(data=[r for r in self.db.tables.get(self.name, []) if all(f(r) for f in self.filters)])


class DB:
    def __init__(self, missing=()):
        self.tables, self.missing = {}, set(missing)

    def table(self, name):
        return Table(self, name)


class OtherPeopleTests(unittest.TestCase):
    def test_the_two_lists_come_out(self):
        found = other_people(EXAMPLE["stored"])
        result = next(r["result"] for r in EXAMPLE["stored"]["agentResponses"] if r.get("agentId") == "pattern_recognition")
        self.assertEqual(found["similar_users"], result["similar_users"])
        self.assertEqual(found["retrieved_user_ids"], [str(i) for i in result.get("retrieved_user_ids", [])])

    def test_none_when_there_are_none(self):
        self.assertIsNone(other_people(without_other_people(EXAMPLE["stored"])))
        for value in (None, [], "x", {"agentResponses": None}):
            self.assertIsNone(other_people(value))


class SavePathTests(unittest.TestCase):
    def save(self, db):
        with patch.object(onboarding, "get_supabase", lambda: db):
            onboarding._save_path("path_x", "00000000-0000-0000-0000-0000000000a1", copy.deepcopy(EXAMPLE["stored"]))
        onboarding.generated_paths.pop("path_x", None)
        return db.tables.get("user_paths", [])[-1]["payload"]

    def test_the_plan_is_saved_without_other_people_and_they_go_to_plan_matches(self):
        db = DB()
        stored = self.save(db)
        self.assertEqual(stored, without_other_people(EXAMPLE["stored"]))
        self.assertIsNone(other_people(stored))
        kept = db.tables["plan_matches"][0]
        self.assertEqual((kept["user_id"], kept["path_id"]), ("00000000-0000-0000-0000-0000000000a1", "path_x"))
        self.assertEqual(kept["similar_users"], other_people(EXAMPLE["stored"])["similar_users"])

    def test_before_step_68_the_plan_keeps_them(self):
        stored = self.save(DB(missing={"plan_matches"}))
        self.assertEqual(stored, EXAMPLE["stored"])


class GroupFromPlanMatchesTests(unittest.TestCase):
    def test_a_plan_saved_since_step_68_still_has_its_group(self):
        me = "00000000-0000-0000-0000-000000000099"
        members = [{"user_id": f"00000000-0000-0000-0000-00000000000{n}", "barriers": ["ADHD"]} for n in (1, 2, 3)]
        db = DB()
        db.tables = {
            "user_paths": [{"user_id": me, "path_id": "p1", "is_active": True, "updated_at": "2026-10-11",
                            "payload": {"agentResponses": [{"agentId": "pattern_recognition", "result": {"similar_users_count": 3}}]}}],
            "plan_matches": [{"user_id": me, "path_id": "p1", "similar_users": members}],
            "pattern_user_embeddings": [{"user_id": m["user_id"]} for m in members],
        }
        group = sg.current_group(db, me)
        self.assertEqual(group["members"], [m["user_id"] for m in members])
        self.assertEqual(group["size"], 3)


if __name__ == "__main__":
    unittest.main()
