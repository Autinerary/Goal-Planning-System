"""Tasks stored with their milestone, and adaptations applied where the app
reads them (core/path_storage.py).

Run from backend/:  python -m unittest tests.test_path_storage -v
"""
import asyncio
import copy
import unittest

from core.path_storage import apply_adaptation, attach_tasks
from core.synthesis_engine import SynthesisEngine

M1 = {"id": "milestone_g0_education_0", "raceId": "race_0", "goal": "Get a job", "name": "Find a course", "nameSource": "generated"}
M2 = {"id": "milestone_g0_education_1", "raceId": "race_0", "goal": "Get a job", "name": "Enrol", "nameSource": "generated"}
TASKS = [
    {"id": "t1", "milestoneId": M1["id"], "name": "Search courses"},
    {"id": "t2", "milestoneId": M1["id"], "name": "Ask a friend"},
    {"id": "t3", "milestoneId": M2["id"], "name": "Fill in the form"},
]


def stored_payload():
    return {
        "races": [{"id": "race_0", "milestones": attach_tasks([M1, M2], TASKS)}],
        "agentResponses": [{"agentId": "path_planning", "result": {"milestones": [dict(M1), dict(M2)], "tasks": copy.deepcopy(TASKS)}}],
    }


class AttachTasksTests(unittest.TestCase):
    def test_each_milestone_gets_its_own_tasks(self):
        ms = attach_tasks([M1, M2, {"id": "other"}], TASKS)
        self.assertEqual([t["id"] for t in ms[0]["tasks"]], ["t1", "t2"])
        self.assertEqual([t["id"] for t in ms[1]["tasks"]], ["t3"])
        self.assertEqual(ms[2]["tasks"], [])
        self.assertNotIn("tasks", M1)   # the originals are not changed

    def test_synthesis_stores_tasks_on_race_milestones(self):
        races = asyncio.run(SynthesisEngine()._build_races({"milestones": [M1, M2], "tasks": TASKS}, {}, ["Get a job"]))
        self.assertEqual([len(m["tasks"]) for m in races[0]["milestones"]], [2, 1])


class AdaptationTests(unittest.TestCase):
    def test_placeholder_updates_are_ignored_and_change_nothing(self):
        before = stored_payload()
        after, applied = apply_adaptation(before,
                                          [{"id": "updated_milestone_1", "changes": ["x"], "status": "modified"}],
                                          [{"id": "updated_task_1", "changes": ["x"], "status": "modified"}])
        self.assertEqual(applied, {"milestones_applied": 0, "tasks_applied": 0, "ignored": 2})
        self.assertEqual(after, before)
        self.assertNotIn("milestones", after)
        self.assertNotIn("tasks", after)

    def test_real_updates_reach_every_copy_the_app_reads(self):
        after, applied = apply_adaptation(
            stored_payload(),
            [{"id": M1["id"], "name": "Find a short course", "status": "in_progress", "raceId": "hijack"}],
            [{"id": "t9", "milestoneId": M1["id"], "name": "Ask the library"}],
        )
        self.assertEqual(applied, {"milestones_applied": 1, "tasks_applied": 1, "ignored": 0})
        race_m1 = after["races"][0]["milestones"][0]
        agent = after["agentResponses"][0]["result"]
        self.assertEqual(race_m1["name"], "Find a short course")
        self.assertEqual(race_m1["raceId"], "race_0")          # not an adaptable field
        self.assertEqual(agent["milestones"][0]["name"], "Find a short course")
        self.assertEqual([t["id"] for t in race_m1["tasks"]], ["t9"])
        self.assertEqual(sorted(t["id"] for t in agent["tasks"]), ["t3", "t9"])   # M2's task kept
        self.assertEqual([t["id"] for t in after["races"][0]["milestones"][1]["tasks"]], ["t3"])
        self.assertNotIn("milestones", after)
        self.assertNotIn("tasks", after)

    def test_input_payload_is_not_mutated(self):
        before = stored_payload()
        snapshot = copy.deepcopy(before)
        apply_adaptation(before, [{"id": M1["id"], "name": "x"}], [])
        self.assertEqual(before, snapshot)


if __name__ == "__main__":
    unittest.main()
