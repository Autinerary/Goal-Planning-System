"""Adaptation offers (api/routes/adaptations.py, core/adaptation_rules.apply,
STEP 73): suggested on the person's own path, recorded once, and only Accept
changes the stored path. An in-memory database; no real path is touched.

Run from backend/:  python -m unittest tests.test_adaptation_offers -v
"""
import asyncio
import copy
import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from api.routes import adaptations as routes
from core import adaptation_rules as rules

USER = "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"
OTHER = "1c2d3e4f-0000-4a49-9f6a-5d1f6f5c2a10"
NOW = datetime.now(timezone.utc)


def ms(mid, dim, order, tasks=5):
    return {"id": mid, "name": f"Step {mid}", "raceId": "race_0", "dimension": dim, "order": order,
            "estimatedDays": 2, "status": "not_started", "tasks": [{"id": f"t_{mid}_{i}", "milestoneId": mid, "name": f"Task {i}"} for i in range(tasks)]}


def payload():
    milestones = [ms("e0", "education", 0), ms("e1", "education", 1), ms("e2", "education", 2),
                  ms("h0", "health", 3), ms("h1", "health", 4), ms("h2", "health", 5)]
    flat = [t for m in milestones for t in m["tasks"]]
    return {"id": "p1", "races": [{"id": "race_0", "milestones": copy.deepcopy(milestones)}],
            "path": {"milestones": copy.deepcopy([{k: v for k, v in m.items() if k != "tasks"} for m in milestones])},
            "agentResponses": [{"agentId": "path_planning", "result": {
                "milestones": copy.deepcopy([{k: v for k, v in m.items() if k != "tasks"} for m in milestones]),
                "tasks": flat}}]}


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.row, self.patch = db, table, {}, "select", None, None
        self.cols = "*"

    def select(self, cols="*", *_):
        self.cols = cols
        return self

    def eq(self, k, v):
        self.filters[k] = v
        return self

    def limit(self, *_):
        return self

    def order(self, *_, **__):
        return self

    def insert(self, row):
        self.op, self.row = "insert", dict(row)
        return self

    def update(self, patch):
        self.op, self.patch = "update", dict(patch)
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.table == "adaptation_outcomes" and self.db.missing_columns:
            raise RuntimeError("column adaptation_outcomes.suggestion_id does not exist")
        if self.table == "adaptation_outcomes" and self.db.missing_helped and "helped_" in str(getattr(self, "cols", "")):
            raise RuntimeError("column adaptation_outcomes.helped_first does not exist")
        if self.op == "insert":
            if self.table == "adaptation_outcomes" and any(
                    r.get("user_id") == self.row["user_id"] and r.get("suggestion_id") == self.row.get("suggestion_id")
                    for r in rows):
                raise RuntimeError("duplicate key value violates unique constraint (23505)")
            rows.append(self.row)
            return SimpleNamespace(data=[self.row])
        match = [r for r in rows if all(r.get(k) == v for k, v in self.filters.items())]
        if self.op == "update":
            for r in match:
                r.update(self.patch)
        return SimpleNamespace(data=match)


class FakeDB:
    def __init__(self, missing_columns=False, missing_helped=False):
        self.missing_columns, self.missing_helped = missing_columns, missing_helped
        self.tables = {
            "user_paths": [{"user_id": USER, "path_id": "p1", "is_active": True,
                            "created_at": (NOW - timedelta(days=5)).isoformat(), "payload": payload()}],
            "race_progress": [{"user_id": USER, "milestone_id": "e0", "kind": "completed",
                               "completed_at": (NOW - timedelta(days=1)).isoformat()}],
            "milestone_ratings": [{"user_id": USER, "path_id": "p1", "milestone_id": "e1", "rating": 1,
                                   "created_at": (NOW - timedelta(hours=2)).isoformat()}],
            "reflections": [], "adaptation_outcomes": [],
        }

    def table(self, name):
        return Query(self, name)

    def stored(self):
        return self.tables["user_paths"][0]["payload"]

    def offers(self):
        return [r for r in self.tables["adaptation_outcomes"] if r.get("suggestion_id")]


def call(fn, db, *args, user=USER, flag="true"):
    with patch.dict(os.environ, {"ADAPTATION_OFFERS_ENABLED": flag}), \
         patch.object(routes, "get_supabase", return_value=db):
        return asyncio.run(fn(*args, user_id=user))


def respond(db, sid, response, path_id="p1", user=USER):
    return call(routes.respond, db, sid, routes.ResponseIn(pathId=path_id, response=response), user=user)


