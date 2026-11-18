"""The journal's history (GET /api/reflections/user/{id}) is only ever the person's own entries: none is [], and a
read that fails is a 503. It used to answer with three made-up entries, which the journal showed as their own
(bug audit, 17 November 2026, item 18).

Run from backend/:  python -m unittest tests.test_journal_history -v
"""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import auth_guard
from api.routes import reflections

USER = "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"


class Query:
    def __init__(self, rows, fail):
        self.rows, self.fail = rows, fail

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("connection reset")
        return SimpleNamespace(data=self.rows)


class DB:
    def __init__(self, rows=(), fail=False):
        self.rows, self.fail = list(rows), fail

    def table(self, _name):
        return Query(self.rows, self.fail)


def history(db, caller=USER):
    app = FastAPI()
    app.include_router(reflections.router, prefix="/api/reflections")
    app.dependency_overrides[auth_guard.current_user_id] = lambda: caller
    with patch.object(reflections, "get_supabase", lambda: db):
        return TestClient(app).get(f"/api/reflections/user/{USER}")


class HistoryTests(unittest.TestCase):
    def test_no_entries_is_an_empty_journal(self):
        response = history(DB())
        self.assertEqual((response.status_code, response.json()), (200, []))

    def test_their_own_entries(self):
        row = {"id": "r1", "created_at": "2026-11-17T10:00:00+00:00", "context_type": "path", "context_id": "p1",
               "sentiment_label": "neutral", "reward_signal": 0, "free_form_text": "A quiet day.",
               "questions": [{"question": "How was today?", "answer": "Fine."}], "reflection_response": {}}
        body = history(DB([row])).json()
        self.assertEqual([e["id"] for e in body], ["r1"])
        self.assertEqual(body[0]["summary"], "A quiet day.")

    def test_a_failed_read_is_a_503_not_an_empty_or_made_up_journal(self):
        response = history(DB(fail=True))
        self.assertEqual(response.status_code, 503)
        self.assertTrue(response.json()["detail"])

    def test_no_made_up_entries_anywhere(self):
        self.assertFalse(hasattr(reflections, "_DEMO_REFLECTIONS"))
        for db in (None, DB()):
            self.assertNotIn("seed_", history(db).text)

    def test_only_for_them(self):
        self.assertEqual(history(DB(), caller="someone-else").status_code, 404)


if __name__ == "__main__":
    unittest.main()
