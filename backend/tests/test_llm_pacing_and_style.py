"""The per-minute AI limit paces a signed-in person's calls instead of failing
them (Riipen Labs, Group 18: "Too many requests" at the end of setup), and the
person's "Words we use" choice reaches every prompt (Group 15).

Run from backend/:  python -m unittest tests.test_llm_pacing_and_style -v
"""
import asyncio
import os
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from core import budget, llm

MODEL = SimpleNamespace(id="test-model")


class PacingTests(unittest.TestCase):
    def setUp(self):
        budget._usage.clear()
        self.patches = [
            patch.object(budget, "REQUESTS_PER_MINUTE", 2),
            patch.object(budget, "MINUTE_SECONDS", 0.4),
            patch.object(budget, "_load_persisted", lambda actor, verified: None),
            patch.dict(os.environ, {"LLM_RATE_WAIT_SECONDS": "5"}),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        budget._usage.clear()

    def guard(self, actor, verified, times):
        async def run():
            with llm.use_selection(None, actor=actor, verified=verified):
                for _ in range(times):
                    await llm._guard(MODEL, 10)
        asyncio.run(run())

    def test_a_signed_in_person_waits_for_the_next_slot(self):
        started = time.monotonic()
        self.guard("8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10", True, 3)
        elapsed = time.monotonic() - started
        self.assertGreaterEqual(elapsed, 0.3)     # the third call waited
        self.assertLess(elapsed, 3)

    def test_the_limit_still_holds_while_waiting(self):
        actor = "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"
        self.guard(actor, True, 4)
        usage = budget._usage[actor]
        times = list(usage.requests)
        # No more than two calls started in any window of MINUTE_SECONDS.
        for i in range(len(times) - 2):
            self.assertGreater(times[i + 2] - times[i], 0.39)

    def test_anonymous_callers_are_refused_at_once(self):
        with self.assertRaises(budget.LimitExceeded) as e:
            self.guard(None, False, 3)
        self.assertEqual(e.exception.limit, "requests_per_minute")

    def test_unverified_ids_are_refused_at_once(self):
        with self.assertRaises(budget.LimitExceeded):
            self.guard("someone-else", False, 3)

    def test_it_gives_up_after_the_longest_wait(self):
        with patch.dict(os.environ, {"LLM_RATE_WAIT_SECONDS": "0"}):
            with self.assertRaises(budget.LimitExceeded):
                self.guard("8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10", True, 3)

    def test_the_daily_limit_never_waits(self):
        # The call's planned tokens (10) alone are over the day's 5.
        with patch.object(budget, "TOKENS_PER_DAY", 5):
            started = time.monotonic()
            with self.assertRaises(budget.LimitExceeded) as e:
                self.guard("8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10", True, 1)
            self.assertLess(time.monotonic() - started, 0.2)
        self.assertEqual(e.exception.limit, "tokens_per_day")

    def test_seconds_until_slot(self):
        actor = "a"
        self.assertEqual(budget.seconds_until_slot(actor), 0.0)
        budget.check(actor, "m", 1)
        budget.check(actor, "m", 1)
        wait = budget.seconds_until_slot(actor)
        self.assertGreater(wait, 0.0)
        self.assertLessEqual(wait, 0.4)


class FakeCompletions:
    def __init__(self):
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"ok": true}'))], usage=None)


class StyleTests(unittest.TestCase):
    def run_calls(self, style):
        fake = FakeCompletions()
        client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
        model = SimpleNamespace(id="m", provider="openai")

        async def client_for(_model):
            return client

        async def guard(_model, _planned):
            return None

        async def go():
            with patch.object(llm, "resolve", return_value=(model, SimpleNamespace(id="medium"))), \
                 patch.object(llm, "_client_for", new=client_for), \
                 patch.object(llm, "_tuned", return_value=({"model": "m"}, 10)), \
                 patch.object(llm, "_guard", new=guard), \
                 patch.dict(llm.registry.PROVIDERS, {"openai": SimpleNamespace(supports_json_mode=True)}):
                with llm.use_selection(None, language_style=style):
                    await llm.complete_text("SYS", "hi")
                    await llm.complete_json("SYS", "hi")
                    await llm.complete_chat([{"role": "system", "content": "CHAT"}, {"role": "user", "content": "hi"}])
                    await llm.complete_chat([{"role": "user", "content": "hi"}])
        asyncio.run(go())
        return [c["messages"] for c in fake.calls]

    def test_identity_first_reaches_every_prompt(self):
        calls = self.run_calls("identity")
        self.assertIn("identity-first", calls[0][0]["content"])
        self.assertTrue(calls[0][0]["content"].startswith("SYS"))
        self.assertIn("identity-first", calls[1][0]["content"])
        self.assertTrue(calls[1][0]["content"].endswith("Respond ONLY with valid JSON."))
        self.assertTrue(calls[2][0]["content"].startswith("CHAT"))
        self.assertIn("identity-first", calls[2][0]["content"])
        self.assertEqual(calls[3][0]["role"], "system")         # added when there was none
        self.assertIn("identity-first", calls[3][0]["content"])

    def test_person_first(self):
        calls = self.run_calls("person")
        self.assertIn("person-first", calls[0][0]["content"])

    def test_no_choice_changes_nothing(self):
        for style in (None, "", "shouty", 3):
            calls = self.run_calls(style)
            self.assertEqual(calls[0][0]["content"], "SYS")
            self.assertEqual(calls[2][0]["content"], "CHAT")
            self.assertEqual(calls[3][0]["role"], "user")

    def test_the_choice_ends_with_its_block(self):
        with llm.use_selection(None, language_style="identity"):
            self.assertTrue(llm.language_rule())
        self.assertEqual(llm.language_rule(), "")


if __name__ == "__main__":
    unittest.main()
