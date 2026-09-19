import ast
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException


class OnboardingAuthorizationTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.namespace = {}
        dependency = ModuleType("database.supabase_client")
        dependency.get_supabase = lambda: None
        source = (root / "api/auth_guard.py").read_text()
        with patch.dict(sys.modules, {"database.supabase_client": dependency}):
            exec(compile(source, str(root / "api/auth_guard.py"), "exec"), self.namespace)
        self.adult = SimpleNamespace(id="adult", app_metadata={"date_of_birth": "1990-01-01"}, user_metadata={})
        self.minor = SimpleNamespace(id="minor", app_metadata={"date_of_birth": "2015-01-01"}, user_metadata={})

    def authorize(self, account, linked=True):
        client = SimpleNamespace(auth=SimpleNamespace(
            get_user=lambda token: SimpleNamespace(user=account),
            admin=SimpleNamespace(get_user_by_id=lambda identifier: SimpleNamespace(user=self.adult)),
        ))
        self.namespace["get_supabase"] = lambda: client
        self.namespace["_is_guardian"] = lambda guardian, child: linked
        return self.namespace["onboarding_user_id"]("Bearer fixture")

    def test_adult_allowed(self):
        self.assertEqual(self.authorize(self.adult), "adult")

    def test_minor_without_approval_rejected(self):
        with self.assertRaises(HTTPException) as result:
            self.authorize(self.minor)
        self.assertEqual(result.exception.status_code, 403)

    def test_pending_rejected_and_approved_requires_live_link(self):
        self.minor.app_metadata.update({"managed_by_guardian": True, "guardian_id": "adult", "guardian_approval": {"state": "pending"}})
        with self.assertRaises(HTTPException):
            self.authorize(self.minor)
        self.minor.app_metadata["guardian_approval"] = {"state": "approved", "approved_by": "adult"}
        self.assertEqual(self.authorize(self.minor), "minor")
        with self.assertRaises(HTTPException):
            self.authorize(self.minor, linked=False)

    def test_user_editable_approval_is_not_authority(self):
        self.minor.user_metadata = {"managed_by_guardian": True, "guardian_id": "adult", "guardian_approval": {"state": "approved", "approved_by": "adult"}}
        with self.assertRaises(HTTPException):
            self.authorize(self.minor)

    def test_anonymous_rejected(self):
        with self.assertRaises(HTTPException) as result:
            self.namespace["onboarding_user_id"](None)
        self.assertEqual(result.exception.status_code, 401)

    def test_both_generation_routes_require_eligibility(self):
        root = Path(__file__).resolve().parents[1]
        module = ast.parse((root / "api/routes/onboarding.py").read_text())
        for function in module.body:
            if isinstance(function, ast.AsyncFunctionDef) and function.name in {"create_onboarding", "enqueue_onboarding"}:
                dependency = function.args.defaults[-1]
                self.assertEqual(dependency.args[0].id, "onboarding_user_id")


if __name__ == "__main__":
    unittest.main()