"""One path generation per person at a time (core/jobs.py, in_flight_for_user).

Run from backend/:  python -m unittest tests.test_generation_jobs -v
"""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def execute(self):
        return type("Result", (), {"data": self.rows})()


class _Client:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return _Query(self.rows)


def load_jobs(rows):
    stub = ModuleType("database.supabase_client")
    stub.get_supabase = lambda: _Client(rows)
    namespace = {"__name__": "core.jobs"}
    source = (ROOT / "core/jobs.py").read_text()
    with patch.dict(sys.modules, {"database.supabase_client": stub}):
        exec(compile(source, str(ROOT / "core/jobs.py"), "exec"), namespace)
    return namespace


def ago(**kw):
    # Postgres-style: microseconds with trailing zeros trimmed.
    return (datetime.now(timezone.utc) - timedelta(**kw)).isoformat().replace("000+00:00", "+00:00")


class InFlightTests(unittest.TestCase):
    def test_a_running_generation_is_reused(self):
        jobs = load_jobs([{"id": "j1", "status": "running", "created_at": ago(seconds=20)}])
        self.assertEqual(jobs["in_flight_for_user"]("u")["id"], "j1")

    def test_queued_counts_too(self):
        jobs = load_jobs([{"id": "j1", "status": "queued", "created_at": ago(seconds=2)}])
        self.assertEqual(jobs["in_flight_for_user"]("u")["id"], "j1")

    def test_finished_ones_do_not(self):
        for status in ("succeeded", "failed"):
            jobs = load_jobs([{"id": "j1", "status": status, "created_at": ago(seconds=20)}])
            self.assertIsNone(jobs["in_flight_for_user"]("u"), status)

    def test_a_stale_one_does_not(self):
        jobs = load_jobs([{"id": "j1", "status": "running", "created_at": ago(minutes=16)}])
        self.assertIsNone(jobs["in_flight_for_user"]("u"))

    def test_no_jobs(self):
        self.assertIsNone(load_jobs([])["in_flight_for_user"]("u"))

    def test_postgres_timestamps_parse(self):
        parse = load_jobs([])["_parse"]
        self.assertEqual(parse("2026-09-10T01:56:55.88668+00:00").microsecond, 886680)
        self.assertIsNotNone(parse("2026-09-10T01:56:55+00:00"))
        self.assertIsNotNone(parse("2026-09-10T01:56:55.1Z"))
        self.assertIsNone(parse(None))
        self.assertIsNone(parse("not a date"))


class RoutesUseItTests(unittest.TestCase):
    def test_both_generation_routes_check_for_one_under_way(self):
        source = (ROOT / "api/routes/onboarding.py").read_text()
        enqueue = source[source.index("async def enqueue_onboarding"):source.index("@router.get(\"/jobs/{job_id}\"")]
        blocking = source[source.index("async def create_onboarding"):source.index("class JobAccepted")]
        self.assertIn("jobs.in_flight_for_user(user_id)", enqueue)
        self.assertLess(enqueue.index("in_flight_for_user"), enqueue.index("jobs.create("))
        self.assertIn("jobs.in_flight_for_user(actor)", blocking)
        self.assertLess(blocking.index("in_flight_for_user"), blocking.index("_generate_path_for("))


if __name__ == "__main__":
    unittest.main()
