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


class _Recorder:
    """A job store that records what is written to it."""

    def __init__(self):
        self.updates = []

    def table(self, _name):
        return _Update(self)


class _Update:
    def __init__(self, db):
        self.db, self.patch = db, None

    def update(self, patch):
        self.patch = patch
        return self

    def eq(self, *_):
        return self

    def lt(self, *_):
        return self

    def execute(self):
        self.db.updates.append(self.patch)
        return type("Result", (), {"data": [self.patch]})()


def load_jobs(rows, client=None):
    stub = ModuleType("database.supabase_client")
    stub.get_supabase = lambda: client if client is not None else _Client(rows)
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


class ErrorKindTests(unittest.TestCase):
    """Why a job failed is kept with it, so the page can show a guardrail's words, the crisis lines among them (bug
    audit, 17 November 2026, item 17), without a new column: "[kind] message" in the error."""

    def failure(self, error, status="failed"):
        return load_jobs([])["failure"]({"status": status, "error": error})

    def test_each_kind_is_kept_and_read_back(self):
        db = _Recorder()
        jobs = load_jobs([], client=db)
        crisis = "You can call or text 9-8-8 any time. If you are in danger now, call 911."
        jobs["mark_failed"]("j1", crisis, "guardrail")
        jobs["mark_failed"]("j2", "Too many requests in the last minute. Please wait.", "limit")
        jobs["mark_failed"]("j3", None, "internal")
        jobs["mark_failed"]("j4", jobs["DEADLINE_REASON"], "internal")
        self.assertEqual(db.updates[0]["error"], f"[guardrail] {crisis}")
        self.assertEqual(db.updates[3]["error"], "[internal] Stopped at the generation deadline.")
        read = [jobs["failure"]({"status": "failed", **u}) for u in db.updates]
        internal = jobs["INTERNAL_ERROR"]
        self.assertEqual(read, [("guardrail", crisis), ("limit", "Too many requests in the last minute. Please wait."),
                                ("internal", internal), ("internal", internal)])
        self.assertTrue(all(u["status"] == "failed" and u["stage"] == "Failed" for u in db.updates))

    def test_an_internal_failure_is_one_plain_sentence(self):
        text = load_jobs([])["INTERNAL_ERROR"]
        self.assertTrue(text.endswith("."))
        self.assertEqual(text.count("."), 1)
        for word in ("error", "exception", "orchestration", "generation", "agent", "http"):
            self.assertNotIn(word, text.lower())

    def test_jobs_from_before_are_read_by_what_wrote_them(self):
        internal = load_jobs([])["INTERNAL_ERROR"]
        self.assertEqual(self.failure("Path generation failed. Please try again."), ("internal", internal))
        self.assertEqual(self.failure("Generation was interrupted. Please try again."), ("internal", internal))
        self.assertEqual(self.failure(None), ("internal", internal))
        limit = "You've reached today's AI budget. It resets in 24 hours."
        self.assertEqual(self.failure(limit), ("limit", limit))
        self.assertEqual(self.failure("Goals involving harming others aren't supported."),
                         ("guardrail", "Goals involving harming others aren't supported."))

    def test_only_a_failed_job_has_a_kind(self):
        for status in ("queued", "running", "succeeded"):
            self.assertEqual(self.failure("[guardrail] words", status), (None, None), status)

    def test_the_reaper_records_an_interruption(self):
        db = _Recorder()
        jobs = load_jobs([], client=db)
        jobs["reap_stale"]()
        self.assertEqual(db.updates[0]["error"], f"[internal] {jobs['INTERRUPTED_REASON']}")
        self.assertEqual(jobs["failure"]({"status": "failed", **db.updates[0]}), ("internal", jobs["INTERNAL_ERROR"]))

    def test_a_generation_is_stopped_before_its_job_counts_as_dead(self):
        jobs = load_jobs([])
        self.assertLess(jobs["GENERATION_DEADLINE"], jobs["STALE_AFTER"])


