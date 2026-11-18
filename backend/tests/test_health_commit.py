"""/health reports which commit the server was built from.

Run from backend/:  python -m unittest tests.test_health_commit -v
"""

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402

FULL_SHA = "d34f80a9c1e2b3f4a5d6e7f8091a2b3c4d5e6f70"


class _StubOrchestrator:
    async def health_check(self):
        return {"initialized": False}


class DeployedCommitTests(unittest.TestCase):
    def test_short_sha_from_render(self):
        with mock.patch.dict(os.environ, {"RENDER_GIT_COMMIT": FULL_SHA}):
            self.assertEqual(main._deployed_commit(), "d34f80a")

    def test_none_when_not_on_render(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("RENDER_GIT_COMMIT", None)
            self.assertIsNone(main._deployed_commit())

    def test_none_when_blank(self):
        with mock.patch.dict(os.environ, {"RENDER_GIT_COMMIT": "  "}):
            self.assertIsNone(main._deployed_commit())

    def test_health_response_carries_it(self):
        with mock.patch.dict(os.environ, {"RENDER_GIT_COMMIT": FULL_SHA}), \
                mock.patch.object(main, "orchestrator", _StubOrchestrator()):
            body = asyncio.run(main.health_check())
        self.assertEqual(body["commit"], "d34f80a")
        self.assertEqual(body["status"], "healthy")


class ColdStartTests(unittest.TestCase):
    """The server answers sooner after waking (bug audit, 17 November 2026, item 36): LangGraph and the agents load
    when something first needs them, not at startup, and the first reindex sweep waits."""

    def test_health_answers_without_making_the_orchestrator(self):
        lazy = main._LazyOrchestrator()
        body = asyncio.run(lazy.health_check())
        self.assertEqual((body["initialized"], body["loaded"]), (False, False))
        self.assertIsNone(lazy._real)

    def test_it_is_made_when_first_used(self):
        made = mock.MagicMock()
        with mock.patch("core.orchestrator.Orchestrator", return_value=made):
            lazy = main._LazyOrchestrator()
            self.assertIs(lazy.index_user, made.index_user)
        self.assertIs(lazy._real, made)

    def test_starting_the_server_loads_no_agents(self):
        import subprocess
        root = Path(__file__).resolve().parents[1]
        code = ("import sys, main; "
                "print(sorted(m for m in ('langgraph', 'core.orchestrator', 'core.agents.path_planning_agent') "
                "if m in sys.modules))")
        out = subprocess.run([sys.executable, "-c", code], cwd=root, capture_output=True, text=True, timeout=120)
        self.assertEqual(out.returncode, 0, out.stderr[-2000:])
        self.assertEqual(out.stdout.strip().splitlines()[-1], "[]")

    def test_the_first_sweep_waits(self):
        self.assertGreaterEqual(main.REINDEX_FIRST_SECONDS, 300)


if __name__ == "__main__":
    unittest.main()
