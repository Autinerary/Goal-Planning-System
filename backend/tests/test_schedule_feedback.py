"""Schedule feedback (api/routes/schedule_feedback.py, STEP 72): "Did this
schedule work for you?", yes or no, once per generated schedule, behind a flag.

Run from backend/:  python -m unittest tests.test_schedule_feedback -v
"""
import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from api.routes import schedule_feedback as sf
from core.agents import calendar_optimization_agent as cal


def path(schedule_id=None, schedule=True):
    result = {"schedule": [{"dayName": "Monday", "tasks": []}] if schedule else []}
    if schedule_id:
        result["scheduleId"] = schedule_id
    return {"agentResponses": [{"agentId": "calendar_optimization", "result": result}]}


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.row = db, table, {}, None

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filters[k] = v
        return self

    def limit(self, *_):
        return self

    def insert(self, row):
        self.row = row
        return self

    def execute(self):
        if self.table == "user_paths":
            payload = self.db.paths.get((self.filters.get("user_id"), self.filters.get("path_id")))
            return SimpleNamespace(data=[{"payload": payload}] if payload else [])
        if self.db.missing_table:
            raise RuntimeError('relation "schedule_feedback" does not exist')
        if self.row is not None:
            key = (self.row["user_id"], self.row["schedule_id"])
            if any((r["user_id"], r["schedule_id"]) == key for r in self.db.rows):
                raise RuntimeError('duplicate key value violates unique constraint (23505)')
            self.db.rows.append(dict(self.row))
            return SimpleNamespace(data=[self.row])
        rows = [r for r in self.db.rows if all(r.get(k) == v for k, v in self.filters.items())]
        return SimpleNamespace(data=rows)


class FakeDB:
    def __init__(self, missing_table=False):
        self.rows, self.missing_table = [], missing_table
        self.paths = {("u1", "p1"): path("abc123"), ("u1", "old"): path(), ("u1", "none"): path(schedule=False)}

    def table(self, name):
        return FakeQuery(self, name)


def call(fn, db, *args, flag="true"):
    with patch.dict(os.environ, {"SCHEDULE_FEEDBACK_ENABLED": flag}), patch.object(sf, "get_supabase", return_value=db):
        return asyncio.run(fn(*args, user_id="u1"))


class ScheduleIdTests(unittest.TestCase):
    def test_the_schedule_id_or_the_path_for_older_schedules(self):
        self.assertEqual(sf.schedule_id(path("abc123"), "p1"), "abc123")
        self.assertEqual(sf.schedule_id(path(), "p9"), "path:p9")
        self.assertIsNone(sf.schedule_id(path(schedule=False), "p1"))
        self.assertIsNone(sf.schedule_id({}, "p1"))
        self.assertIsNone(sf.schedule_id("not json", "p1"))

    def test_every_generated_schedule_gets_its_own_id(self):
        def run():
            with patch.object(cal.llm, "is_enabled", return_value=False), \
                 patch.object(cal.learning, "get_user_calendar_preferences", AsyncMock(return_value=[])):
                agent = cal.CalendarOptimizationAgent()
                asyncio.run(agent.initialize())
                return asyncio.run(agent.optimize_calendar(user_profile={}, milestones=[], tasks=[]))
        first, second = run()["scheduleId"], run()["scheduleId"]
        self.assertTrue(first and second and first != second)


class RouteTests(unittest.TestCase):
    def test_off_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SCHEDULE_FEEDBACK_ENABLED", None)
            self.assertFalse(sf.enabled())
        for fn, args in ((sf.get_feedback, ("p1",)), (sf.give_feedback, (sf.FeedbackIn(pathId="p1", scheduleId="abc123", answer="yes"),))):
            with self.assertRaises(HTTPException) as e:
                call(fn, FakeDB(), *args, flag="")
            self.assertEqual(e.exception.status_code, 404)

    def test_asked_once_per_schedule(self):
        db = FakeDB()
        self.assertEqual(call(sf.get_feedback, db, "p1"), {"available": True, "scheduleId": "abc123", "answer": None})
        saved = call(sf.give_feedback, db, sf.FeedbackIn(pathId="p1", scheduleId="abc123", answer="no"))
        self.assertEqual(saved, {"saved": True, "alreadyAnswered": False, "answer": "no"})
        self.assertEqual(db.rows, [{"user_id": "u1", "path_id": "p1", "schedule_id": "abc123", "answer": "no"}])
        again = call(sf.give_feedback, db, sf.FeedbackIn(pathId="p1", scheduleId="abc123", answer="yes"))
        self.assertEqual(again, {"saved": False, "alreadyAnswered": True, "answer": "no"})
        self.assertEqual(len(db.rows), 1)
        self.assertEqual(call(sf.get_feedback, db, "p1")["answer"], "no")

    def test_older_schedules_are_named_by_their_path(self):
        db = FakeDB()
        self.assertEqual(call(sf.get_feedback, db, "old")["scheduleId"], "path:old")
        saved = call(sf.give_feedback, db, sf.FeedbackIn(pathId="old", scheduleId="path:old", answer="yes"))
        self.assertTrue(saved["saved"])

    def test_only_the_schedule_in_your_own_path(self):
        for body in (sf.FeedbackIn(pathId="p1", scheduleId="someone-elses", answer="yes"),
                     sf.FeedbackIn(pathId="not-mine", scheduleId="abc123", answer="yes")):
            with self.assertRaises(HTTPException) as e:
                call(sf.give_feedback, FakeDB(), body)
            self.assertEqual(e.exception.status_code, 404)

    def test_a_path_without_a_schedule_asks_nothing(self):
        self.assertEqual(call(sf.get_feedback, FakeDB(), "none"), {"available": False, "scheduleId": None, "answer": None})

    def test_only_yes_or_no(self):
        with self.assertRaises(HTTPException) as e:
            call(sf.give_feedback, FakeDB(), sf.FeedbackIn(pathId="p1", scheduleId="abc123", answer="meh"))
        self.assertEqual(e.exception.status_code, 422)

    def test_before_the_migration_it_says_not_available(self):
        db = FakeDB(missing_table=True)
        self.assertEqual(call(sf.get_feedback, db, "p1")["available"], False)
        with self.assertRaises(HTTPException) as e:
            call(sf.give_feedback, db, sf.FeedbackIn(pathId="p1", scheduleId="abc123", answer="yes"))
        self.assertEqual(e.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
