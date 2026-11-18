"""The AI usage ledger never makes a request wait on the database (core/budget.py), and a model call can't hang for
long (core/llm.py): the bug audit of 17 November 2026, item 34. supabase-py is synchronous, and the ledger's insert
after every model call, and its re-read inside the lock that code on the event loop takes, held the whole server.

Run from backend/:  python -m unittest tests.test_budget_ledger -v
"""
import asyncio
import os
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from core import budget, llm

ACTOR = "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"


def flush():
    """Wait for the ledger's background writes."""
    budget._writer.submit(lambda: None).result(timeout=5)


class LedgerTests(unittest.TestCase):
    def setUp(self):
        budget._usage.clear()
        self.addCleanup(budget._usage.clear)

    def test_a_call_is_counted_at_once_and_its_row_written_in_the_background(self):
        release, written = threading.Event(), []

        def slow_persist(*row, **kw):
            release.wait(5)
            written.append(row)

        with patch.object(budget, "_persist", slow_persist):
            started = time.monotonic()
            budget.record(ACTOR, "m", 100, 50, agent_id="path_planning", verified=True)
            self.assertLess(time.monotonic() - started, 1, "the caller didn't wait for the database")
            self.assertEqual(budget._usage[ACTOR].tokens_today(), 150)
            self.assertEqual(written, [])
            release.set()
            flush()
        self.assertEqual(written, [(ACTOR, True, "m", "path_planning", 100, 50, None)])
        self.assertTrue(budget._usage[ACTOR].spend[0][3])

    def test_the_background_write_uses_the_client_of_the_moment_of_the_call(self):
        # A test (or caller) that stands in for the database while it records must keep the write away from the real
        # one, even though the write happens after its stand-in ends: a local run with the real keys sent test rows to
        # the live database (18 November 2026).
        release, inserted = threading.Event(), []

        class FakeTable:
            def insert(self, row):
                inserted.append(row)
                return SimpleNamespace(execute=lambda: None)

        fake = SimpleNamespace(table=lambda name: FakeTable())
        real_persist = budget._persist

        def slow_persist(*row, **kw):
            release.wait(5)
            real_persist(*row, **kw)

        with patch.object(budget, "_persist", slow_persist):
            with patch.object(budget, "get_supabase", lambda: fake):
                budget.record(ACTOR, "m", 7, 3, verified=True)
            # The stand-in has ended; the write hasn't happened yet.
            with patch.object(budget, "get_supabase", lambda: self.fail("the write looked for a client after the call")):
                release.set()
                flush()
        self.assertEqual(len(inserted), 1)
        self.assertEqual(inserted[0]["prompt_tokens"], 7)

        # No database at the time of the call: nothing is written later either.
        inserted.clear()
        with patch.object(budget, "get_supabase", lambda: None):
            budget.record(ACTOR, "m", 1, 1, verified=True)
        with patch.object(budget, "get_supabase", lambda: fake):
            flush()
        self.assertEqual(inserted, [])

    def test_a_re_read_keeps_calls_whose_row_isnt_written_yet(self):
        release = threading.Event()
        with patch.object(budget, "_persist", lambda *row, **kw: release.wait(5)), \
                patch.object(budget, "_load_persisted", lambda actor, verified: (1000, 0.0)):
            budget.record(ACTOR, "m", 10, 0, verified=True)
            budget._refresh(ACTOR, time.time())
            # The ledger's 1000 doesn't have this call yet, so it's still counted here.
            self.assertEqual(budget._usage[ACTOR].tokens_today(), 1010)
            release.set()
            flush()
        with patch.object(budget, "_load_persisted", lambda actor, verified: (1010, 0.0)):
            budget._usage[ACTOR].loaded_at = 0
            budget._refresh(ACTOR, time.time())
        # Now the ledger has it: counted once.
        self.assertEqual(budget._usage[ACTOR].tokens_today(), 1010)

    def test_the_ledger_is_read_outside_the_lock(self):
        held = []

        def read(actor, verified):
            free = budget._lock.acquire(blocking=False)
            held.append(not free)
            if free:
                budget._lock.release()
            return (0, 0.0)

        with patch.object(budget, "_load_persisted", read):
            budget.check(ACTOR, "m", 10, verified=True)
            budget._usage[ACTOR].loaded_at = 0
            budget.snapshot(ACTOR, verified=True)
        self.assertEqual(held, [False, False])

    def test_the_check_runs_off_the_event_loop(self):
        threads = []

        def check(*args, **kwargs):
            threads.append(threading.current_thread())

        async def run():
            with llm.use_selection(None, actor=ACTOR, verified=True):
                await llm._guard(SimpleNamespace(id="m"), 10)

        with patch.object(budget, "check", check):
            asyncio.run(run())
        self.assertEqual(len(threads), 1)
        self.assertIsNot(threads[0], threading.main_thread())


class ModelClientTests(unittest.TestCase):
    def test_a_call_times_out_after_a_minute_and_is_tried_once_more(self):
        llm._clients.clear()
        self.addCleanup(llm._clients.clear)
        with patch.object(llm.registry, "provider_credentials", lambda provider: ("sk-test-not-a-key", None)), \
                patch.dict(os.environ, {"LLM_TIMEOUT_SECONDS": ""}):
            client = asyncio.run(llm._client_for(SimpleNamespace(provider="openai", id="m")))
        self.assertEqual(client.timeout, 60.0)
        self.assertEqual(client.max_retries, 1)

    def test_the_timeout_can_be_raised_for_a_slow_model(self):
        with patch.dict(os.environ, {"LLM_TIMEOUT_SECONDS": "180"}):
            self.assertEqual(llm.call_timeout_seconds(), 180.0)
        for bad in ("soon", "0", "-5"):
            with patch.dict(os.environ, {"LLM_TIMEOUT_SECONDS": bad}):
                self.assertEqual(llm.call_timeout_seconds(), 60.0, bad)

    def test_the_embedding_client_too(self):
        from core.agents import pattern_recognition_agent as pra
        agent = pra.PatternRecognitionAgent()
        with patch.object(pra, "OPENAI_API_KEY", "sk-test-not-a-key"), patch.object(pra, "get_supabase", lambda: None), \
                patch.dict(os.environ, {"LLM_TIMEOUT_SECONDS": ""}):
            asyncio.run(agent.initialize())
        self.assertEqual(agent._openai_client.timeout, 60.0)
        self.assertEqual(agent._openai_client.max_retries, 1)


class DatabaseClientTests(unittest.TestCase):
    def test_a_database_request_gives_up_after_ten_seconds(self):
        from database import supabase_client
        options = supabase_client._options()
        self.assertIsNotNone(options)
        self.assertEqual(options.postgrest_client_timeout, 10)


if __name__ == "__main__":
    unittest.main()
