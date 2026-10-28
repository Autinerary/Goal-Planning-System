"""Private reading: with PRIVATE_MODE on, every prompt goes to our own open-weight model on a server we run, so
people's words don't reach a third party. Off by default: deploying this changes nothing until the server exists
and the switch is set. No real model here: the client is a stand-in.

Run from backend/:  python -m unittest tests.test_private_reading -v
"""
import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest import mock

from core import llm, model_registry as registry

PRIVATE = {"PRIVATE_LLM_BASE_URL": "https://llm.example.org/v1", "PRIVATE_LLM_API_KEY": "secret", "PRIVATE_LLM_MODEL": "gpt-oss-20b"}
RENTED = {"OPENAI_API_KEY": "sk-test"}
AGENTS = registry.AGENT_IDS


def env(**extra):
    base = {k: "" for k in ("PRIVATE_LLM_BASE_URL", "PRIVATE_LLM_API_KEY", "PRIVATE_LLM_MODEL", "PRIVATE_MODE",
                            "PRIVATE_LLM_REASONING", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY",
                            "GROQ_API_KEY", "OPENROUTER_API_KEY", "LOCAL_LLM_BASE_URL", "OPENAI_MODEL")}
    base.update(extra)
    return mock.patch.dict(os.environ, base)


class ModeTests(unittest.TestCase):
    def test_off_by_default_even_with_the_server_set_up(self):
        with env(**PRIVATE, **RENTED):
            self.assertEqual(llm.private_mode(), "off")
            self.assertEqual({llm.active_model_id(a) for a in AGENTS}, {"gpt-4o-mini"})

    def test_an_unknown_value_is_off(self):
        with env(**PRIVATE, **RENTED, PRIVATE_MODE="yes please"):
            self.assertEqual(llm.private_mode(), "off")

    def test_prefer_sends_every_agent_to_our_model(self):
        with env(**PRIVATE, **RENTED, PRIVATE_MODE="prefer"):
            self.assertEqual({llm.active_model_id(a) for a in AGENTS}, {"private"})
            # even a person's own model choice: their words would otherwise leave
            with llm.use_selection(llm.Selection(model="gpt-4o")):
                self.assertEqual(llm.active_model_id("path_planning"), "private")
            self.assertEqual(registry.provider_credentials("private"), ("secret", "https://llm.example.org/v1"))
            self.assertEqual(registry.wire_name(registry.MODELS["private"]), "gpt-oss-20b")

    def test_prefer_falls_back_to_the_usual_model_without_the_server(self):
        with env(**RENTED, PRIVATE_MODE="prefer"):
            self.assertEqual(llm.active_model_id("path_planning"), "gpt-4o-mini")

    def test_require_without_the_server_means_no_model_at_all(self):
        with env(**RENTED, PRIVATE_MODE="require"):
            self.assertIsNone(llm.active_model_id("path_planning"))
            self.assertFalse(llm.is_enabled())        # the agents take their no-model path
        with env(**PRIVATE, **RENTED, PRIVATE_MODE="require"):
            self.assertEqual(llm.active_model_id("path_planning"), "private")
            self.assertTrue(llm.is_enabled())

    def test_a_server_with_no_key_is_not_set_up(self):
        with env(PRIVATE_LLM_BASE_URL="https://llm.example.org/v1", PRIVATE_MODE="require"):
            self.assertFalse(registry.is_model_available("private"))


class PickerTests(unittest.TestCase):
    def test_our_model_is_listed_only_once_its_server_is_set_up(self):
        with env(**RENTED):
            self.assertNotIn("private", [m["id"] for m in registry.catalogue()["models"]])
        with env(**PRIVATE, **RENTED):
            self.assertIn("private", [m["id"] for m in registry.catalogue()["models"]])


class RequestTests(unittest.TestCase):
    def _call(self, **extra):
        sent = []

        class Completions:
            async def create(self, **kwargs):
                sent.append(kwargs)
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"ok": true}'))],
                                       usage=SimpleNamespace(prompt_tokens=3, completion_tokens=2))

        client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))

        async def client_for(model):
            return client

        with env(**PRIVATE, **RENTED, PRIVATE_MODE="prefer", **extra), mock.patch("core.llm._client_for", client_for), \
             mock.patch("core.budget.check"), mock.patch("core.budget.record"):
            got = asyncio.run(llm.complete_json("system", "user", agent="path_planning"))
        return got, sent[0]

    def test_our_model_gets_json_mode_and_low_reasoning(self):
        got, sent = self._call()
        self.assertEqual(got, {"ok": True})
        self.assertEqual(sent["model"], "gpt-oss-20b")
        self.assertEqual(sent["response_format"], {"type": "json_object"})
        self.assertEqual(sent["reasoning_effort"], "low")

    def test_reasoning_can_be_changed_or_left_to_the_server(self):
        _got, sent = self._call(PRIVATE_LLM_REASONING="medium")
        self.assertEqual(sent["reasoning_effort"], "medium")
        _got, sent = self._call(PRIVATE_LLM_REASONING="default")
        self.assertNotIn("reasoning_effort", sent)


if __name__ == "__main__":
    unittest.main()
