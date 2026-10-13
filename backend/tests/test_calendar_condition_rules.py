"""Calendar Optimization's condition rules (core/agents/calendar_optimization_agent.py).

The rule sets are chosen with condition_taxonomy.match_keys, the
canonicalisation Pattern Recognition's live filter uses. So every recorded
spelling of a condition gets its rules, and someone without the condition
gets none.

Run from backend/:  python -m unittest tests.test_calendar_condition_rules -v
"""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from core.agents import calendar_optimization_agent as cal
from core.condition_taxonomy import _ALIASES

# A rule each rule set adds and no other does, so rules_applied shows it ran.
SIGNATURE = {
    'autism': 'sensory_breaks',
    'adhd': 'novel_task_boost',
    'ocd': 'clear_end_criteria',
    'bipolar': 'mood_check_ins',
}

# The forms people type, beyond the vocabulary's own (normalised) spellings.
TYPED = {
    'autism': ['Autism', 'Autism spectrum disorder', 'ASD', ' autistic '],
    'adhd': ['ADHD', 'Attention Deficit Hyperactivity Disorder', 'ADD'],
    'audhd': ['AuDHD', 'Autism + ADHD', 'autism and ADHD'],
    'ocd': ['OCD', 'Obsessive-compulsive and related conditions', 'Obsessive Compulsive Disorder'],
    'bipolar': ['Bipolar', 'Bipolar disorder', 'BIPOLAR_DISORDER'],
}
EXPECTED = {'autism': {'autism'}, 'adhd': {'adhd'}, 'audhd': {'autism', 'adhd'},
            'ocd': {'ocd'}, 'bipolar': {'bipolar'}}

WITHOUT = [
    [], ['Anxiety'], ['Dyslexia'], ['Depression', 'Mood disorders'],
    ['No current barriers'], ['Prefer not to share'],
    # Free text gets no rules even when it names a condition, as in the live filter.
    ['my brother is autistic'], ['ADHD-ish'],
]

TASKS = [
    {'id': f't{i}', 'name': f'Task {i}', 'priority': 'high' if i == 0 else 'medium',
     'difficulty': 'medium', 'estimatedDuration': 40}
    for i in range(12)
]


def spellings(key):
    return [label for label, k in _ALIASES.items() if k == key] + TYPED[key]


def run_agent(labels):
    with patch.object(cal.llm, 'is_enabled', return_value=False), \
         patch.object(cal.learning, 'get_user_calendar_preferences', AsyncMock(return_value=[])):
        agent = cal.CalendarOptimizationAgent()
        asyncio.run(agent.initialize())
        return asyncio.run(agent.optimize_calendar(
            user_profile={'barrierTypes': labels}, milestones=[], tasks=[dict(t) for t in TASKS]))


def rules_that_ran(result):
    applied = result['rules_applied']
    return {rule for rule, flag in SIGNATURE.items() if applied.get(flag)}


class ConditionRuleTests(unittest.TestCase):
    def test_every_spelling_gets_its_rules(self):
        for key, expected in EXPECTED.items():
            for label in spellings(key):
                with self.subTest(condition=key, label=label):
                    self.assertEqual(set(cal.rule_keys([label])), expected)
                    self.assertEqual(rules_that_ran(run_agent([label])), expected)

    def test_no_rules_without_the_condition(self):
        for labels in WITHOUT:
            with self.subTest(labels=labels):
                self.assertEqual(cal.rule_keys(labels), [])
                self.assertEqual(rules_that_ran(run_agent(labels)), set())

    def test_other_conditions_beside_one_with_rules(self):
        self.assertEqual(rules_that_ran(run_agent(['Anxiety', 'Autism spectrum disorder', 'Dyslexia'])), {'autism'})

    def test_the_rules_change_the_schedule(self):
        adhd = run_agent(['Attention Deficit Hyperactivity Disorder'])
        lengths = [t['adjustedDuration'] for d in adhd['schedule'] for t in d['tasks']]
        self.assertTrue(lengths and max(lengths) <= 25, lengths)   # ADHD: at most 25 minutes
        autism = run_agent(['ASD'])
        self.assertEqual(autism['rules_applied'].get('buffer_between_tasks'), 15)
        nobody = run_agent(['Anxiety'])
        self.assertNotIn('buffer_between_tasks', nobody['rules_applied'])

    def test_bipolar_days_are_flexible(self):
        days = run_agent(['Bipolar disorder'])['schedule']
        self.assertTrue(all(d['energyLevel'] == 'flexible' for d in days))


if __name__ == '__main__':
    unittest.main()
