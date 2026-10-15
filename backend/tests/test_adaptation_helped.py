"""'Did that help?' after an accepted change (api/routes/adaptations.py,
STEP 74): asked once after Accept, once more on the first Path visit 7 days
or more later, no scheduled job, both answers kept. In-memory database only.

Run from backend/:  python -m unittest tests.test_adaptation_helped -v
"""
import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from api.routes import adaptations as routes
from tests.test_adaptation_offers import FakeDB, call, respond


def helped(db, sid, answer):
    return call(routes.helped, db, sid, routes.HelpedIn(pathId="p1", answer=answer))


def accepted_offer(db):
    offer = call(routes.get_suggestions, db, "p1")["offers"][0]
    respond(db, offer["id"], "accept")
    return offer


def age(db, sid, days):
    row = next(r for r in db.offers() if r["suggestion_id"] == sid)
    row["accepted_at"] = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


class AskDueTests(unittest.TestCase):
    now = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)

    def due(self, **row):
        return routes.ask_due({"_asks": True, **row}, now=self.now)

    def test_when_each_question_is_due(self):
        self.assertIsNone(self.due())                                                        # not accepted
        self.assertEqual(self.due(accepted_at="2026-10-13T11:00:00+00:00"), "first")
        self.assertIsNone(self.due(accepted_at="2026-10-13T11:00:00+00:00", helped_first="yes"))
        self.assertEqual(self.due(accepted_at="2026-10-06T12:00:00+00:00", helped_first="yes"), "second")
        self.assertEqual(self.due(accepted_at="2026-10-01T12:00:00+00:00"), "second")       # first never answered
        self.assertIsNone(self.due(accepted_at="2026-10-01T12:00:00+00:00", helped_second="no"))
        self.assertIsNone(routes.ask_due({"accepted_at": "2026-10-13T11:00:00+00:00"}))    # STEP 74 not applied


class HelpedTests(unittest.TestCase):
    def test_asked_after_accept_then_a_week_later(self):
        db = FakeDB()
        offer = accepted_offer(db)
        asks = call(routes.get_suggestions, db, "p1")["asks"]
        self.assertEqual([(a["id"], a["ask"]) for a in asks], [(offer["id"], "first")])
        self.assertEqual(helped(db, offer["id"], "yes"), {"saved": True, "ask": "first", "answer": "yes"})
        self.assertEqual(call(routes.get_suggestions, db, "p1")["asks"], [])               # asked once
        age(db, offer["id"], 8)                                                              # the next visit, a week on
        asks = call(routes.get_suggestions, db, "p1")["asks"]
        self.assertEqual([(a["id"], a["ask"]) for a in asks], [(offer["id"], "second")])
        self.assertEqual(asks[0]["milestone_name"], offer["milestone_name"])
        self.assertEqual(helped(db, offer["id"], "no")["ask"], "second")
        self.assertEqual(call(routes.get_suggestions, db, "p1")["asks"], [])
        row = next(r for r in db.offers() if r["suggestion_id"] == offer["id"])
        self.assertEqual((row["helped_first"], row["helped_second"]), ("yes", "no"))
        self.assertTrue(row["helped_first_at"] and row["helped_second_at"])
        with self.assertRaises(HTTPException) as e:
            helped(db, offer["id"], "yes")                                                   # nothing more is due
        self.assertEqual(e.exception.status_code, 409)

    def test_a_first_answer_never_given_leaves_only_the_second(self):
        db = FakeDB()
        offer = accepted_offer(db)
        age(db, offer["id"], 9)
        self.assertEqual([a["ask"] for a in call(routes.get_suggestions, db, "p1")["asks"]], ["second"])
        helped(db, offer["id"], "yes")
        row = next(r for r in db.offers() if r["suggestion_id"] == offer["id"])
        self.assertEqual((row.get("helped_first"), row["helped_second"]), (None, "yes"))

    def test_only_after_accepting_and_only_yes_or_no(self):
        db = FakeDB()
        offers = call(routes.get_suggestions, db, "p1")["offers"]
        with self.assertRaises(HTTPException) as e:
            helped(db, offers[0]["id"], "yes")                                               # not accepted
        self.assertEqual(e.exception.status_code, 409)
        respond(db, offers[0]["id"], "not_now")
        with self.assertRaises(HTTPException) as e:
            helped(db, offers[0]["id"], "yes")                                               # dismissed
        self.assertEqual(e.exception.status_code, 409)
        with self.assertRaises(HTTPException) as e:
            helped(db, "made-up", "yes")
        self.assertEqual(e.exception.status_code, 404)
        with self.assertRaises(HTTPException) as e:
            helped(db, offers[0]["id"], "meh")
        self.assertEqual(e.exception.status_code, 422)

    def test_offers_still_work_before_step_74(self):
        db = FakeDB(missing_helped=True)
        offer = accepted_offer(db)
        result = call(routes.get_suggestions, db, "p1")
        self.assertTrue(result["available"])
        self.assertEqual(result["asks"], [])
        with self.assertRaises(HTTPException) as e:
            helped(db, offer["id"], "yes")
        self.assertEqual(e.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
