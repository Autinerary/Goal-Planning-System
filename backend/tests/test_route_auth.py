"""Routes that read or change one person's data need that person's session
(or their guardian's). Five had no check at all.

Run from backend/:  python -m unittest tests.test_route_auth -v
"""
import ast
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import auth_guard
from api.routes import onboarding, paths, reflections

ROOT = Path(__file__).resolve().parents[1]
GUARDED = {
    "api/routes/reflections.py": {"get_user_reflections"},
    "api/routes/onboarding.py": {"update_onboarding", "get_generated_path"},
    "api/routes/paths.py": {"get_path", "adapt_path"},
}


def client_as(user_id):
    app = FastAPI()
    app.include_router(reflections.router, prefix="/api/reflections")
    app.include_router(onboarding.router, prefix="/api/onboarding")
    app.include_router(paths.router, prefix="/api/paths")
    if user_id is not None:
        app.dependency_overrides[auth_guard.current_user_id] = lambda: user_id
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
                    self.assertTrue(any(d.args and getattr(d.args[0], "id", "") == "current_user_id" for d in deps),
                                    f"{rel}:{fn.name} has no current_user_id dependency")
                    found.add(fn.name)
            self.assertEqual(found, names, rel)

    def test_no_session_is_refused(self):
        anon = client_as(None)
        self.assertEqual(anon.get("/api/reflections/user/owner").status_code, 401)
        self.assertEqual(anon.get("/api/onboarding/path/path_owned").status_code, 401)
        self.assertEqual(anon.patch("/api/onboarding/owner", json={}).status_code, 401)
        self.assertEqual(anon.get("/api/paths/path_owned").status_code, 401)

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
