import ast
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException

from api.routes.social_access import as_self, connected, connected_ids, require_connected

ROOT = Path(__file__).resolve().parents[1]


class FakeTable:
    """Just enough of the Supabase query builder for social_connections."""

    def __init__(self, rows):
        self.rows, self.filters = rows, {}

    def select(self, _cols):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def limit(self, _n):
        return self

    def execute(self):
        data = [r for r in self.rows if all(str(r.get(k)) == str(v) for k, v in self.filters.items())]
        return SimpleNamespace(data=data)


class FakeClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return FakeTable(self.rows)


class SocialAccessTests(unittest.TestCase):
    def setUp(self):
        self.sb = FakeClient([
            {"id": "1", "owner_id": "a", "target_user_id": "b", "status": "connected"},
            {"id": "2", "owner_id": "c", "target_user_id": "a", "status": "connected"},
            {"id": "3", "owner_id": "a", "target_user_id": "d", "status": "pending"},
        ])

    def test_acting_as_yourself(self):
        self.assertEqual(as_self(None, "a"), "a")
        self.assertEqual(as_self("A", "a"), "a")

    def test_acting_as_someone_else_is_refused(self):
        with self.assertRaises(HTTPException) as caught:
            as_self("b", "a")
        self.assertEqual(caught.exception.status_code, 403)

    def test_connected_either_way(self):
        self.assertTrue(connected(self.sb, "a", "b"))
        self.assertTrue(connected(self.sb, "b", "a"))
        self.assertTrue(connected(self.sb, "a", "c"))

    def test_pending_is_not_connected(self):
        self.assertFalse(connected(self.sb, "a", "d"))
        with self.assertRaises(HTTPException) as caught:
            require_connected(self.sb, "a", "d")
        self.assertEqual(caught.exception.status_code, 403)

    def test_connected_ids(self):
        self.assertEqual(connected_ids(self.sb, "a"), ["b", "c"])

    def test_every_social_route_needs_a_session(self):
        # Each endpoint in these files must take actor = Depends(current_user_id).
        for name in ("messaging", "memes", "calls"):
            tree = ast.parse((ROOT / f"api/routes/{name}.py").read_text())
            routes = [
                f for f in ast.walk(tree)
                if isinstance(f, ast.AsyncFunctionDef)
                and any(isinstance(d, ast.Call) and getattr(d.func, "attr", "") in ("get", "post", "put", "patch", "delete") for d in f.decorator_list)
            ]
            self.assertTrue(routes, name)
            for route in routes:
                defaults = [ast.unparse(d) for d in route.args.defaults + route.args.kw_defaults if d is not None]
                self.assertIn("Depends(current_user_id)", defaults, f"{name}.{route.name} has no session check")


if __name__ == "__main__":
    unittest.main()
