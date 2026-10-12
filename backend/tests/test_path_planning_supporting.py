"""Plans for someone the user supports (core/agents/path_planning_agent.py).

Riipen Labs, Group 24: a parent's goal for their child came back with roadmaps
about the parent's own career, because nothing told the model whose goal it
was. Run from backend/:  python -m unittest tests.test_path_planning_supporting -v
"""
import asyncio
import unittest
from unittest import mock

from core.agents import path_planning_agent as ppa
from core.agents.path_planning_agent import PathPlanningAgent, supported_person

CAREER_TEMPLATES = {
    'Identify career interests and strengths', 'Research inclusive employers',
    'Build professional network', 'Develop interview strategies',
}


def run(coro):
    return asyncio.run(coro)


def agent():
    a = PathPlanningAgent()
    run(a.initialize())
    return a


class SupportedPersonTests(unittest.TestCase):
    def test_answers_that_plan_for_someone_else(self):
        self.assertEqual(supported_person('child'), 'their child')
        self.assertEqual(supported_person(' Work '), 'someone they teach, support or work with')
        for own in ('self', 'ally', 'unsure', '', None, 'something else'):
            self.assertIsNone(supported_person(own), own)


class TemplatePlanTests(unittest.TestCase):
    """With the model unavailable, the fallback templates are used."""

    def milestones(self, for_person):
        with mock.patch.object(ppa.llm, 'is_enabled', return_value=False):
            return run(agent()._generate_milestones_for_goal(
                goal='Get my son ready for grade 1', goal_idx=0, barriers=['Autism'],
                strategies=[], similar_patterns=[], for_person=for_person,
            ))

    def test_a_parents_plan_has_no_career_steps(self):
        ms = self.milestones('their child')
        names = {m['name'] for m in ms}
        self.assertFalse(names & CAREER_TEMPLATES, names & CAREER_TEMPLATES)
        self.assertIn('Talk with their teacher or school', names)
        self.assertEqual({m['dimension'] for m in ms}, {'education', 'workplace', 'relationships', 'health'})
        labels = {m['dimension']: m['dimensionLabel'] for m in ms}
        self.assertEqual(labels['workplace'], 'School, work & daily life')
        self.assertTrue(all(m.get('forPerson') == 'their child' for m in ms))

    def test_planning_for_yourself_is_unchanged(self):
        ms = self.milestones(None)
        names = {m['name'] for m in ms}
        self.assertTrue(names & CAREER_TEMPLATES)
        self.assertEqual({m['dimension']: m['dimensionLabel'] for m in ms}['workplace'], 'Workplace')
        self.assertFalse(any('forPerson' in m for m in ms))


class PromptTests(unittest.TestCase):
    """What the model is told."""

    def capture(self, for_person):
        prompts = []

        async def fake_complete_json(system, user, **kwargs):
            prompts.append((system, user))
            if 'mini-roadmaps' in system:
                return {k: [f'{k} step {i}' for i in range(4)] for k in ('education', 'workplace', 'relationships', 'health')}
            return {}

        a = agent()
        with mock.patch.object(ppa.llm, 'is_enabled', return_value=True), \
                mock.patch.object(ppa.llm, 'complete_json', side_effect=fake_complete_json):
            ms = run(a._generate_milestones_for_goal(
                goal='Get my son ready for grade 1', goal_idx=0, barriers=[],
                strategies=[], similar_patterns=[], for_person=for_person,
            ))
            run(a._generate_tasks_batch(ms[:3], []))
        return prompts

    def test_every_prompt_says_who_the_plan_is_for(self):
        prompts = self.capture('their child')
        self.assertGreaterEqual(len(prompts), 3)  # roadmaps, descriptions, tasks
        for system, user in prompts:
            self.assertIn("planning for their child", system)
            self.assertIn("Never write about the user's own career", system)
            self.assertTrue(user.startswith('Planning for: their child'), user[:60])
        roadmap = prompts[0][0]
        self.assertIn('workplace = their day: school or work routines', roadmap)

    def test_planning_for_yourself_says_nothing_new(self):
        for system, user in self.capture(None):
            self.assertNotIn('planning for', system)
            self.assertNotIn('Planning for:', user)


if __name__ == '__main__':
    unittest.main()