class OfferTests(unittest.TestCase):
    def test_offered_once_and_named(self):
        db = FakeDB()
        first = call(routes.get_suggestions, db, "p1")
        self.assertTrue(first["available"])
        self.assertTrue(first["offers"])
        for o in first["offers"]:
            self.assertEqual(set(o), {"id", "rule", "milestone_id", "milestone_name", "text", "reason"})
        self.assertEqual(len(db.offers()), len(first["offers"]))
        row = db.offers()[0]
        self.assertTrue(row["offered_at"] and row["path_id"] == "p1" and row["milestone_id"])
        second = call(routes.get_suggestions, db, "p1")
        self.assertEqual(second["offers"], first["offers"])
        self.assertEqual(len(db.offers()), len(first["offers"]))   # no second record
        self.assertEqual(db.stored(), payload())                     # offering changes nothing

    def test_accept_applies_the_offered_change_and_only_then(self):
        db = FakeDB()
        offers = call(routes.get_suggestions, db, "p1")["offers"]
        behind = next(o for o in offers if o["rule"] == "behind_schedule")
        with patch("api.routes.onboarding.generated_paths", {"p1": {"cached": True}}) as cache:
            result = respond(db, behind["id"], "accept")
            self.assertNotIn("p1", cache)                             # the cached copy is dropped
        self.assertEqual(result, {"answered": True, "accepted": True})
        stored = db.stored()
        mid = behind["milestone_id"]
        race_m = next(m for m in stored["races"][0]["milestones"] if m["id"] == mid)
        flat = [t for t in stored["agentResponses"][0]["result"]["tasks"] if t["milestoneId"] == mid]
        self.assertEqual((len(race_m["tasks"]), len(flat)), (3, 3))
        row = next(r for r in db.offers() if r["suggestion_id"] == behind["id"])
        self.assertTrue(row["accepted_at"] and not row.get("dismissed_at"))
        again = respond(db, behind["id"], "accept")                   # no second change
        self.assertEqual(again, {"answered": True, "accepted": True})
        self.assertNotIn(behind["id"], [o["id"] for o in call(routes.get_suggestions, db, "p1")["offers"]])

    def test_not_now_changes_nothing_and_is_not_offered_again(self):
        db = FakeDB()
        offers = call(routes.get_suggestions, db, "p1")["offers"]
        before = copy.deepcopy(db.stored())
        result = respond(db, offers[0]["id"], "not_now")
        self.assertEqual(result, {"answered": True, "accepted": False})
        self.assertEqual(db.stored(), before)
        row = next(r for r in db.offers() if r["suggestion_id"] == offers[0]["id"])
        self.assertTrue(row["dismissed_at"] and not row.get("accepted_at"))
        self.assertNotIn(offers[0]["id"], [o["id"] for o in call(routes.get_suggestions, db, "p1")["offers"]])

    def test_only_your_own_offers_and_path(self):
        db = FakeDB()
        offers = call(routes.get_suggestions, db, "p1")["offers"]
        with self.assertRaises(HTTPException) as e:
            respond(db, offers[0]["id"], "accept", user=OTHER)
        self.assertEqual(e.exception.status_code, 404)
        with self.assertRaises(HTTPException) as e:
            call(routes.get_suggestions, db, "p1", user=OTHER)
        self.assertEqual(e.exception.status_code, 404)
        with self.assertRaises(HTTPException) as e:
            respond(db, "made-up", "accept")
        self.assertEqual(e.exception.status_code, 404)

    def test_off_by_default_and_before_the_migration(self):
        with self.assertRaises(HTTPException) as e:
            call(routes.get_suggestions, FakeDB(), "p1", flag="")
        self.assertEqual(e.exception.status_code, 404)
        db = FakeDB(missing_columns=True)
        self.assertEqual(call(routes.get_suggestions, db, "p1"), {"available": False, "offers": []})
        with self.assertRaises(HTTPException) as e:
            respond(db, "x", "accept")
        self.assertEqual(e.exception.status_code, 503)
        self.assertEqual(db.stored(), payload())

    def test_only_accept_or_not_now(self):
        with self.assertRaises(HTTPException) as e:
            respond(FakeDB(), "x", "maybe!")
        self.assertEqual(e.exception.status_code, 422)


class ApplyTests(unittest.TestCase):
    def test_move_later_moves_it_in_every_copy_and_nothing_else(self):
        out = rules.apply(payload(), "e0", {"moveLater": True})
        for lst in (out["races"][0]["milestones"], out["path"]["milestones"], out["agentResponses"][0]["result"]["milestones"]):
            self.assertEqual([m["id"] for m in lst], ["e1", "e2", "e0", "h0", "h1", "h2"])
        self.assertEqual(next(m for m in out["races"][0]["milestones"] if m["id"] == "e0")["order"], 3)
        self.assertEqual(payload()["races"][0]["milestones"][0]["id"], "e0")   # the input is untouched

    def test_start_now_and_refusals(self):
        out = rules.apply(payload(), "h1", {"status": "in_progress"})
        self.assertEqual(next(m for m in out["races"][0]["milestones"] if m["id"] == "h1")["status"], "in_progress")
        for mid, change in (("zz", {"status": "in_progress"}), ("e2", {"moveLater": True}), ("e1", {"delete": True})):
            with self.assertRaises(ValueError):
                rules.apply(payload(), mid, change)


if __name__ == "__main__":
    unittest.main()
