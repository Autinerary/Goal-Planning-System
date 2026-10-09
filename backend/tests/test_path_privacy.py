"""Plans leave the server without other people's details (core/path_privacy.py).

Run from backend/:  python -m unittest tests.test_path_privacy -v
"""
import copy
import json
import unittest
from pathlib import Path

from core.path_privacy import without_other_people

EXAMPLE = json.loads((Path(__file__).parent / "fixtures/plan_with_other_people.json").read_text())


class PathPrivacyTests(unittest.TestCase):
    def test_other_people_are_removed_and_counted(self):
        self.assertEqual(without_other_people(EXAMPLE["stored"]), EXAMPLE["returned"])

    def test_the_stored_plan_is_not_changed(self):
        stored = copy.deepcopy(EXAMPLE["stored"])
        without_other_people(stored)
        self.assertEqual(stored, EXAMPLE["stored"])

    def test_nothing_else_changes(self):
        clean = without_other_people(EXAMPLE["stored"])
        for key in ("id", "userId", "userProfile", "races"):
            self.assertEqual(clean[key], EXAMPLE["stored"][key])
        self.assertEqual(clean["agentResponses"][1], EXAMPLE["stored"]["agentResponses"][1])

    def test_anything_that_is_not_a_plan_passes_through(self):
        for value in (None, [], "x", {"id": "p"}, {"agentResponses": None}, {"agentResponses": [{"agentId": "path_planning"}]}):
            self.assertIs(without_other_people(value), value)

    def test_a_clean_plan_is_returned_as_is(self):
        clean = without_other_people(EXAMPLE["stored"])
        self.assertIs(without_other_people(clean), clean)


if __name__ == "__main__":
    unittest.main()


class RoutesReturnTheFilteredPlanTests(unittest.TestCase):
    """The backend routes that return a plan send it without other people."""

    def setUp(self):
        from unittest.mock import patch
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from api import auth_guard
        from api.routes import onboarding, paths

        self.onboarding = onboarding
        self.stored = copy.deepcopy(EXAMPLE["stored"])
        onboarding.generated_paths["path_example"] = self.stored
        app = FastAPI()
        app.include_router(onboarding.router, prefix="/api/onboarding")
        app.include_router(paths.router, prefix="/api/paths")
        app.dependency_overrides[auth_guard.current_user_id] = lambda: EXAMPLE["stored"]["userId"]
        self.patches = [patch.object(auth_guard, "get_supabase", lambda: None),
                        patch.object(onboarding, "get_supabase", lambda: None),
                        patch.object(onboarding, "_load_path_by_user", lambda user_id: self.stored)]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.onboarding.generated_paths.pop("path_example", None)
        for p in self.patches:
            p.stop()

    def test_each_route_returns_the_plan_without_other_people(self):
        owner = EXAMPLE["stored"]["userId"]
        for url in ("/api/onboarding/path/path_example", f"/api/onboarding/user/{owner}/path", "/api/paths/path_example"):
            body = self.client.get(url).json()
            self.assertEqual(body, EXAMPLE["returned"], url)
        self.assertEqual(self.stored, EXAMPLE["stored"])   # the stored copy keeps everything