class JobWorkerTests(unittest.TestCase):
    """api/routes/onboarding.py: the worker records each kind, the poll returns it, and the blocking route keeps a
    guardrail's 422 (it turned it into a 500, which the app showed as "Your path couldn't be made")."""

    CRISIS_GOAL = "I want to die"

    def setUp(self):
        from api.routes import onboarding
        self.onboarding = onboarding
        self.failed, self.succeeded = [], []
        self.patches = [
            patch.object(onboarding.jobs, "mark_running", lambda job_id, stage="": None),
            patch.object(onboarding.jobs, "mark_failed",
                         lambda job_id, error=None, kind="internal": self.failed.append((kind, error))),
            patch.object(onboarding.jobs, "mark_succeeded", lambda job_id, path_id: self.succeeded.append(path_id)),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()

    def request(self, goal="Get a job"):
        return self.onboarding.OnboardingRequest(motivationType="growth", goals=[goal], userId="u1")

    def run_job(self, generate):
        import asyncio
        with patch.object(self.onboarding, "_generate_path_for", generate):
            asyncio.run(self.onboarding._run_job("j1", self.request(), actor="u1"))

    def test_a_guardrail_keeps_its_words(self):
        import asyncio
        # The real pipeline: its first step, the guardrails, turns the goal down before anything else runs.
        asyncio.run(self.onboarding._run_job("j1", self.request(self.CRISIS_GOAL), actor="u1"))
        self.assertEqual(len(self.failed), 1)
        kind, words = self.failed[0]
        self.assertEqual(kind, "guardrail")
        self.assertIn("9-8-8", words)
        self.assertIn("911", words)

    def test_each_failure_is_recorded_with_its_kind(self):
        from fastapi import HTTPException
        from core import budget

        def raising(error):
            async def generate(request, job_id=None, actor=None, on_stage=None):
                raise error
            return generate

        self.run_job(raising(HTTPException(status_code=422, detail="You can call or text 9-8-8 any time.")))
        self.run_job(raising(budget.LimitExceeded("tokens_per_day", "You've reached today's usage limit.")))
        self.run_job(raising(RuntimeError("database said no: details")))
        self.run_job(raising(HTTPException(status_code=503, detail="Auth unavailable.")))
        self.assertEqual(self.failed, [("guardrail", "You can call or text 9-8-8 any time."),
                                       ("limit", "You've reached today's usage limit."),
                                       ("internal", None), ("internal", None)])
        self.assertEqual(self.succeeded, [])

    def test_a_hung_generation_is_stopped_at_the_deadline(self):
        import asyncio

        async def hangs(request, job_id=None, actor=None, on_stage=None):
            await asyncio.sleep(30)

        with patch.object(self.onboarding, "GENERATION_DEADLINE_SECONDS", 0.05):
            self.run_job(hangs)
        self.assertEqual(self.failed, [("internal", self.onboarding.jobs.DEADLINE_REASON)])

    def client(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api import auth_guard
        app = FastAPI()
        app.include_router(self.onboarding.router, prefix="/api/onboarding")
        app.dependency_overrides[auth_guard.current_user_id] = lambda: "u1"
        app.dependency_overrides[auth_guard.onboarding_user_id] = lambda: "u1"
        return TestClient(app)

    def test_the_poll_says_why(self):
        rows = {
            "j1": {"id": "j1", "user_id": "u1", "status": "failed", "error": "[guardrail] Call or text 9-8-8."},
            "j2": {"id": "j2", "user_id": "u1", "status": "failed", "error": "[internal] Stopped at the generation deadline."},
            "j3": {"id": "j3", "user_id": "u1", "status": "running", "stage": "Mapping out your milestones"},
        }
        with patch.object(self.onboarding.jobs, "get", lambda job_id: rows.get(job_id)):
            client = self.client()
            one, two, three = (client.get(f"/api/onboarding/jobs/{j}").json() for j in ("j1", "j2", "j3"))
        self.assertEqual((one["errorKind"], one["error"]), ("guardrail", "Call or text 9-8-8."))
        self.assertEqual((two["errorKind"], two["error"]), ("internal", self.onboarding.jobs.INTERNAL_ERROR))
        self.assertEqual((three["errorKind"], three["error"], three["status"]), (None, None, "running"))

    def test_the_blocking_route_keeps_a_guardrails_422(self):
        with patch.object(self.onboarding.jobs, "enabled", lambda: False):
            response = self.client().post("/api/onboarding/", json={
                "email": "someone@example.com", "motivationType": "growth", "goals": [self.CRISIS_GOAL]})
        self.assertEqual(response.status_code, 422, response.text)
        self.assertIn("9-8-8", response.json()["detail"])

    def test_the_blocking_route_hides_internal_detail(self):
        async def broken(request, job_id=None, actor=None, on_stage=None):
            raise RuntimeError("relation user_paths: connection reset")

        with patch.object(self.onboarding.jobs, "enabled", lambda: False), \
                patch.object(self.onboarding, "_generate_path_for", broken):
            response = self.client().post("/api/onboarding/", json={"motivationType": "growth", "goals": ["Get a job"]})
        self.assertEqual((response.status_code, response.json()["detail"]), (500, self.onboarding.jobs.INTERNAL_ERROR))

    def test_waiting_on_a_job_answers_with_its_kind(self):
        import asyncio
        from fastapi import HTTPException
        rows = {"j1": {"status": "failed", "error": "[guardrail] Call or text 9-8-8."},
                "j2": {"status": "failed", "error": "[limit] Too many requests in the last minute."},
                "j3": {"status": "failed", "error": "[internal] Stopped at the generation deadline."}}
        seen = []
        with patch.object(self.onboarding.jobs, "get", lambda job_id: rows[job_id]):
            for job_id in rows:
                with self.assertRaises(HTTPException) as e:
                    asyncio.run(self.onboarding._wait_for_job(job_id))
                seen.append((e.exception.status_code, e.exception.detail))
        self.assertEqual(seen, [(422, "Call or text 9-8-8."), (429, "Too many requests in the last minute."),
                                (500, self.onboarding.jobs.INTERNAL_ERROR)])

    def test_the_stored_request_leaves_out_the_email(self):
        created = {}

        def create(user_id, request):
            created.update(request)
            return None

        with patch.object(self.onboarding.jobs, "enabled", lambda: True), \
                patch.object(self.onboarding.jobs, "reap_stale", lambda: 0), \
                patch.object(self.onboarding.jobs, "in_flight_for_user", lambda user_id: None), \
                patch.object(self.onboarding.jobs, "create", create):
            response = self.client().post("/api/onboarding/jobs", json={
                "email": "someone-else@example.com", "motivationType": "growth", "goals": ["Get a job"]})
        self.assertEqual(response.status_code, 503)   # the fake store queued nothing
        self.assertEqual(created["goals"], ["Get a job"])
        self.assertNotIn("email", created)


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
