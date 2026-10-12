"""Norms from setup are only ever added to user_barriers, never wiped
(api/routes/onboarding.py, _persist_barriers_to_supabase).

Making a new plan without answering the norms question used to delete every
norm the person had, including ones added in ResourceHub, and write "Prefer not
to share" in their place. Setup no longer asks about norms (Riipen Labs,
Groups 25 to 30), so that would have happened on every new plan.

Run from backend/:  python -m unittest tests.test_persist_barriers -v
"""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from api.routes import onboarding


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.action, self.payload = db, table, {}, "select", None

    def select(self, *_):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def upsert(self, row, on_conflict=None):
        self.action, self.payload = "upsert", row
        return self

    def insert(self, rows):
        self.action, self.payload = "insert", rows
        return self

    def delete(self):
        self.action = "delete"
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        match = [r for r in rows if all(r.get(k) == v for k, v in self.filters.items())]
        if self.action == "select":
            return SimpleNamespace(data=[dict(r) for r in match])
        if self.action == "delete":
            self.db.deleted.extend(dict(r) for r in match)
            self.db.tables[self.table] = [r for r in rows if r not in match]
            return SimpleNamespace(data=match)
        if self.action == "insert":
            for row in self.payload:
                self.db.next_id += 1
                rows.append({"id": f"b{self.db.next_id}", **row})
            return SimpleNamespace(data=self.payload)
        return SimpleNamespace(data=[self.payload])


class DB:
    def __init__(self, barriers=()):
        self.next_id, self.deleted = 0, []
        self.tables = {"user_barriers": [dict(b) for b in barriers]}

    def table(self, name):
        return Query(self, name)

    def types(self, user_id="u1"):
        return [r["barrier_type"] for r in self.tables["user_barriers"] if r["user_id"] == user_id]


HUB_NORM = {"id": "h1", "user_id": "u1", "barrier_type": "adhd", "barrier_category": "neurodivergence",
            "severity": 4, "verified_by": "org-1"}


def persist(db, types):
    with patch.object(onboarding, "get_supabase", lambda: db):
        onboarding._persist_barriers_to_supabase("u1", "a@example.com", types)


class PersistBarriersTests(unittest.TestCase):
    def test_no_answer_keeps_the_norms_they_already_have(self):
        db = DB([HUB_NORM])
        persist(db, ["Prefer not to share"])
        self.assertEqual(db.types(), ["adhd"])
        self.assertEqual(db.deleted, [])
        # Severity and the organisation's confirmation are untouched.
        self.assertEqual(db.tables["user_barriers"][0], HUB_NORM)

    def test_an_empty_list_deletes_nothing(self):
        db = DB([HUB_NORM])
        persist(db, [])
        self.assertEqual(db.types(), ["adhd"])
        self.assertEqual(db.deleted, [])

    def test_new_norms_are_added_beside_the_old_ones(self):
        db = DB([HUB_NORM])
        persist(db, ["Autism", "ADHD", "autism "])  # case, spacing and repeats ignored
        self.assertEqual(db.types(), ["adhd", "Autism"])
        self.assertEqual(db.deleted, [])

    def test_someone_with_no_norms_gets_the_no_answer_placeholder(self):
        db = DB()
        persist(db, ["Prefer not to share"])
        self.assertEqual(db.types(), ["Prefer not to share"])

    def test_the_placeholder_is_not_added_twice(self):
        db = DB([{"id": "p1", "user_id": "u1", "barrier_type": "Prefer not to share"}])
        persist(db, ["Prefer not to share"])
        self.assertEqual(db.types(), ["Prefer not to share"])

    def test_a_real_answer_replaces_only_the_placeholder(self):
        db = DB([{"id": "p1", "user_id": "u1", "barrier_type": "Prefer not to share"}, HUB_NORM])
        persist(db, ["Autism"])
        self.assertEqual(sorted(db.types()), ["Autism", "adhd"])
        self.assertEqual([r["barrier_type"] for r in db.deleted], ["Prefer not to share"])

    def test_other_people_are_never_touched(self):
        other = {"id": "o1", "user_id": "u2", "barrier_type": "Prefer not to share"}
        db = DB([other, {"id": "p1", "user_id": "u1", "barrier_type": "Prefer not to share"}])
        persist(db, ["Autism"])
        self.assertIn(other, db.tables["user_barriers"])

    def test_without_a_database_nothing_happens(self):
        with patch.object(onboarding, "get_supabase", lambda: None):
            onboarding._persist_barriers_to_supabase("u1", "a@example.com", ["Autism"])


if __name__ == "__main__":
    unittest.main()
