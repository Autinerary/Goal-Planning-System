"""Milestone ratings (api/routes/milestone_ratings.py, STEP 54).

Run from backend/:  python -m unittest tests.test_milestone_ratings -v
"""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from api.routes import milestone_ratings as mr

PAYLOAD = {
    "races": [{"milestones": [{"id": "m1"}, {"id": "m2"}]}],
    "agentResponses": [{"agentId": "path_planning", "result": {"milestones": [{"id": "m1"}, {"id": "m3"}]}}],
    "userProfile": {"goals": ["Get a job"], "barrierTypes": ["ADHD"], "preferences": {"ageRange": "25-40"}},
    "path": {"id": "path_1"},
}


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
        if self.table == "milestone_ratings" and self.db.missing_table:
            raise RuntimeError('relation "milestone_ratings" does not exist')
        if self.row is not None:
            self.db.ratings.append({**self.row, "created_at": f"2026-10-08T00:00:0{len(self.db.ratings)}"})
            return SimpleNamespace(data=[self.row])
        if self.table == "user_paths":
            ok = self.filters.get("user_id") == "u1" and self.filters.get("path_id") == "p1"
            return SimpleNamespace(data=[{"payload": PAYLOAD}] if ok else [])
        rows = [r for r in self.db.ratings if all(r.get(k) == v for k, v in self.filters.items())]
        return SimpleNamespace(data=rows)


class FakeDB:
    def __init__(self, missing_table=False):
        self.ratings, self.missing_table = [], missing_table

    def table(self, name):
        return FakeQuery(self, name)


class ScoreTests(unittest.TestCase):
    def test_latest_rating_per_milestone_counts(self):
        rows = [
            {"milestone_id": "m1", "rating": 2, "created_at": "2026-10-01"},
            {"milestone_id": "m1", "rating": 5, "created_at": "2026-10-02"},
            {"milestone_id": "m2", "rating": 3, "created_at": "2026-10-01"},
        ]
        self.assertEqual(mr.path_score(rows), {"ratings": {"m1": 5, "m2": 3}, "rated": 2, "score": 0.75})
        self.assertEqual(mr.path_score([])["score"], None)

    def test_milestone_ids_from_races_and_path_planning(self):
        self.assertEqual(mr.milestone_ids(PAYLOAD), ["m1", "m2", "m3"])
        self.assertEqual(mr.milestone_ids({"races": ["x", {"milestones": "y"}]}), [])


class RouteTests(unittest.TestCase):
    def run_post(self, db, body):
        async def go():
            with patch.object(mr, "get_supabase", return_value=db), \
                 patch.object(mr, "reembed_with_score", AsyncMock(return_value=True)) as reembed:
                result = await mr.rate_milestone(mr.RatingIn(**body), user_id="u1")
                await asyncio.sleep(0)   # let the background re-embed start
                await asyncio.gather(*list(mr._BACKGROUND))
                return result, reembed
        return asyncio.run(go())

    def test_a_rating_is_stored_and_fires_the_reembed(self):
        db = FakeDB()
        result, reembed = self.run_post(db, {"pathId": "p1", "milestoneId": "m2", "rating": 4})
        self.assertEqual(db.ratings[0]["rating"], 4)
        self.assertEqual(db.ratings[0]["user_id"], "u1")
        self.assertEqual((result["score"], result["rated"], result["total"]), (0.75, 1, 3))
        reembed.assert_awaited_once()
        self.assertEqual(reembed.await_args.args, ("u1", PAYLOAD, 0.75))

    def test_a_step_not_in_your_path_is_refused(self):
        for body in ({"pathId": "p1", "milestoneId": "nope", "rating": 3}, {"pathId": "someone-else", "milestoneId": "m1", "rating": 3}):
            with self.assertRaises(HTTPException) as e:
                self.run_post(FakeDB(), body)
            self.assertEqual(e.exception.status_code, 404)

    def test_before_the_migration_it_says_not_available(self):
        with self.assertRaises(HTTPException) as e:
            self.run_post(FakeDB(missing_table=True), {"pathId": "p1", "milestoneId": "m1", "rating": 3})
        self.assertEqual(e.exception.status_code, 503)

    def test_ratings_outside_one_to_five_are_rejected(self):
        for value in (0, 6):
            with self.assertRaises(Exception):
                mr.RatingIn(pathId="p1", milestoneId="m1", rating=value)


class ReembedTests(unittest.TestCase):
    def test_uses_the_reflection_trigger_with_the_score(self):
        orchestrator = SimpleNamespace(index_user=AsyncMock(return_value=True))
        with patch("api.routes.reflections._get_orchestrator", AsyncMock(return_value=orchestrator)):
            self.assertTrue(asyncio.run(mr.reembed_with_score("u1", PAYLOAD, 0.75)))
        kwargs = orchestrator.index_user.await_args.kwargs
        self.assertEqual((kwargs["user_id"], kwargs["goals"], kwargs["barriers"], kwargs["success_rate"]),
                         ("u1", ["Get a job"], ["ADHD"], 0.75))


if __name__ == "__main__":
    unittest.main()
