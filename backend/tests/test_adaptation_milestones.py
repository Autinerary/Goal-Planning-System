"""Every adaptation names one milestone, by path id and milestone id, or is
not produced (core/adaptation_rules.py, suggestions). Fixtures only.

Run from backend/:  python -m unittest tests.test_adaptation_milestones -v
"""
import asyncio
import copy
import unittest
from unittest.mock import patch

from core import adaptation_rules as rules
from core import reflection_analysis as ra
from core.agents.adaptation_agent import AdaptationAgent


def task(mid, i):
    return {"id": f"task_{mid}_{i}", "milestoneId": mid, "name": f"Task {i} of {mid}"}


def ms(mid, dim, order, tasks=5, status="not_started"):
    return {"id": mid, "name": f"Step {mid}", "raceId": "race_0", "dimension": dim, "order": order,
            "status": status, "tasks": [task(mid, i) for i in range(tasks)]}


PAYLOAD = {"id": "p1", "races": [{"id": "race_0", "milestones": [
    ms("e0", "education", 0), ms("e1", "education", 1), ms("e2", "education", 2),
    ms("h0", "health", 3), ms("h1", "health", 4, tasks=3), ms("h2", "health", 5, status="in_progress"),
]}]}


def analysis(rate=None, behind=(), next_up=None, low=(), concerns=(), path_id="p1"):
    return {"version": ra.VERSION, "status": "ok",
            "completion": {"path_id": path_id, "rate": rate, "rate_status": "known" if rate is not None else "unknown",
                           "expected_by_now": 4, "completed": 1, "behind": list(behind), "next_up": next_up},
            "ratings": {"low": list(low)}, "concerns": list(concerns)}


def named(a, payload=PAYLOAD, done=()):
    return rules.suggestions(a, payload, "p1", done)


class NamingTests(unittest.TestCase):
    def assert_named_in_path(self, out):
        ids = {m["id"] for r in PAYLOAD["races"] for m in r["milestones"]}
        for s in out:
            self.assertEqual(s["path_id"], "p1")
            self.assertIn(s["milestone_id"], ids)
            self.assertTrue(s["text"] and s["reason"] and s["id"])

    def test_behind_makes_the_earliest_overdue_step_lighter(self):
        out = named(analysis(rate=0.25, behind=["e1", "h1"]))
        self.assertEqual([(s["rule"], s["milestone_id"], s["change"]) for s in out],
                         [("behind_schedule", "e1", {"keepTasks": 3})])
        self.assertEqual([t["id"] for t in out[0]["before"]["tasksSetAside"]], ["task_e1_3", "task_e1_4"])
        self.assertIn("keep its first 3 tasks and set the other 2 aside", out[0]["text"])
        self.assert_named_in_path(out)

    def test_a_step_already_light_is_skipped_and_done_steps_too(self):
        self.assertEqual(named(analysis(rate=0.25, behind=["h1"])), [])            # 3 tasks: nothing to set aside
        self.assertEqual(named(analysis(rate=0.25, behind=["e1"]), done=["e1"]), [])

    def test_ahead_starts_the_next_step_only_if_not_begun(self):
        out = named(analysis(rate=0.9, next_up="e2"))
        self.assertEqual([(s["rule"], s["milestone_id"], s["change"]) for s in out],
                         [("ahead_of_schedule", "e2", {"status": "in_progress"})])
        self.assertEqual(named(analysis(rate=0.9, next_up="h2")), [])               # already in progress

    def test_completion_rules_name_nothing_on_another_path(self):
        self.assertEqual(named(analysis(rate=0.25, behind=["e1"], path_id="p9")), [])

    def test_a_low_rating_names_its_step_on_this_path_only(self):
        low = [{"path_id": "p0", "milestone_id": "e0", "rating": 1, "rated_at": "2026-10-12"},   # same id, other path
               {"path_id": "p1", "milestone_id": "e2", "rating": 1, "rated_at": "2026-10-11"},   # last in its part
               {"path_id": "p1", "milestone_id": "h0", "rating": 2, "rated_at": "2026-10-10"}]
        out = named(analysis(low=low))
        self.assertEqual([(s["rule"], s["milestone_id"], s["change"]) for s in out],
                         [("rated_low", "h0", {"moveLater": True})])
        self.assertIn("“A little”", out[0]["text"])
        self.assertIn("10 October", out[0]["reason"])

    def test_stress_names_the_step_the_entry_was_about_or_nothing(self):
        about = {"type": "burnout_risk", "at": "2026-10-12T09:00:00+00:00", "context_type": "milestone", "context_id": "e0"}
        out = named(analysis(concerns=[about]))
        self.assertEqual([(s["rule"], s["milestone_id"], s["change"]) for s in out], [("stress", "e0", {"moveLater": True})])
        calendar = dict(about, context_type="calendar", context_id="default")
        self.assertEqual(named(analysis(concerns=[calendar])), [])

    def test_one_suggestion_per_step_in_order_and_at_most_three(self):
        about = {"type": "burnout_risk", "at": "2026-10-12", "context_type": "milestone", "context_id": "e1"}
        low = [{"path_id": "p1", "milestone_id": "e1", "rating": 1, "rated_at": "2026-10-12"},
               {"path_id": "p1", "milestone_id": "h0", "rating": 1, "rated_at": "2026-10-11"}]
        out = named(analysis(rate=0.25, behind=["e1", "e0"], concerns=[about], low=low))
        self.assertEqual([(s["rule"], s["milestone_id"]) for s in out],
                         [("stress", "e1"), ("behind_schedule", "e0"), ("rated_low", "h0")])
        self.assertEqual(len({s["milestone_id"] for s in out}), len(out))
        self.assert_named_in_path(out)

    def test_the_same_suggestion_keeps_its_id(self):
        a = analysis(rate=0.25, behind=["e1"])
        self.assertEqual(named(a)[0]["id"], named(copy.deepcopy(a))[0]["id"])
        self.assertEqual(named(a)[0]["id"], rules.suggestion_id("behind_schedule", "p1", "e1"))

    def test_nothing_is_changed_by_naming(self):
        payload = copy.deepcopy(PAYLOAD)
        named(analysis(rate=0.25, behind=["e1"]), payload=payload)
        self.assertEqual(payload, PAYLOAD)


class AgentTests(unittest.TestCase):
    def test_the_agent_returns_named_suggestions_and_the_rules_that_named_none(self):
        agent = AdaptationAgent()
        with patch("core.agents.adaptation_agent.llm.is_enabled", return_value=False):
            asyncio.run(agent.initialize())
            result = asyncio.run(agent.adapt_path(
                user_id="u1", path_id="ignored", analysis=analysis(rate=0.25, behind=["h1"], next_up=None,
                low=[{"path_id": "p1", "milestone_id": "h0", "rating": 1, "rated_at": "2026-10-12"}]),
                path=PAYLOAD, done_ids=[]))
        self.assertEqual([(a["rule"], a["milestone_id"]) for a in result["adaptations"]], [("rated_low", "h0")])
        self.assertEqual(result["unnamed_rules"], ["behind_schedule"])   # h1 has only 3 tasks


if __name__ == "__main__":
    unittest.main()
