"""Rebuilding profile vectors when conditions change (core/pattern_reindex.py,
STEP 56), and when a vector write clears the mark.

Run from backend/:  python -m unittest tests.test_pattern_reindex -v
"""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from core import pattern_reindex as pr


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.not_null, self.payload = db, table, {}, None, None
        self.not_ = SimpleNamespace(is_=self._not_is)

    def _not_is(self, column, value):
        self.not_null = column
        return self

    def select(self, *_):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def upsert(self, row, on_conflict=None):
        self.payload = row
        return self

    def execute(self):
        if self.payload is not None:
            missing = [c for c in self.db.missing_columns if c in self.payload]
            if missing:
                raise RuntimeError(f"Could not find the '{missing[0]}' column of 'pattern_user_embeddings'")
            self.db.upserts.append(dict(self.payload))
            return SimpleNamespace(data=[self.payload])
        if self.not_null and self.not_null in self.db.missing_columns:
            raise RuntimeError(f"column pattern_user_embeddings.{self.not_null} does not exist")
        rows = [r for r in self.db.tables.get(self.table, []) if all(r.get(k) == v for k, v in self.filters.items())]
        if self.not_null:
            rows = [r for r in rows if r.get(self.not_null) is not None]
        return SimpleNamespace(data=rows)


class DB:
    def __init__(self, missing_columns=()):
        self.missing_columns, self.upserts = set(missing_columns), []
        self.tables = {
            "pattern_user_embeddings": [
                {"user_id": "u1", "goals": ["old goal"], "success_rate": 0.9, "motivation_type": "curiosity",
                 "reindex_requested_at": "2026-10-08T10:00:00+00:00"},
                {"user_id": "u2", "goals": ["x"], "success_rate": 0.5, "reindex_requested_at": None},
            ],
            "user_barriers": [
                {"user_id": "u1", "barrier_type": "ADHD"},
                {"user_id": "u1", "barrier_type": "Dyslexia"},   # added later, e.g. in ResourceHub
            ],
            "user_paths": [
                {"user_id": "u1", "is_active": False, "updated_at": "2026-09-01", "payload": {"userProfile": {"goals": ["older"]}}},
                {"user_id": "u1", "is_active": True, "updated_at": "2026-09-02",
                 "payload": {"userProfile": {"goals": ["Get a job"], "preferences": {"ageRange": "25-40"}}, "path": {"id": "p"}}},
            ],
        }

    def table(self, name):
        return Query(self, name)


class ReindexTests(unittest.TestCase):
    def test_rebuilds_from_the_current_profile_and_keeps_success_rate(self):
        orchestrator = SimpleNamespace(index_user=AsyncMock(return_value=True))
        self.assertTrue(asyncio.run(pr.reindex_user(DB(), orchestrator, "u1")))
        kw = orchestrator.index_user.await_args.kwargs
        self.assertEqual(kw["barriers"], ["ADHD", "Dyslexia"])
        self.assertEqual(kw["goals"], ["Get a job"])
        self.assertEqual(kw["success_rate"], 0.9)
        self.assertEqual(kw["user_profile"]["motivationType"], "curiosity")
        self.assertEqual(kw["agent_result"]["path"], {"id": "p"})

    def test_a_motivation_picked_in_the_app_wins(self):
        # Asked in the app now, not in setup (Riipen Labs, Groups 25 to 30).
        db = DB()
        db.tables["profiles"] = [{"id": "u1", "preferences": {"motivation": {"types": ["social", "curiosity"]}}}]
        orchestrator = SimpleNamespace(index_user=AsyncMock(return_value=True))
        self.assertTrue(asyncio.run(pr.reindex_user(db, orchestrator, "u1")))
        self.assertEqual(orchestrator.index_user.await_args.kwargs["user_profile"]["motivationType"], "social")

    def test_without_one_the_vector_keeps_its_motivation(self):
        db = DB()
        db.tables["profiles"] = [{"id": "u1", "preferences": {"motivation": {"types": []}}}]
        orchestrator = SimpleNamespace(index_user=AsyncMock(return_value=True))
        asyncio.run(pr.reindex_user(db, orchestrator, "u1"))
        self.assertEqual(orchestrator.index_user.await_args.kwargs["user_profile"]["motivationType"], "curiosity")

    def test_someone_without_a_vector_is_left_alone(self):
        orchestrator = SimpleNamespace(index_user=AsyncMock())
        self.assertFalse(asyncio.run(pr.reindex_user(DB(), orchestrator, "nobody")))
        orchestrator.index_user.assert_not_awaited()

    def test_the_sweep_rebuilds_only_marked_vectors(self):
        orchestrator = SimpleNamespace(index_user=AsyncMock(return_value=True))
        result = asyncio.run(pr.reindex_pending(DB(), orchestrator))
        self.assertEqual(result, {"available": True, "pending": 1, "rebuilt": 1, "failed": 0})
        self.assertEqual(orchestrator.index_user.await_args.kwargs["user_id"], "u1")

    def test_before_the_migration_the_sweep_does_nothing(self):
        orchestrator = SimpleNamespace(index_user=AsyncMock())
        result = asyncio.run(pr.reindex_pending(DB(missing_columns={"reindex_requested_at"}), orchestrator))
        self.assertFalse(result["available"])
        orchestrator.index_user.assert_not_awaited()


class VectorWriteTests(unittest.TestCase):
    def write(self, db, barriers=("ADHD", "Dyslexia")):
        from core.agents import pattern_recognition_agent as pra
        agent = pra.PatternRecognitionAgent.__new__(pra.PatternRecognitionAgent)
        agent.supabase = db
        agent._generate_embedding = AsyncMock(return_value=[0.1] * 3)
        return asyncio.run(agent.upsert_user_vector("u1", {}, ["Get a job"], list(barriers), success_rate=0.9))

    def test_a_write_with_the_current_conditions_clears_the_mark(self):
        db = DB()
        self.assertTrue(self.write(db, ["adhd ", "Dyslexia"]))   # case and spacing ignored
        row = db.upserts[-1]
        self.assertIn("reindex_requested_at", row)
        self.assertIsNone(row["reindex_requested_at"])
        self.assertTrue(row["updated_at"])
        self.assertEqual(row["barriers"], ["adhd ", "Dyslexia"])

    def test_a_write_from_an_older_profile_leaves_the_mark(self):
        # A reflection from a page loaded before Dyslexia was added.
        db = DB()
        self.assertTrue(self.write(db, ["ADHD"]))
        row = db.upserts[-1]
        self.assertNotIn("reindex_requested_at", row)
        self.assertTrue(row["updated_at"])

    def test_still_indexes_before_the_columns_exist(self):
        db = DB(missing_columns={"reindex_requested_at", "embedding_text_version"})
        self.assertTrue(self.write(db))
        self.assertNotIn("reindex_requested_at", db.upserts[-1])
        self.assertNotIn("embedding_text_version", db.upserts[-1])


if __name__ == "__main__":
    unittest.main()
