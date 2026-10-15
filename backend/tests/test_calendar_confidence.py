"""Calendar Optimization stores no confidence (core/agents/calendar_optimization_agent.py).

It used to report (days with work / 7) x (1.0 with learned preferences, else
0.75), which came out 0.75 for everyone. It is null now, and the two facts
it was made of are reported as what they are.

Run from backend/:  python -m unittest tests.test_calendar_confidence -v
"""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from core.agents import calendar_optimization_agent as cal

TASKS = [{'id': f't{i}', 'name': f'Task {i}', 'priority': 'medium', 'difficulty': 'easy',
          'estimatedDuration': 20} for i in range(40)]


def run_agent(tasks, learned=None):
    with patch.object(cal.llm, 'is_enabled', return_value=False), \
         patch.object(cal.learning, 'get_user_calendar_preferences', AsyncMock(return_value=learned or [])):
        agent = cal.CalendarOptimizationAgent()
        asyncio.run(agent.initialize())
        return asyncio.run(agent.optimize_calendar(
            user_profile={'barrierTypes': ['ADHD'], 'id': 'u1'}, milestones=[], tasks=[dict(t) for t in tasks]))


class NoConfidenceTests(unittest.TestCase):
    def test_a_full_week_has_no_confidence(self):
        result = run_agent(TASKS)
        self.assertIn('confidence', result)
        self.assertIsNone(result['confidence'])
        self.assertEqual(result['daysWithWork'], 7)
        self.assertIs(result['learnedPreferences'], False)

    def test_a_short_plan_or_learned_preferences_change_the_facts_not_a_score(self):
        short = run_agent(TASKS[:3])
        self.assertIsNone(short['confidence'])
        self.assertLess(short['daysWithWork'], 7)
        learned = run_agent(TASKS, learned=[{'time_bucket': 'high_energy_high'}])
        self.assertIsNone(learned['confidence'])
        self.assertIs(learned['learnedPreferences'], True)


if __name__ == '__main__':
    unittest.main()
