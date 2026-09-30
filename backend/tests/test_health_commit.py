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


if __name__ == "__main__":
    unittest.main()
