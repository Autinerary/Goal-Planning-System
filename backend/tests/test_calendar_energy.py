"""Calendar Optimization's energy levels are a default, and say so
(core/agents/calendar_optimization_agent.py).

Nothing stored records a person's own energy (docs/reports/
calendar-optimization-2026-10-13.md, item 1), so each day carries where its
energy came from, the result says it isn't personal, and the explanation is
told not to claim it is.

Run from backend/:  python -m unittest tests.test_calendar_energy -v
"""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from core.agents import calendar_optimization_agent as cal

TASKS = [{'id': f't{i}', 'name': f'Task {i}', 'priority': 'medium', 'difficulty': 'easy',
          'estimatedDuration': 20} for i in range(8)]


def run_agent(labels, llm_on=False, complete_text=None):
    with patch.object(cal.llm, 'is_enabled', return_value=llm_on), \
         patch.object(cal.llm, 'complete_text', complete_text or AsyncMock(return_value=None)), \
         patch.object(cal.learning, 'get_user_calendar_preferences', AsyncMock(return_value=[])):
        agent = cal.CalendarOptimizationAgent()
        asyncio.run(agent.initialize())
        return asyncio.run(agent.optimize_calendar(
            user_profile={'barrierTypes': labels}, milestones=[], tasks=[dict(t) for t in TASKS]))


class EnergyIsADefaultTests(unittest.TestCase):
    def test_every_day_says_its_energy_came_from_the_weekday(self):
        result = run_agent(['ADHD'])
        self.assertEqual({d['energySource'] for d in result['schedule']}, {'weekday'})
        self.assertEqual(result['energySource'], 'weekday')
        self.assertIs(result['energyPersonal'], False)

    def test_the_bipolar_rules_are_a_default_too(self):
        result = run_agent(['Bipolar disorder'])
        self.assertEqual({d['energySource'] for d in result['schedule']}, {'condition'})
        self.assertEqual(result['energySource'], 'condition')
        self.assertIs(result['energyPersonal'], False)

    def test_the_explanation_is_told_not_to_claim_it(self):
        complete_text = AsyncMock(return_value='A gentle week.')
        result = run_agent(['Anxiety'], llm_on=True, complete_text=complete_text)
        system = complete_text.call_args.kwargs['system']
        self.assertIn("never say the schedule follows the user's own energy", system)
        self.assertEqual(result['explanation'], 'A gentle week.')


if __name__ == '__main__':
    unittest.main()
