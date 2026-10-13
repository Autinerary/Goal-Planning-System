"""Adaptation reads the analysis (core/adaptation_rules.py,
core/agents/adaptation_agent.py). Fixtures only: nothing is applied to any
stored path.

Run from backend/:  python -m unittest tests.test_adaptation_rules -v
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from core import adaptation_rules as rules
from core import reflection_analysis as ra
from core.agents.adaptation_agent import AdaptationAgent

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
DAY = timedelta(days=1)


def ok(rate=None, rate_status="unknown", low=(), concerns=()):
    return {"version": ra.VERSION, "status": "ok",
            "completion": {"rate": rate, "rate_status": rate_status, "expected_by_now": 4, "completed": 1},
            "ratings": {"low": list(low)}, "concerns": list(concerns)}


def fired(analysis):
    return [f["rule"] for f in rules.decide(analysis)]


class DecideTests(unittest.TestCase):
    def test_no_data_fires_nothing(self):
        self.assertEqual(fired({"version": ra.VERSION, "status": "no_data", "counts": {}}), [])
        self.assertEqual(fired(None), [])

    def test_an_unknown_rate_is_never_read_as_a_number(self):
        self.assertEqual(fired(ok(rate=None, rate_status="unknown")), [])
        self.assertEqual(fired(ok(rate=0.1, rate_status="unknown")), [])   # only a known rate counts

    def test_completion_thresholds(self):
        self.assertEqual(fired(ok(0.25, "known")), ["behind_schedule"])
        self.assertEqual(fired(ok(0.5, "known")), [])
        self.assertEqual(fired(ok(0.65, "known")), [])   # the old constant: nothing either way
        self.assertEqual(fired(ok(0.8, "known")), [])
        self.assertEqual(fired(ok(0.9, "known")), ["ahead_of_schedule"])

    def test_low_ratings_and_stress(self):
        low = [{"path_id": "p1", "milestone_id": "e1", "rating": 1, "rated_at": "2026-10-12"}]
        self.assertEqual(fired(ok(low=low)), ["rated_low"])
        self.assertEqual(fired(ok(concerns=[{"type": "burnout_risk"}])), ["stress"])
        self.assertEqual(fired(ok(concerns=[{"type": "isolation"}])), [])   # not a stress concern


def path(days_ago=5):
    ms = [{"id": f"{d}{i}", "raceId": "race_0", "dimension": dim, "order": n, "estimatedDays": 2}
          for n, (dim, d, i) in enumerate([("education", "e", 0), ("education", "e", 1), ("education", "e", 2),
                                           ("health", "h", 0), ("health", "h", 1), ("health", "h", 2)])]
    return {"path_id": "p1", "is_active": True, "created_at": (NOW - days_ago * DAY).isoformat(),
            "payload": {"races": [{"milestones": ms}]}}


class FromStoredRowsTests(unittest.TestCase):
    """End to end on fixtures: stored rows -> analysis -> the rules."""

    def analysis(self, done, days_ago=5):
        rating = [{"path_id": "p1", "milestone_id": "e0", "rating": 4, "created_at": NOW.isoformat()}]
        completions = [{"milestone_id": m, "kind": "completed", "completed_at": (NOW - DAY).isoformat()} for m in done]
        return ra.analyze(reflections=[], ratings=rating, completions=completions, paths=[path(days_ago)], now=NOW)

    def test_behind_fires_where_it_should(self):
        self.assertEqual(fired(self.analysis(["e0"])), ["behind_schedule"])        # 1 of 4 due

    def test_on_track_fires_nothing(self):
        self.assertEqual(fired(self.analysis(["e0", "h0", "e1"])), [])           # 3 of 4: 0.75

    def test_ahead_fires_where_it_should(self):
        self.assertEqual(fired(self.analysis(["e0", "h0", "e1", "h1"])), ["ahead_of_schedule"])

    def test_too_early_to_tell_fires_nothing(self):
        self.assertEqual(fired(self.analysis([], days_ago=1)), [])                # nothing due yet


class AgentTests(unittest.TestCase):
    def adapt(self, analysis):
        agent = AdaptationAgent()
        with patch("core.agents.adaptation_agent.llm.is_enabled", return_value=False):
            asyncio.run(agent.initialize())
            return asyncio.run(agent.adapt_path(user_id="u1", path_id="p1", analysis=analysis))

    def test_the_agent_reports_what_fired_and_changes_nothing(self):
        result = self.adapt(ok(0.25, "known"))
        self.assertEqual([a["rule"] for a in result["adaptations"]], ["behind_schedule"])
        self.assertEqual((result["updated_milestones"], result["updated_tasks"], result["needs_calendar_update"]),
                         ([], [], False))
        self.assertIsNone(result["confidence"])

    def test_no_data_does_nothing(self):
        result = self.adapt({"version": ra.VERSION, "status": "no_data", "counts": {}})
        self.assertEqual(result["adaptations"], [])
        self.assertIn("no journal entry or rating", result["explanation"])


if __name__ == "__main__":
    unittest.main()
