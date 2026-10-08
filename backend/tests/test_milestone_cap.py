"""The milestone cap in path planning (core/agents/path_planning_agent.py).

Run from backend/:  python -m unittest tests.test_milestone_cap -v
"""
import asyncio
import contextlib
import io
import unittest
from collections import Counter
from unittest.mock import AsyncMock, patch

from core.agents import path_planning_agent as ppa


class CapArithmeticTests(unittest.TestCase):
    def test_up_to_four_goals_are_untouched(self):
        for goals in range(1, 5):
            self.assertEqual(ppa.milestones_per_area(goals), 4)

    def test_more_goals_get_fewer_per_area_and_stay_under_the_cap(self):
        expected = {5: 3, 6: 2, 7: 2, 8: 2, 9: 1, 10: 1}
        for goals, per_area in expected.items():
            self.assertEqual(ppa.milestones_per_area(goals), per_area, goals)
            self.assertLessEqual(goals * ppa.LIFE_AREAS * per_area, ppa.MAX_MILESTONES_PER_PATH)

    def test_never_below_one_per_area(self):
        self.assertEqual(ppa.milestones_per_area(40), 1)
        self.assertEqual(ppa.milestones_per_area(0), 4)

    def test_the_last_check_trims_and_warns(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            kept = ppa.enforce_milestone_cap([{"id": i} for i in range(70)])
        self.assertEqual(len(kept), 64)
        self.assertEqual(kept[-1]["id"], 63)
        self.assertIn("WARNING: 70 milestones exceed the cap of 64", out.getvalue())
        self.assertEqual(len(ppa.enforce_milestone_cap([{"id": 1}])), 1)


class GenerationTests(unittest.TestCase):
    def setUp(self):
        self.agent = ppa.PathPlanningAgent()
        asyncio.run(self.agent.initialize())
        self.agent._enrich_descriptions_batch = AsyncMock(return_value={})

    def milestones(self, per_area, llm_answer=None):
        with patch.object(ppa.llm, "is_enabled", return_value=llm_answer is not None), \
             patch.object(ppa.llm, "complete_json", AsyncMock(return_value=llm_answer)), \
             contextlib.redirect_stdout(io.StringIO()):
            return asyncio.run(self.agent._generate_milestones_for_goal(
                goal="Get a job", goal_idx=0, barriers=[], strategies=[], similar_patterns=[],
                per_area=per_area))

    def test_templates_respect_the_count(self):
        ms = self.milestones(2)
        self.assertEqual(len(ms), 8)
        self.assertEqual(Counter(m["dimension"] for m in ms), {"education": 2, "workplace": 2, "relationships": 2, "health": 2})
        self.assertTrue(all(m["nameSource"] == "template" for m in ms))

    def test_generated_names_respect_the_count(self):
        answer = {area: [f"{area} {i}" for i in range(4)] for area in ("education", "workplace", "relationships", "health")}
        ms = self.milestones(1, answer)
        self.assertEqual([m["name"] for m in ms], ["education 0", "workplace 0", "relationships 0", "health 0"])
        self.assertTrue(all(m["nameSource"] == "generated" for m in ms))

    def test_the_prompt_asks_for_the_count_it_keeps(self):
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return None
        with patch.object(ppa.llm, "is_enabled", return_value=True), \
             patch.object(ppa.llm, "complete_json", side_effect=fake), \
             contextlib.redirect_stdout(io.StringIO()):
            asyncio.run(self.agent._generate_milestones_for_goal(
                goal="Get a job", goal_idx=0, barriers=[], strategies=[], similar_patterns=[], per_area=2))
        self.assertIn("2 concrete, actionable milestone names", captured["system"])
        self.assertIn('"health": ["...", "..."]', captured["user"])


if __name__ == "__main__":
    unittest.main()
