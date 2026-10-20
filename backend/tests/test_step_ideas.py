"""Steps picked from a Path Market model reach the planner for their goal
(the team's notes, October 2026: "smaller suggestions for milestones").
Run from backend/:  python -m unittest tests.test_step_ideas -v"""
import asyncio
import unittest
from unittest import mock

from api.routes.onboarding import clean_step_ideas
from core.agents import path_planning_agent as ppa
from core.agents.path_planning_agent import PathPlanningAgent


class CleanStepIdeasTests(unittest.TestCase):
    def test_only_the_plans_goals_short_and_distinct(self):
        out = clean_step_ideas(
            {"graduate ": ["Pre-med prerequisites", "pre-med prerequisites", " ", "x" * 200] + [f"s{i}" for i in range(10)],
             "Not mine": ["a"], "Get a job": "not a list"},
            ["Graduate", "Get a job"],
        )
        self.assertEqual(list(out), ["Graduate"])
        self.assertEqual(out["Graduate"][0], "Pre-med prerequisites")
        self.assertEqual(len(out["Graduate"][1]), 120)
        self.assertEqual(len(out["Graduate"]), 8)
        self.assertEqual(clean_step_ideas(None, ["x"]), {})


class PlannerPromptTests(unittest.TestCase):
    def test_the_ideas_are_in_the_prompt_fenced(self):
        seen = {}

        async def fake(**kwargs):
            seen.setdefault("user", kwargs["user"])
            return None

        agent = PathPlanningAgent()
        asyncio.run(agent.initialize())
        with mock.patch.object(ppa.llm, "is_enabled", return_value=True), \
                mock.patch.object(ppa.llm, "complete_json", side_effect=fake), \
                mock.patch.object(ppa.llm, "complete_text", side_effect=fake):
            asyncio.run(agent._generate_milestones_for_goal(
                goal="Graduate", goal_idx=0, barriers=["ADHD"], strategies=[], similar_patterns=[],
                step_ideas=["Pre-med prerequisites", "Grad-school applications"],
            ))
        self.assertIn("Steps the user picked from a path model", seen["user"])
        self.assertIn("<user_text>Pre-med prerequisites, Grad-school applications</user_text>", seen["user"])

    def test_no_ideas_no_line(self):
        seen = {}

        async def fake(**kwargs):
            seen.setdefault("user", kwargs["user"])
            return None

        agent = PathPlanningAgent()
        asyncio.run(agent.initialize())
        with mock.patch.object(ppa.llm, "is_enabled", return_value=True), \
                mock.patch.object(ppa.llm, "complete_json", side_effect=fake), \
                mock.patch.object(ppa.llm, "complete_text", side_effect=fake):
            asyncio.run(agent._generate_milestones_for_goal(goal="Graduate", goal_idx=0, barriers=[], strategies=[], similar_patterns=[]))
        self.assertNotIn("picked from a path model", seen["user"])


if __name__ == "__main__":
    unittest.main()
