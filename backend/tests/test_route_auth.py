"""Routes that read or change one person's data need that person's session
(or their guardian's). Five had no check at all, and the full audit
(docs/reports/backend-route-audit-2026-10-08.md) found three more.

Run from backend/:  python -m unittest tests.test_route_auth -v
"""
import ast
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import auth_guard
from api.routes import memory, messaging, onboarding, paths, reflections

ROOT = Path(__file__).resolve().parents[1]
GUARDED = {
    "api/routes/reflections.py": {"get_user_reflections"},
    "api/routes/onboarding.py": {"update_onboarding", "get_generated_path", "get_latest_job", "get_job"},
    "api/routes/paths.py": {"get_path", "adapt_path"},
    "api/routes/memory.py": {"get_user_memory"},
    "api/routes/messaging.py": {"get_conversations"},
}
SESSION_DEPENDENCIES = {"current_user_id", "onboarding_user_id"}


def client_as(user_id):
    app = FastAPI()
    app.include_router(reflections.router, prefix="/api/reflections")
    app.include_router(onboarding.router, prefix="/api/onboarding")
    app.include_router(paths.router, prefix="/api/paths")
    app.include_router(memory.router, prefix="/api/memory")
    app.include_router(messaging.router)
    if user_id is not None:
        app.dependency_overrides[auth_guard.current_user_id] = lambda: user_id
        app.dependency_overrides[auth_guard.onboarding_user_id] = lambda: user_id
    return TestClient(app)


