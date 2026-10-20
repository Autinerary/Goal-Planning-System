"""Run from backend/:  python -m unittest tests.test_profile_edit -v"""
import asyncio
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core import goal_steps, profile_edit  # noqa: E402


def plan():
    return {
        "userProfile": {"goals": ["Graduate university", "Get a job"], "dreams": ["Walk at graduation"], "currentChallenges": ["Mornings"], "barrierTypes": ["ADHD"]},
        "races": [
            {"id": "race_0", "name": "Graduate university", "goal": "Graduate university", "milestones": [{"id": "milestone_g0_education_0", "goal": "Graduate university"}]},
            {"id": "race_1", "name": "Get a job", "goal": "Get a job", "milestones": [{"id": "milestone_g1_workplace_0", "goal": "Get a job"}]},
        ],
        "agentResponses": [
            {"agentId": "path_planning", "result": {
                "milestones": [{"id": "milestone_g0_education_0", "goal": "Graduate university"}, {"id": "milestone_g1_workplace_0", "goal": "Get a job"}],
                "tasks": [{"id": "task_milestone_g0_education_0_0", "milestoneId": "milestone_g0_education_0"}],
            }},
            {"agentId": "tool_recommendation", "result": {"recommendations": {"milestone_g0_education_0": [{"name": "A"}]}}},
        ],
        "path": {"races": [], "milestones": []},
    }


class CleanTests(unittest.TestCase):
    def test_trims_dedupes_and_checks(self):
        edit = profile_edit.clean({
            "goals": [{"text": "  Graduate   University ", "from": "Graduate university", "area": "education"}, {"text": "", "area": "x"}, {"text": "Cook", "area": "nope"}],
            "dreams": ["A", "a", " B "],
            "obstacles": [],
            "ultimateDream": "  Live on my own  ",
        })
        self.assertEqual(edit["goals"], [
            {"text": "Graduate University", "from": "Graduate university", "area": "education"},
            {"text": "Cook", "from": None, "area": "other"},
        ])
        self.assertEqual(edit["dreams"], ["A", "B"])
        self.assertEqual(edit["ultimateDream"], "Live on my own")

    def test_refuses_what_cannot_be_saved(self):
        with self.assertRaises(profile_edit.EditError):
            profile_edit.clean({"goals": []})
        with self.assertRaises(profile_edit.EditError):
            profile_edit.clean({"goals": [{"text": "Same"}, {"text": "same"}]})
        with self.assertRaises(profile_edit.EditError):
            profile_edit.clean({"goals": [{"text": f"g{i}"} for i in range(11)]})


class ApplyTests(unittest.TestCase):
    def test_rename_keeps_the_race_and_steps(self):
        edit = profile_edit.clean({"goals": [
            {"text": "Graduate from university", "from": "Graduate university", "area": "education"},
            {"text": "Get a job", "from": "Get a job", "area": "career"},
        ], "dreams": ["Walk at graduation"], "obstacles": ["Mornings"], "ultimateDream": "A calm life"})
        out = profile_edit.apply(plan(), edit, now="T")
        self.assertEqual(out["races"][0]["name"], "Graduate from university")
        self.assertEqual(out["races"][0]["goal"], "Graduate from university")
        self.assertEqual(out["races"][0]["milestones"][0]["goal"], "Graduate from university")
        self.assertEqual(out["agentResponses"][0]["result"]["milestones"][0]["goal"], "Graduate from university")
        self.assertEqual(out["userProfile"]["goals"], ["Graduate from university", "Get a job"])
        self.assertEqual(out["userProfile"]["goalCategories"], {"Graduate from university": "education", "Get a job": "career"})
        self.assertEqual(out["userProfile"]["ultimateDream"], "A calm life")
        self.assertEqual(out["userProfile"]["hiddenGoals"], [])
        self.assertEqual(out["userProfile"]["updatedAt"], "T")
        # The stored plan isn't changed in place.
        self.assertEqual(plan()["races"][0]["name"], "Graduate university")

    def test_taking_a_goal_out_hides_it_and_adding_it_back_shows_it(self):
        out = profile_edit.apply(plan(), profile_edit.clean({"goals": [{"text": "Get a job", "from": "Get a job", "area": "career"}]}))
        self.assertEqual(out["userProfile"]["goals"], ["Get a job"])
        self.assertEqual(out["userProfile"]["hiddenGoals"], ["Graduate university"])
        # Nothing deleted: its race and steps are still in the plan.
        self.assertEqual(len(out["races"]), 2)
        back = profile_edit.apply(out, profile_edit.clean({"goals": [{"text": "Get a job", "from": "Get a job"}, {"text": "graduate university"}]}))
        self.assertEqual(back["userProfile"]["hiddenGoals"], [])

    def test_new_goals_have_no_steps_yet(self):
        out = profile_edit.apply(plan(), profile_edit.clean({"goals": [
            {"text": "Graduate university", "from": "Graduate university"}, {"text": "Get a job", "from": "Get a job"}, {"text": "Eat healthier", "area": "health"},
        ]}))
        self.assertEqual(profile_edit.goals_without_steps(out), ["Eat healthier"])


