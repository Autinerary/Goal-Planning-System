"""A journal entry's "Did this help?" counts toward the shared tool ranking only for tools recommended to the person
in their latest plan, and once per person, tool and day (core/learning.py, record_tool_outcomes_for). The ids come
from the browser, and every one sent used to count, as often as it was sent (bug audit, 17 November 2026, item 11).

Run from backend/:  python -m unittest tests.test_tool_outcomes -v
"""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import reflections
from core import learning

USER = "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"
OTHER = "0d6f6f0e-1c9b-4a52-8d2e-3b8e2f6a7c11"


class Base(unittest.TestCase):
    def setUp(self):
        learning._tool_outcomes_counted.clear()
        self.recorded = []

        async def record(tool_ids, barriers, reward):
            self.recorded.append(list(tool_ids))
            return True

        p = patch.object(learning, "record_tool_outcomes", record)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(learning._tool_outcomes_counted.clear)

    def record(self, used, recommended=("sh_a", "sh_b"), user=USER):
        return asyncio.run(learning.record_tool_outcomes_for(user, list(used), list(recommended), ["adhd"], 1.0))


class GateTests(Base):
    def test_only_tools_recommended_to_them(self):
        self.assertTrue(self.record(["sh_a", "sh_somebody_elses", "sh_a"]))
        self.assertEqual(self.recorded, [["sh_a"]])

    def test_nothing_recommended_nothing_counted(self):
        self.assertFalse(self.record(["sh_a"], recommended=()))
        self.assertEqual(self.recorded, [])

    def test_once_a_day_per_person_and_tool(self):
        self.record(["sh_a"])
        self.assertFalse(self.record(["sh_a"]))
        self.assertTrue(self.record(["sh_a", "sh_b"]))
        self.assertTrue(self.record(["sh_a"], user=OTHER))     # someone else's answer counts too
        self.assertEqual(self.recorded, [["sh_a"], ["sh_b"], ["sh_a"]])

    def test_a_new_day(self):
        self.assertEqual(learning._claim_tools(USER, ["sh_a"], ["sh_a"], today="2026-11-17"), ["sh_a"])
        self.assertEqual(learning._claim_tools(USER, ["sh_a"], ["sh_a"], today="2026-11-17"), [])
        self.assertEqual(learning._claim_tools(USER, ["sh_a"], ["sh_a"], today="2026-11-18"), ["sh_a"])

    def test_a_failed_write_can_be_tried_again(self):
        with patch.object(learning, "record_tool_outcomes", AsyncMock(return_value=False)):
            self.assertFalse(self.record(["sh_a"]))
        self.assertTrue(self.record(["sh_a"]))

    def test_not_a_signed_in_account(self):
        self.assertFalse(self.record(["sh_a"], user="user_123"))


class JournalEntryTests(Base):
    """The same, through POST /api/reflections/."""

    def post(self, used):
        orchestrator = SimpleNamespace(adapt_path=AsyncMock(return_value={"agentResponses": []}),
                                       index_user=AsyncMock(return_value=True))
        app = FastAPI()
        app.include_router(reflections.router, prefix="/api/reflections")
        context = {"recommended_tool_ids": ["sh_a", "sh_b"], "barriers": ["adhd"], "profile_signature": "s",
                   "milestone_count": 3, "scheduled_buckets": []}
        with patch.object(reflections, "_verified_user_id", lambda authorization: USER), \
                patch.object(reflections, "_get_orchestrator", AsyncMock(return_value=orchestrator)), \
                patch.object(reflections, "get_supabase", lambda: None), \
                patch.object(learning, "close_previous_adaptation_loops", AsyncMock(return_value=0)), \
                patch.object(learning, "persist_reflection", MagicMock(return_value="r1")), \
                patch.object(learning, "get_user_latest_context", AsyncMock(return_value=context)):
            response = TestClient(app).post("/api/reflections/", json={
                "contextType": "milestone", "contextId": "m1", "questions": [],
                "learningFeedback": {"outcome": "helped", "usedToolIds": used}})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["learning"]["tool_outcomes_recorded"]

    def test_an_entry_counts_only_recommended_tools_once_a_day(self):
        self.assertTrue(self.post(["sh_a", "sh_made_up"]))
        self.assertFalse(self.post(["sh_a"]))
        self.assertFalse(self.post(["sh_made_up"]))
        self.assertEqual(self.recorded, [["sh_a"]])


if __name__ == "__main__":
    unittest.main()