class RouteAuthTests(unittest.TestCase):
    def setUp(self):
        # No database: nobody is anybody's guardian, and nothing is stored.
        self.patches = [patch.object(auth_guard, "get_supabase", lambda: None),
                        patch.object(onboarding, "get_supabase", lambda: None),
                        patch("database.supabase_client.get_supabase", lambda: None)]
        for p in self.patches:
            p.start()
        onboarding.generated_paths["path_owned"] = {"id": "path_owned", "userId": "owner", "races": []}

    def tearDown(self):
        onboarding.generated_paths.pop("path_owned", None)
        for p in self.patches:
            p.stop()

    def test_each_route_requires_a_session(self):
        for rel, names in GUARDED.items():
            module = ast.parse((ROOT / rel).read_text())
            found = set()
            for fn in module.body:
                if isinstance(fn, ast.AsyncFunctionDef) and fn.name in names:
                    deps = [d for d in fn.args.defaults
                            if isinstance(d, ast.Call) and getattr(d.func, "id", "") == "Depends"]
                    dependency_names = {getattr(d.args[0], "id", "") for d in deps if d.args}
                    self.assertTrue(dependency_names & SESSION_DEPENDENCIES, f"{rel}:{fn.name} has no session dependency")
                    if fn.name == "update_onboarding":
                        # It can run a whole generation: same age and approval gate.
                        self.assertIn("onboarding_user_id", dependency_names)
                    found.add(fn.name)
            self.assertEqual(found, names, rel)

    def test_no_session_is_refused(self):
        anon = client_as(None)
        self.assertEqual(anon.get("/api/reflections/user/owner").status_code, 401)
        self.assertEqual(anon.get("/api/onboarding/path/path_owned").status_code, 401)
        self.assertEqual(anon.patch("/api/onboarding/owner", json={}).status_code, 401)
        self.assertEqual(anon.get("/api/paths/path_owned").status_code, 401)

    def test_memory_and_latest_job_are_only_for_the_person(self):
        with patch.object(onboarding.jobs, "latest_for_user", lambda user_id: None):
            stranger, owner = client_as("stranger"), client_as("owner")
            self.assertEqual(stranger.get("/api/memory/owner").status_code, 404)
            self.assertEqual(stranger.get("/api/onboarding/jobs/latest/owner").status_code, 404)
            self.assertEqual(owner.get("/api/memory/owner").status_code, 200)
            self.assertEqual(owner.get("/api/onboarding/jobs/latest/owner").status_code, 200)
            self.assertEqual(client_as(None).get("/api/memory/owner").status_code, 401)

    def test_a_job_is_only_polled_by_its_owner(self):
        # The error of a job can be the crisis message (a goal that mentions
        # self-harm). Someone else gets the 404 of a job that doesn't exist.
        row = {"id": "job_1", "user_id": "owner", "status": "failed", "error": "crisis message"}
        with patch.object(onboarding.jobs, "get", lambda job_id: row if job_id == "job_1" else None):
            owner = client_as("owner").get("/api/onboarding/jobs/job_1")
            self.assertEqual((owner.status_code, owner.json()["error"]), (200, "crisis message"))
            stranger = client_as("stranger").get("/api/onboarding/jobs/job_1")
            missing = client_as("stranger").get("/api/onboarding/jobs/job_2")
            self.assertEqual((stranger.status_code, stranger.json()), (404, {"detail": "Job not found"}))
            self.assertEqual(stranger.json(), missing.json())
            self.assertNotIn("crisis", stranger.text)
            self.assertEqual(client_as(None).get("/api/onboarding/jobs/job_1").status_code, 401)

    def test_conversations_are_only_ever_the_callers_own(self):
        # main (3d78f99, api/routes/social_access.py): a user_id naming someone
        # else is refused with 403, not ignored; without one, or naming
        # yourself, you get your own.
        me, victim = "00000000-0000-0000-0000-0000000000a1", "00000000-0000-0000-0000-0000000000b2"
        seen = []

        class Query:
            def select(self, *_): return self
            def eq(self, column, value): seen.append((column, value)); return self
            def is_(self, *_): return self
            def execute(self): return type("R", (), {"data": []})()

        fake = type("SB", (), {"table": lambda self, name: Query()})()
        with patch.object(messaging, "_client", lambda: fake):
            refused = client_as(me).get(f"/api/messaging/conversations?user_id={victim}")
            self.assertEqual(refused.status_code, 403)
            self.assertEqual(seen, [])
            for path in ("/api/messaging/conversations", f"/api/messaging/conversations?user_id={me}"):
                self.assertEqual(client_as(me).get(path).status_code, 200)
        self.assertEqual({v for _, v in seen}, {me})

    def test_deleting_a_path_only_drops_your_own_from_the_cache(self):
        onboarding.generated_paths["path_theirs"] = {"id": "path_theirs", "userId": "them"}
        try:
            onboarding._delete_path("me", "path_theirs")
            self.assertIn("path_theirs", onboarding.generated_paths)
            onboarding._delete_path("them", "path_theirs")
            self.assertNotIn("path_theirs", onboarding.generated_paths)
        finally:
            onboarding.generated_paths.pop("path_theirs", None)

    def test_someone_else_gets_not_found(self):
        stranger = client_as("stranger")
        self.assertEqual(stranger.get("/api/reflections/user/owner").status_code, 404)
        self.assertEqual(stranger.get("/api/onboarding/path/path_owned").status_code, 404)
        self.assertEqual(stranger.patch("/api/onboarding/owner", json={"goals": ["x"]}).status_code, 404)
        self.assertEqual(stranger.get("/api/paths/path_owned").status_code, 404)
        self.assertEqual(stranger.post("/api/paths/path_owned/adapt", json={}).status_code, 404)

    def test_the_owner_gets_through(self):
        owner = client_as("owner")
        self.assertEqual(owner.get("/api/reflections/user/owner").status_code, 200)
        self.assertEqual(owner.get("/api/onboarding/path/path_owned").json()["id"], "path_owned")
        self.assertEqual(owner.get("/api/paths/path_owned").json()["id"], "path_owned")

    def test_a_guardian_gets_through(self):
        with patch.object(auth_guard, "_is_guardian", lambda guardian, child: (guardian, child) == ("parent", "owner")):
            parent = client_as("parent")
            self.assertEqual(parent.get("/api/onboarding/path/path_owned").status_code, 200)
            self.assertEqual(parent.get("/api/reflections/user/owner").status_code, 200)


if __name__ == "__main__":
    unittest.main()
