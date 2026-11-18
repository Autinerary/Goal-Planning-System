"""Saving, switching and deleting plans (api/routes/onboarding.py, user_paths): the person always keeps one active
plan, a save that fails fails the generation, and plans are read from the database rather than from a copy kept in
this process (bug audit, 17 November 2026, item 34).

Run from backend/:  python -m unittest tests.test_user_paths -v
"""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import auth_guard
from api.routes import onboarding, paths


class Query:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.excluded, self.ordered = {}, {}, None
        self.action, self.payload, self.on_conflict = "select", None, None

    def select(self, *_):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def neq(self, column, value):
        self.excluded[column] = value
        return self

    def order(self, column, desc=False):
        self.ordered = (column, desc)
        return self

    def limit(self, *_):
        return self

    def upsert(self, row, on_conflict=None, **_):
        self.action, self.payload, self.on_conflict = "upsert", dict(row), on_conflict
        return self

    def update(self, patch_):
        self.action, self.payload = "update", dict(patch_)
        return self

    def delete(self):
        self.action = "delete"
        return self

    def _hit(self, row):
        return (all(row.get(k) == v for k, v in self.filters.items())
                and all(row.get(k) != v for k, v in self.excluded.items()))

    def execute(self):
        self.db.log.append((self.table, self.action, dict(self.excluded)))
        if (self.table, self.action) in self.db.fail:
            raise RuntimeError(f"{self.table} {self.action} failed")
        rows = self.db.tables.setdefault(self.table, [])
        if self.action == "select":
            out = [dict(r) for r in rows if self._hit(r)]
            if self.ordered:
                out.sort(key=lambda r: str(r.get(self.ordered[0]) or ""), reverse=self.ordered[1])
            return SimpleNamespace(data=out)
        if self.action == "update":
            hit = [r for r in rows if self._hit(r)]
            for r in hit:
                r.update(self.payload)
            return SimpleNamespace(data=hit)
        if self.action == "delete":
            self.db.tables[self.table] = [r for r in rows if not self._hit(r)]
            return SimpleNamespace(data=[])
        keys = [k.strip() for k in (self.on_conflict or "").split(",") if k.strip()]
        for r in rows:
            if all(r.get(k) == self.payload.get(k) for k in keys):
                r.update(self.payload)
                break
        else:
            rows.append(dict(self.payload))
        return SimpleNamespace(data=[self.payload])


class DB:
    def __init__(self, plans=(), fail=()):
        self.tables = {"user_paths": [dict(p) for p in plans]}
        self.fail, self.log = set(fail), []

    def table(self, name):
        return Query(self, name)

    def active(self, user_id="u1"):
        return sorted(r["path_id"] for r in self.tables["user_paths"] if r["user_id"] == user_id and r.get("is_active"))


def plan(path_id, active=False, updated="2026-09-01", user_id="u1"):
    return {"user_id": user_id, "path_id": path_id, "is_active": active, "updated_at": updated,
            "payload": {"id": path_id, "userId": user_id}}


class Base(unittest.TestCase):
    def use(self, db):
        p = patch.object(onboarding, "get_supabase", lambda: db)
        p.start()
        self.addCleanup(p.stop)
        return db


class SaveTests(Base):
    def test_the_new_plan_is_written_first_then_the_others_made_inactive(self):
        db = self.use(DB([plan("p_old", active=True), plan("p_other", user_id="u2", active=True)]))
        onboarding._save_path("p_new", "u1", {"id": "p_new", "userId": "u1"})
        self.assertEqual(db.active(), ["p_new"])
        self.assertEqual(db.active("u2"), ["p_other"])          # nobody else's
        writes = [(t, a, ex) for t, a, ex in db.log if a in ("upsert", "update")]
        self.assertEqual(writes, [("user_paths", "upsert", {}), ("user_paths", "update", {"path_id": "p_new"})])

    def test_a_failed_save_raises_and_leaves_the_old_plan_active(self):
        db = self.use(DB([plan("p_old", active=True)], fail={("user_paths", "upsert")}))
        with self.assertRaises(RuntimeError):
            onboarding._save_path("p_new", "u1", {"id": "p_new", "userId": "u1"})
        self.assertEqual(db.active(), ["p_old"])
        self.assertNotIn(("user_paths", "upsert"), [(t, a) for t, a, _ in db.log[1:]])   # no second, legacy write

    def test_without_a_database_the_copy_here_is_the_store(self):
        self.use(None)
        onboarding._save_path("p_local", "u1", {"id": "p_local", "userId": "u1"})
        try:
            self.assertEqual(onboarding._load_path_by_id("p_local")["id"], "p_local")
        finally:
            onboarding.generated_paths.pop("p_local", None)


