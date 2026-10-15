"""Reflection Analysis, the deterministic version (core/reflection_analysis.py),
and its hand-off to Adaptation (core/orchestrator.py). Fixtures only.

Run from backend/:  python -m unittest tests.test_reflection_analysis -v
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from core import reflection_analysis as ra
from core.agents.adaptation_agent import AdaptationAgent
from core.orchestrator import Orchestrator

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
DAY = timedelta(days=1)


def iso(dt):
    return dt.isoformat()


def milestone(mid, race="race_0", dim="education", order=0, days=2):
    return {"id": mid, "raceId": race, "dimension": dim, "order": order, "estimatedDays": days}


# A path made 5 days ago: two lanes of three 2-day milestones.
PATH = {"path_id": "p1", "is_active": True, "created_at": iso(NOW - 5 * DAY), "payload": {"races": [{"milestones": [
    milestone("e0", order=0), milestone("e1", order=1), milestone("e2", order=2),
    milestone("h0", dim="health", order=3), milestone("h1", dim="health", order=4), milestone("h2", dim="health", order=5),
]}]}}
OLD_PATH = {"path_id": "p0", "is_active": False, "created_at": iso(NOW - 40 * DAY), "payload": {"races": []}}


def analyze(**kw):
    rows = {"reflections": [], "ratings": [], "completions": [], "paths": [PATH, OLD_PATH], "adaptation_outcomes": 0}
    rows.update(kw)
    return ra.analyze(**rows, now=NOW)


class NoDataTests(unittest.TestCase):
    def test_no_entries_and_no_ratings_is_no_data_with_counts_only(self):
        result = analyze(completions=[{"milestone_id": "e0", "kind": "completed", "completed_at": iso(NOW - DAY)}])
        self.assertEqual(result["status"], "no_data")
        self.assertEqual(result["counts"], {"reflections": 0, "ratings": 0, "completions": 1})
        for key in ("ratings", "completion", "outcomes", "concerns", "themes"):
            self.assertNotIn(key, result)
        self.assertEqual(set(result), {"version", "status", "computed_at", "counts", "explanation"})

    def test_signed_out_or_no_database_reads_nothing(self):
        self.assertEqual(ra.analyze_person(None, "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10", now=NOW)["status"], "no_data")
        db = SimpleNamespace(table=lambda name: self.fail("must not read for a non-account id"))
        self.assertEqual(ra.analyze_person(db, "user_123", now=NOW)["status"], "no_data")

    def test_an_entry_being_written_counts(self):
        result = ra.analyze_person(None, "user_123", current_entry={"freeFormText": "fine"}, now=NOW)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["counts"]["reflections"], 1)


class RatingTests(unittest.TestCase):
    def test_latest_rating_per_milestone_path_scores_and_low_ones(self):
        ratings = [
            {"path_id": "p1", "milestone_id": "e0", "rating": 5, "created_at": iso(NOW - 3 * DAY)},
            {"path_id": "p1", "milestone_id": "e0", "rating": 2, "created_at": iso(NOW - DAY)},   # latest counts
            {"path_id": "p1", "milestone_id": "h1", "rating": 1, "created_at": iso(NOW - 2 * DAY)},
            {"path_id": "p1", "milestone_id": "h2", "rating": 4, "created_at": iso(NOW - 2 * DAY)},
            {"path_id": "p0", "milestone_id": "e0", "rating": 3, "created_at": iso(NOW - 30 * DAY)},  # same id, other path
        ]
        part = analyze(ratings=ratings)["ratings"]
        self.assertEqual(part["low_threshold"], 2)
        by_path = {p["path_id"]: p for p in part["by_path"]}
        self.assertEqual(by_path["p1"]["milestones"], {"e0": 2, "h1": 1, "h2": 4})
        self.assertEqual(by_path["p1"]["score"], round(((2 - 1) / 4 + 0 + (4 - 1) / 4) / 3, 3))
        self.assertEqual(by_path["p0"]["milestones"], {"e0": 3})
        self.assertEqual([(x["path_id"], x["milestone_id"], x["rating"]) for x in part["low"]],
                         [("p1", "e0", 2), ("p1", "h1", 1)])   # newest first


class CompletionTests(unittest.TestCase):
    def done(self, *ids, ago=1):
        return [{"milestone_id": i, "kind": "completed", "completed_at": iso(NOW - ago * DAY)} for i in ids]

    def test_against_the_paths_own_estimates(self):
        # 5 days in: each lane's first two 2-day milestones are due (2 and 4 days).
        part = analyze(ratings=[{"path_id": "p1", "milestone_id": "e0", "rating": 4, "created_at": iso(NOW)}],
                       completions=self.done("e0", "h0", "x9"))["completion"]
        self.assertEqual((part["path_id"], part["milestones"], part["completed"], part["expected_by_now"]), ("p1", 6, 2, 4))
        self.assertEqual((part["rate"], part["rate_status"]), (0.5, "known"))
        self.assertEqual(part["behind"], ["e1", "h1"])
        self.assertIn(part["next_up"], ("e2", "h2"))

    def test_hearts_are_not_completions(self):
        result = analyze(ratings=[{"path_id": "p1", "milestone_id": "e0", "rating": 4, "created_at": iso(NOW)}],
                         completions=[{"milestone_id": "e0", "kind": "hearted", "completed_at": iso(NOW)}])
        self.assertEqual(result["counts"]["completions"], 0)
        self.assertEqual(result["completion"]["completed"], 0)

    def test_unknown_until_two_milestones_are_due(self):
        young = dict(PATH, created_at=iso(NOW - 3 * DAY))   # only each lane's first is due
        part = analyze(paths=[young], ratings=[{"path_id": "p1", "milestone_id": "e0", "rating": 4, "created_at": iso(NOW)}])["completion"]
        self.assertEqual(part["expected_by_now"], 2)
        self.assertEqual(part["rate_status"], "known")
        newer = dict(PATH, created_at=iso(NOW - DAY))
        part = analyze(paths=[newer], ratings=[{"path_id": "p1", "milestone_id": "e0", "rating": 4, "created_at": iso(NOW)}])["completion"]
        self.assertEqual((part["expected_by_now"], part["rate"], part["rate_status"]), (0, None, "unknown"))

    def test_weeks_and_trend(self):
        completions = self.done("a", "b", ago=40) + self.done("c", ago=3)
        part = analyze(ratings=[{"path_id": "p1", "milestone_id": "e0", "rating": 4, "created_at": iso(NOW)}],
                       completions=completions)["completion"]
        self.assertEqual(len(part["by_week"]), ra.WEEKS)
        self.assertEqual(sum(w["completed"] for w in part["by_week"]), 3)
        self.assertEqual(part["trend"], "down")   # 2 in the earlier four weeks, 1 in the last four


class OutcomeAndConcernTests(unittest.TestCase):
    def test_outcomes_counted_from_the_stored_answer_and_this_entry(self):
        reflections = [
            {"created_at": iso(NOW - 2 * DAY), "reflection_response": {"explicitFeedback": {"outcome": "helped"}}},
            {"created_at": iso(NOW - 3 * DAY), "reflection_response": {}},
        ]
        result = ra.analyze(reflections=reflections, ratings=[], completions=[], paths=[], adaptation_outcomes=2,
                            current_entry={"learningFeedback": {"outcome": "made_worse"}}, now=NOW)
        self.assertEqual(result["outcomes"]["reflections"],
                         {"helped": 1, "no_change": 0, "made_worse": 1, "not_sure": 0, "unrecorded": 1})
        self.assertEqual(result["outcomes"]["adaptations"], {"recorded": 2})

    def test_concerns_in_the_last_two_weeks_with_what_they_were_about(self):
        reflections = [
            {"created_at": iso(NOW - 2 * DAY), "context_type": "milestone", "context_id": "e1",
             "free_form_text": "I am exhausted and it is all too much"},
            {"created_at": iso(NOW - 30 * DAY), "free_form_text": "burnout"},   # too old
        ]
        concerns = ra.analyze(reflections=reflections, ratings=[], completions=[], paths=[], now=NOW)["concerns"]
        self.assertEqual([(c["type"], c["context_type"], c["context_id"]) for c in concerns],
                         [("burnout_risk", "milestone", "e1")])

    def test_no_model_is_called(self):
        with patch("core.llm.complete_json", AsyncMock(side_effect=AssertionError("no model"))), \
             patch("core.llm.complete_text", AsyncMock(side_effect=AssertionError("no model"))):
            analyze(reflections=[{"created_at": iso(NOW), "free_form_text": "a hard week"}])


class HandOffTests(unittest.TestCase):
    """Adaptation receives exactly the analysis."""

    def test_the_graph_hands_adaptation_the_whole_analysis(self):
        analysis = {"version": ra.VERSION, "status": "ok", "counts": {}}
        seen = {}

        async def analyze_person(**kw):
            seen["analysis_args"] = kw
            return analysis

        async def adapt_path(**kw):
            seen["adapt_args"] = kw
            return {"needs_calendar_update": False}

        o = Orchestrator.__new__(Orchestrator)
        o.agents = {"reflection_analysis": SimpleNamespace(analyze_person=analyze_person),
                    "adaptation": SimpleNamespace(adapt_path=adapt_path)}
        state = {"user_id": "u1", "path_id": "p1", "reflection_data": {"freeFormText": "hi"}}
        state.update(asyncio.run(o._node_reflection_analysis(state)))
        asyncio.run(o._node_adaptation(state))
        self.assertEqual(seen["analysis_args"], {"user_id": "u1", "path_id": "p1", "current_entry": {"freeFormText": "hi"}})
        self.assertIs(seen["adapt_args"]["analysis"], analysis)
        self.assertEqual(set(seen["adapt_args"]), {"user_id", "path_id", "analysis"})

    def test_adaptation_takes_the_analysis_and_changes_nothing_yet(self):
        agent = AdaptationAgent()
        with patch("core.agents.adaptation_agent.llm.is_enabled", return_value=False):
            asyncio.run(agent.initialize())
            result = asyncio.run(agent.adapt_path(user_id="u1", path_id="p1",
                                                  analysis={"version": ra.VERSION, "status": "ok"}))
        self.assertEqual(result["adaptations"], [])
        self.assertEqual(result["analysis_version"], ra.VERSION)


class RouteTests(unittest.TestCase):
    def test_a_journal_entry_hands_over_and_keeps_its_answer(self):
        from api.routes import reflections as rr
        captured = {}

        async def adapt_path(**kw):
            captured["reflection_data"] = kw["reflection_data"]
            return {"agentResponses": [{"agentId": "reflection_analysis", "result": {"version": ra.VERSION}},
                                       {"agentId": "adaptation", "result": {"adaptations": []}}]}

        def persist(**kw):
            captured["stored"] = kw["reflection_response"]
            return "r1"

        request = rr.ReflectionRequest(contextType="milestone", contextId="e1", questions=[{"answer": "ok"}],
                                       freeFormText="ok", learningFeedback={"outcome": "not_sure", "completionRate": 0.4})
        with patch.object(rr, "_verified_user_id", return_value="8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"), \
             patch.object(rr, "_get_orchestrator", AsyncMock(return_value=SimpleNamespace(adapt_path=adapt_path))), \
             patch.object(rr.learning, "persist_reflection", side_effect=persist):
            asyncio.run(rr.create_reflection(request, authorization="Bearer x"))
        self.assertEqual(captured["reflection_data"]["learningFeedback"]["outcome"], "not_sure")
        self.assertEqual(captured["stored"]["explicitFeedback"]["outcome"], "not_sure")
        self.assertEqual(captured["stored"]["explicitFeedback"]["completionRate"], 0.4)
        self.assertEqual(captured["stored"]["version"], ra.VERSION)


if __name__ == "__main__":
    unittest.main()
