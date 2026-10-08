"""A journal entry with an outcome re-embeds the person from their stored
profile, changing only the success signal (api/routes/reflections.py, step 6).
It used to re-embed them from an empty profile.

Run from backend/:  python -m unittest tests.test_reflection_reembed -v
"""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import reflections
from core import learning
from tests.test_pattern_reindex import DB


class ReflectionReembedTests(unittest.TestCase):
    def post(self, user_id, outcome):
        orchestrator = SimpleNamespace(
            adapt_path=AsyncMock(return_value={
                "path": None,
                "agentResponses": [
                    {"agentId": "reflection_analysis", "result": {"insights": {}, "sentiment": {"label": "neutral"}}},
                    {"agentId": "adaptation", "result": {}},
                ],
            }),
            index_user=AsyncMock(return_value=True),
        )
        app = FastAPI()
        app.include_router(reflections.router, prefix="/api/reflections")
        stubs = [
            patch.object(reflections, "_verified_user_id", lambda authorization: user_id),
            patch.object(reflections, "_get_orchestrator", AsyncMock(return_value=orchestrator)),
            patch.object(reflections, "get_supabase", lambda: DB()),
            patch.object(learning, "compute_explicit_reward", lambda feedback: 0.5),
            patch.object(learning, "close_previous_adaptation_loops", AsyncMock(return_value=None)),
            patch.object(learning, "persist_reflection", MagicMock(return_value=None)),
            patch.object(learning, "record_adaptation_outcome", AsyncMock(return_value=True)),
            patch.object(learning, "get_user_latest_context", AsyncMock(return_value=None)),
        ]
        for s in stubs:
            s.start()
        try:
            response = TestClient(app).post("/api/reflections/", json={
                "contextType": "milestone", "contextId": "m1", "questions": [],
                "learningFeedback": {"outcome": outcome},
            })
        finally:
            for s in stubs:
                s.stop()
        self.assertEqual(response.status_code, 200, response.text)
        return orchestrator.index_user

    def test_reembeds_from_the_stored_profile_with_the_new_success_signal(self):
        index_user = self.post("u1", "helped")
        kw = index_user.await_args.kwargs
        self.assertEqual(kw["barriers"], ["ADHD", "Dyslexia"])   # user_barriers, not []
        self.assertEqual(kw["goals"], ["Get a job"])              # their active path, not []
        self.assertEqual(kw["user_profile"]["motivationType"], "curiosity")
        self.assertEqual(kw["success_rate"], 0.75)                # (0.5 + 1) / 2

    def test_someone_without_a_vector_is_not_indexed_from_nothing(self):
        self.post("nobody", "helped").assert_not_awaited()

    def test_not_sure_changes_nothing(self):
        self.post("u1", "not_sure").assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
