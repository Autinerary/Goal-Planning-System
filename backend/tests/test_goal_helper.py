"""The optional AI goal helper on setup's goal step (core/goal_helper.py).

Run from backend/:  python -m unittest tests.test_goal_helper -v
"""

import asyncio
import contextlib
import unittest
from unittest.mock import patch

from core import goal_helper as helper

IDEAS = [
    {"category": "career", "text": "Practice presentation skills"},
    {"category": "career", "text": "Find neurodivergent-friendly workplaces"},
    {"category": "health", "text": "Find a physical activity I enjoy"},
    {"category": "other", "text": "Build a personal budget"},
]


def run(coro):
    return asyncio.run(coro)


class FakeLLM:
    """Stands in for core.llm: records calls, returns a fixed answer."""

    def __init__(self, answer=None, enabled=True):
        self.answer, self.enabled, self.calls = answer, enabled, []

    def is_enabled(self):
        return self.enabled

    @contextlib.contextmanager
    def use_selection(self, selection, actor=None, verified=False):
        self.actor = (actor, verified)
        yield

    async def complete_json(self, system, user, **kwargs):
        self.calls.append((system, user, kwargs))
        return self.answer


class GoalHelperTests(unittest.TestCase):
    def setUp(self):
        helper.limiter = helper._Limiter(helper.HELPER_CALLS, helper.HELPER_WINDOW_SECONDS)

    def ask(self, text, answer=None, enabled=True, ideas=IDEAS, actor="person"):
        fake = FakeLLM(answer, enabled)
        with patch.object(helper, "llm", fake):
            result = run(helper.suggest(text, ideas, "self", actor))
        return result, fake

    def test_suggestions_come_from_the_ideas_and_their_own_words(self):
        result, fake = self.ask(
            "I want a job but interviews stress me out",
            {"picks": [1, 0, 9, "x", 1], "own": {"category": "career", "text": "get a job, with help for interviews"}},
        )
        self.assertEqual(result["suggestions"], [
            {"category": "career", "text": "Find neurodivergent-friendly workplaces", "source": "idea"},
            {"category": "career", "text": "Practice presentation skills", "source": "idea"},
            {"category": "career", "text": "Get a job, with help for interviews", "source": "own"},
        ])
        self.assertEqual(fake.actor, ("person", True))
        self.assertEqual(fake.calls[0][2]["agent"], "goal_helper")
        self.assertIn('"they_wrote": "I want a job but interviews stress me out"', fake.calls[0][1])

    def test_at_most_three_and_their_own_words_kept(self):
        result, _ = self.ask("money and work", {"picks": [0, 1, 2, 3], "own": {"category": "other", "text": "Sort out money"}})
        self.assertEqual(len(result["suggestions"]), 3)
        self.assertEqual(result["suggestions"][-1]["source"], "own")

    def test_crisis_gets_the_lines_and_no_ai(self):
        for text in ("I want to kill myself", "honestly I don't want to live anymore", "I feel suicidal"):
            result, fake = self.ask(text, {"picks": [0]})
            self.assertEqual(result["suggestions"], [])
            self.assertIn("9-8-8", result["crisis"]["lines"][0]["how"])
            self.assertIn("911", result["crisis"]["lines"][2]["how"])
            self.assertEqual(fake.calls, [])

    def test_guardrails_run_before_any_ai(self):
        result, fake = self.ask("I want to be a drug dealer", {"picks": [0]})
        self.assertEqual(result["suggestions"], [])
        self.assertIn("aren't supported", result["message"])
        self.assertEqual(fake.calls, [])

    def test_their_own_words_are_checked(self):
        bad = [
            {"category": "health", "text": "Ask your doctor about medication"},  # clinical, not theirs
            {"category": "career", "text": "Apply at www.example.com"},
            {"category": "career", "text": "One two three four five six seven eight nine ten eleven twelve thirteen"},
            {"category": "career", "text": ""},
            "Get a job",
        ]
        for i, own in enumerate(bad):
            result, _ = self.ask("I want a job", {"picks": [], "own": own}, actor=f"person {i}")
            self.assertEqual(result["suggestions"], [], own)
        # A clinical word they used themselves may stay.
        result, _ = self.ask("I want to start therapy", {"picks": [], "own": {"category": "health", "text": "Start therapy"}}, actor="a")
        self.assertEqual(result["suggestions"], [{"category": "health", "text": "Start therapy", "source": "own"}])
        # An unknown category becomes Other.
        result, _ = self.ask("travel more", {"picks": [], "own": {"category": "space", "text": "Travel more"}}, actor="b")
        self.assertEqual(result["suggestions"][0]["category"], "other")

    def test_ideas_are_cleaned(self):
        cleaned = helper.clean_ideas([
            {"category": "career", "text": "  Practice   presentation skills "},
            {"category": "career", "text": "practice presentation skills"},
            {"category": "unknown", "text": "Something"},
            {"category": "other", "text": "x" * 81},
            {"category": "other", "text": "Become a stripper"},
            {"category": "other"},
            "not a dict",
        ])
        self.assertEqual(cleaned, [{"category": "career", "text": "Practice presentation skills"}])

    def test_nothing_typed_or_too_long(self):
        result, fake = self.ask("   ")
        self.assertIn("Write a few words", result["message"])
        result, fake = self.ask("a" * 301)
        self.assertIn("300", result["message"])
        self.assertEqual(fake.calls, [])

    def test_without_ai_it_says_so(self):
        result, _ = self.ask("I want a job", enabled=False)
        self.assertEqual(result, {"suggestions": [], "available": False})
        result, _ = self.ask("I want a job", answer=None)
        self.assertEqual(result, {"suggestions": [], "available": False})

    def test_its_own_limit_per_person(self):
        for _ in range(helper.HELPER_CALLS):
            result, _ = self.ask("I want a job", {"picks": [0]})
            self.assertEqual(len(result["suggestions"]), 1)
        result, fake = self.ask("I want a job", {"picks": [0]})
        self.assertIn("try again in a few minutes", result["message"])
        self.assertEqual(fake.calls, [])
        # Someone else is not affected.
        result, _ = self.ask("I want a job", {"picks": [0]}, actor="someone else")
        self.assertEqual(len(result["suggestions"]), 1)

    def test_limiter_window_passes(self):
        limiter = helper._Limiter(2, 10)
        self.assertTrue(limiter.allow("a", now=0))
        self.assertTrue(limiter.allow("a", now=1))
        self.assertFalse(limiter.allow("a", now=2))
        self.assertTrue(limiter.allow("a", now=12))

    def test_the_validator_names_canada_and_the_us(self):
        from core.guardrails import validate_text
        message = validate_text("I want to end my life")
        self.assertIn("9-8-8", message)
        self.assertIn("Canada", message)
        self.assertIn("911", message)


if __name__ == "__main__":
    unittest.main()