class SwitchAndDeleteTests(Base):
    def test_switching_to_a_plan_they_dont_have_changes_nothing(self):
        db = self.use(DB([plan("p1", active=True), plan("p2"), plan("theirs", user_id="u2")]))
        self.assertFalse(onboarding._set_active_path("u1", "nope"))
        self.assertFalse(onboarding._set_active_path("u1", "theirs"))
        self.assertEqual(db.active(), ["p1"])

    def test_switching_leaves_exactly_one_active(self):
        db = self.use(DB([plan("p1", active=True), plan("p2")]))
        self.assertTrue(onboarding._set_active_path("u1", "p2"))
        self.assertEqual(db.active(), ["p2"])
        self.assertTrue(onboarding._set_active_path("u1", "p2"))   # again: still the one
        self.assertEqual(db.active(), ["p2"])

    def test_deleting_the_active_plan_activates_the_newest_other(self):
        db = self.use(DB([plan("p1", updated="2026-09-01"), plan("p2", updated="2026-09-05"),
                          plan("p3", active=True, updated="2026-09-03")]))
        self.assertTrue(onboarding._delete_path("u1", "p3"))
        self.assertEqual(db.active(), ["p2"])

    def test_deleting_another_plan_leaves_the_active_one(self):
        db = self.use(DB([plan("p1", updated="2026-09-09"), plan("p2", active=True, updated="2026-09-01")]))
        self.assertTrue(onboarding._delete_path("u1", "p1"))
        self.assertEqual(db.active(), ["p2"])

    def test_deleting_the_last_plan_leaves_none(self):
        db = self.use(DB([plan("p1", active=True)]))
        self.assertTrue(onboarding._delete_path("u1", "p1"))
        self.assertEqual(db.tables["user_paths"], [])


class ReadTests(Base):
    def test_a_plan_is_read_from_the_database_not_a_copy(self):
        # The app's Next.js routes edit plans in the database; a copy kept here went stale.
        db = DB([plan("p1")])
        db.tables["user_paths"][0]["payload"] = {"id": "p1", "userId": "u1", "goals": ["edited in the app"]}
        self.use(db)
        onboarding.generated_paths["p1"] = {"id": "p1", "userId": "u1", "goals": ["old"]}
        try:
            self.assertEqual(onboarding._load_path_by_id("p1")["goals"], ["edited in the app"])
        finally:
            onboarding.generated_paths.pop("p1", None)

    def test_without_an_active_plan_the_most_recent(self):
        self.use(DB([plan("p1", updated="2026-09-01"), plan("p2", updated="2026-09-08"), plan("p3", updated="2026-09-04")]))
        self.assertEqual(onboarding._load_path_by_user("u1")["id"], "p2")

    def test_the_copy_kept_here_is_bounded(self):
        cache = onboarding._PathCache()
        with patch.object(onboarding, "CACHED_PATHS", 3):
            for i in range(10):
                cache[f"p{i}"] = {"id": i}
            cache["p8"] = {"id": "again"}       # used again: the newest
            cache["p10"] = {"id": 10}
        self.assertEqual(list(cache), ["p9", "p8", "p10"])

    def test_an_unknown_path_id_is_not_found(self):
        # It used to answer any id with a made-up "My Personal Path".
        self.use(DB([plan("p1")]))
        app = FastAPI()
        app.include_router(paths.router, prefix="/api/paths")
        app.dependency_overrides[auth_guard.current_user_id] = lambda: "u1"
        client = TestClient(app)
        self.assertEqual(client.get("/api/paths/nope").status_code, 404)
        self.assertEqual(client.get("/api/paths/p1").json()["id"], "p1")


if __name__ == "__main__":
    unittest.main()