class GoalStepsTests(unittest.TestCase):
    planning = {
        "milestones": [
            {"id": "milestone_g0_health_0", "raceId": "race_0", "name": "Plan meals", "goal": "eat healthier",
             "recommendedChoices": [{"id": "choice_milestone_g0_health_0_1"}]},
        ],
        "tasks": [{"id": "task_milestone_g0_health_0_0", "milestoneId": "milestone_g0_health_0", "name": "List meals"}],
    }
    tools = {"recommendations": {"milestone_g0_health_0": [{"name": "Food bank"}]}, "pit_stop_tools": {}}

    def test_next_index_and_has_steps(self):
        self.assertEqual(goal_steps.next_goal_index(plan()), 2)
        self.assertEqual(goal_steps.next_goal_index({}), 0)
        self.assertTrue(goal_steps.has_steps(plan(), "get a job"))
        self.assertFalse(goal_steps.has_steps(plan(), "Eat healthier"))

    def test_merge_adds_one_race_with_its_own_ids(self):
        p = plan()
        p["userProfile"]["goals"].append("Eat healthier")
        p["races"].append({"id": "race_x", "name": "Eat healthier", "goal": "Eat healthier", "milestones": []})
        out = goal_steps.merge_goal(p, "Eat healthier", self.planning, self.tools)
        race = out["races"][-1]
        self.assertEqual([r["name"] for r in out["races"]], ["Graduate university", "Get a job", "Eat healthier"])
        self.assertEqual(race["id"], "race_2")
        self.assertEqual(race["milestones"][0]["id"], "milestone_g2_health_0")
        self.assertEqual(race["milestones"][0]["goal"], "Eat healthier")
        self.assertEqual(race["milestones"][0]["tasks"][0]["milestoneId"], "milestone_g2_health_0")
        self.assertEqual(race["milestones"][0]["recommendedChoices"][0]["id"], "choice_milestone_g2_health_0_1")
        planning = out["agentResponses"][0]["result"]
        self.assertEqual([m["id"] for m in planning["milestones"]][-1], "milestone_g2_health_0")
        self.assertEqual(planning["tasks"][-1]["id"], "task_milestone_g2_health_0_0")
        self.assertIn("milestone_g2_health_0", out["agentResponses"][1]["result"]["recommendations"])
        self.assertIn("milestone_g0_education_0", out["agentResponses"][1]["result"]["recommendations"])
        self.assertEqual(out["path"]["races"], out["races"])
        # The planner's own copy wasn't renumbered in place, and asking twice changes nothing.
        self.assertEqual(self.planning["milestones"][0]["id"], "milestone_g0_health_0")
        self.assertIs(goal_steps.merge_goal(out, "Eat healthier", self.planning, self.tools), out)

    def test_plan_goal_sizes_the_goal_for_the_whole_plan(self):
        seen = {}

        class Planner:
            async def initialize(self): pass
            async def cleanup(self): pass
            async def generate_path(self, **kwargs):
                seen.update(kwargs)
                return {"milestones": [], "tasks": []}

        class Tools:
            async def initialize(self): pass
            async def cleanup(self): pass
            async def recommend_tools(self, **kwargs): return {"recommendations": {}}

        p = plan()
        p["userProfile"]["goals"] += ["a", "b", "c"]  # five goals
        with mock.patch("core.agents.path_planning_agent.PathPlanningAgent", Planner), \
                mock.patch("core.agents.tool_recommendation_agent.ToolRecommendationAgent", Tools), \
                mock.patch("core.memory.load_user_memory", lambda uid: {}):
            asyncio.run(goal_steps.plan_goal(p, "Eat healthier", "u1"))
        self.assertEqual(seen["goals"], ["Eat healthier"])
        self.assertEqual(seen["barriers"], ["ADHD"])
        self.assertEqual(seen["per_area"], 3)  # 64 // (4 areas * 5 goals)


class SetupGoalCategoriesTests(unittest.TestCase):
    def test_only_the_plans_goals_with_known_areas(self):
        from api.routes.onboarding import clean_goal_categories
        self.assertEqual(
            clean_goal_categories({"graduate ": "education", "Get a job": "career", "Other": "nope", "Not mine": "health"}, ["Graduate", "Get a job", "Other"]),
            {"Graduate": "education", "Get a job": "career"},
        )
        self.assertEqual(clean_goal_categories(None, ["x"]), {})


if __name__ == "__main__":
    unittest.main()
