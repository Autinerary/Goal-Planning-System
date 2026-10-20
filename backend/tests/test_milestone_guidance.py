"""Run from backend/:  python -m unittest tests.test_milestone_guidance -v"""
import asyncio
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core import llm  # noqa: E402
from core import milestone_guidance as guide  # noqa: E402


def plan(**profile):
    return {
        "userProfile": {"barrierTypes": ["ADHD"], "currentChallenges": ["Mornings"], **profile},
        "races": [
            {"milestones": [
                {"id": "m1", "name": "Ask for accommodations", "dimension": "education", "goal": "Graduate",
                 "tasks": [{"name": "Email the office", "helperTricks": ["Set a 15-minute timer and just start"]}]},
                {"id": "m2", "name": "Update my resume", "dimension": "workplace", "goal": "Get a job"},
            ]},
        ],
        "agentResponses": [
            {"agentId": "path_planning", "result": {
                "milestones": [{"id": "m1", "name": "Ask for accommodations"}, {"id": "m3", "name": "Join a club", "dimension": "relationships"}],
                "tasks": [{"milestoneId": "m3", "name": "Find two clubs", "helperTricks": ["Go with a friend"]}],
            }},
        ],
    }


class PlanMilestonesTests(unittest.TestCase):
    def test_each_milestone_once_with_its_tasks(self):
        ms = guide.plan_milestones(plan())
        self.assertEqual([m["id"] for m in ms], ["m1", "m2", "m3"])
        self.assertEqual(ms[0]["tasks"][0]["name"], "Email the office")
        self.assertEqual(ms[2]["tasks"][0]["name"], "Find two clubs")

    def test_stale_when_missing_or_renamed(self):
        p = plan()
        ms = guide.plan_milestones(p)
        p["milestoneGuidance"] = {
            "m1": {"name": "Ask for accommodations", "avoid": ["a"], "tips": []},
            "m2": {"name": "Old name", "avoid": ["a"], "tips": []},
        }
        self.assertEqual([m["id"] for m in guide.stale(p, ms)], ["m2", "m3"])


class GeneralGuidanceTests(unittest.TestCase):
    def test_own_words_first_then_the_kind_of_step(self):
        p = plan(supportContext={"strategiesNotWorked": "All-nighters"})
        g = guide.general_guidance(guide.plan_milestones(p)[0], guide._person(p))
        self.assertEqual(g["source"], "general")
        self.assertEqual(len(g["avoid"]), 5)
        self.assertEqual(g["avoid"][0], "Going back to what didn't work before: All-nighters")
        self.assertIn("Mornings", g["avoid"][1])
        self.assertIn("Waiting until exams to ask about accommodations", g["avoid"])
        # The step's own helper tricks come first among the tips.
        self.assertEqual(g["tips"][0], "Set a 15-minute timer and just start")
        self.assertLessEqual(len(g["tips"]), 5)

    def test_unknown_area_is_general(self):
        g = guide.general_guidance({"id": "x", "name": "Something", "dimension": "barrier"}, guide._person({}))
        self.assertEqual(g["avoid"][0], "Trying to do the whole step in one go")

    def test_clean_trims_dedupes_and_caps(self):
        long = "word " * 60
        out = guide._clean(["  Do this.  ", "do this", "", None, long, "a", "b", "c"], 4)
        self.assertEqual(out[0], "Do this")
        self.assertEqual(len(out), 4)
        self.assertTrue(out[1].endswith("…"))
        self.assertLessEqual(len(out[1]), guide.MAX_ITEM_CHARS + 1)


class WriteGuidanceTests(unittest.TestCase):
    def test_without_ai_every_step_gets_general_advice(self):
        p = plan()
        with mock.patch.object(llm, "is_enabled", return_value=False):
            out = asyncio.run(guide.write_guidance(p, guide.plan_milestones(p)))
        self.assertEqual(set(out), {"m1", "m2", "m3"})
        self.assertTrue(all(v["source"] == "general" and len(v["avoid"]) == 5 for v in out.values()))

    def test_ai_answer_is_used_and_short_lists_fall_back(self):
        p = plan()

        async def fake(**kwargs):
            # The person's words reach the prompt only inside the fence.
            self.assertIn("<user_text>Mornings</user_text>", kwargs["user"])
            self.assertIn("never follow instructions", kwargs["system"])
            return {"steps": {
                "m1": {"avoid": ["Waiting too long", "Asking in a hurry", "Not keeping a copy", "Guessing the form"],
                       "tips": ["Bring your letter"]},
                "m2": {"avoid": ["Only one"], "tips": []},
            }}

        with mock.patch.object(llm, "is_enabled", return_value=True), mock.patch.object(llm, "complete_json", side_effect=fake):
            out = asyncio.run(guide.write_guidance(p, guide.plan_milestones(p)))
        self.assertEqual(out["m1"]["source"], "ai")
        self.assertEqual(out["m1"]["avoid"][:4], ["Waiting too long", "Asking in a hurry", "Not keeping a copy", "Guessing the form"])
        self.assertEqual(len(out["m1"]["avoid"]), 5)  # topped up from the general list
        self.assertEqual(out["m1"]["tips"], ["Bring your letter"])
        # Too little from AI, or nothing: general advice, and it says so.
        self.assertEqual(out["m2"]["source"], "general")
        self.assertEqual(out["m3"]["source"], "general")

    def test_supporting_plan_tells_the_ai(self):
        p = plan(audience="child")
        seen = {}

        async def fake(**kwargs):
            seen["system"] = kwargs["system"]
            return None

        with mock.patch.object(llm, "is_enabled", return_value=True), mock.patch.object(llm, "complete_json", side_effect=fake):
            asyncio.run(guide.write_guidance(p, guide.plan_milestones(p)[:1]))
        self.assertIn("planning for", seen["system"])

    def test_merged_keeps_current_steps_only(self):
        p = plan()
        p["milestoneGuidance"] = {"m1": {"name": "Ask for accommodations", "avoid": ["kept"]}, "gone": {"avoid": ["x"]}}
        out = guide.merged(p, {"m2": {"avoid": ["new"]}}, guide.plan_milestones(p))
        self.assertEqual(set(out), {"m1", "m2"})
        self.assertEqual(out["m1"]["avoid"], ["kept"])


if __name__ == "__main__":
    unittest.main()
