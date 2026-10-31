"""The small open model on the person's own device (core/device_llm.py, api/routes/device.py).

Prompts go to the person's browser down their open connection and answers come back; core.llm treats the relay as
one more client. What must hold: the agents' helpers work through it unchanged; a person who chose their own model
never gets a cloud model in its place (no connection means no model, and the agents use their rules); it costs and
is charged nothing; and the WebSocket runs the real plan pipeline with every call going to the device.

Run from backend/:  python -m unittest tests.test_device_llm -v
"""
import asyncio
import os
import unittest
from unittest import mock

from core import device_llm, llm, model_registry as registry


class FakeBrowser:
    """Collects what the relay sends and answers each prompt the way it's told."""

    def __init__(self, reply="hello from the laptop"):
        self.sent = []
        self.reply = reply
        self.relay = None

    async def send(self, message):
        self.sent.append(message)
        if message.get("type") == "prompt" and self.reply is not None:
            asyncio.get_running_loop().call_soon(self.relay.deliver, {"type": "answer", "id": message["id"], "content": self.reply})


def with_browser(reply="hello from the laptop", timeout=5.0):
    browser = FakeBrowser(reply)
    browser.relay = device_llm.DeviceRelay(browser.send, timeout=timeout)
    return browser


class RelayTests(unittest.TestCase):
    def test_a_prompt_goes_to_the_browser_and_its_answer_comes_back(self):
        browser = with_browser()

        async def go():
            return await browser.relay.chat.completions.create(model="device", messages=[{"role": "user", "content": "hi"}],
                                                               temperature=0.3, max_tokens=50, response_format={"type": "json_object"})
        out = asyncio.run(go())
        self.assertEqual(out.choices[0].message.content, "hello from the laptop")
        self.assertIsNone(out.usage)
        prompt = browser.sent[0]
        self.assertEqual((prompt["type"], prompt["max_tokens"], prompt["json"], prompt["temperature"]), ("prompt", 50, True, 0.3))
        self.assertEqual(browser.relay.answered, 1)

    def test_an_error_from_the_browser_fails_that_call(self):
        browser = with_browser(reply=None)

        async def go():
            task = asyncio.create_task(browser.relay.chat.completions.create(messages=[]))
            await asyncio.sleep(0)
            browser.relay.deliver({"type": "error", "id": browser.sent[0]["id"]})
            return await task
        with self.assertRaises(device_llm.DeviceUnavailable):
            asyncio.run(go())
        self.assertEqual(browser.relay.failed, 1)

    def test_a_slow_device_times_out_and_a_closed_one_fails_at_once(self):
        browser = with_browser(reply=None, timeout=0.05)
        with self.assertRaises(device_llm.DeviceUnavailable):
            asyncio.run(browser.relay.chat.completions.create(messages=[]))
        browser.relay.close()
        with self.assertRaises(device_llm.DeviceUnavailable):
            asyncio.run(browser.relay.chat.completions.create(messages=[]))

    def test_a_socket_the_browser_has_left_fails_the_call_as_unavailable(self):
        async def gone(_message):
            raise RuntimeError("Unexpected ASGI message 'websocket.send', after sending 'websocket.close'")
        relay = device_llm.DeviceRelay(gone)
        with self.assertRaises(device_llm.DeviceUnavailable):
            asyncio.run(relay.chat.completions.create(messages=[]))
        self.assertEqual((relay.failed, relay._pending), (1, {}))

    def test_unknown_or_repeated_answers_are_ignored_and_long_ones_cut(self):
        browser = with_browser(reply=None)

        async def go():
            task = asyncio.create_task(browser.relay.chat.completions.create(messages=[]))
            await asyncio.sleep(0)
            call_id = browser.sent[0]["id"]
            self.assertFalse(browser.relay.deliver({"type": "answer", "id": "nope", "content": "x"}))
            self.assertTrue(browser.relay.deliver({"type": "answer", "id": call_id, "content": "y" * 50_000}))
            self.assertFalse(browser.relay.deliver({"type": "answer", "id": call_id, "content": "again"}))
            return await task
        out = asyncio.run(go())
        self.assertEqual(len(out.choices[0].message.content), device_llm.MAX_ANSWER_CHARS)


class HarnessTests(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-not-used", "PRIVATE_MODE": "off", "LOCAL_LLM_BASE_URL": ""})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_choosing_the_device_keeps_it_and_never_becomes_a_cloud_model(self):
        selection = llm.parse_selection({"model": "device"})
        self.assertEqual(selection.model, "device")
        with llm.use_selection(selection):
            model, _effort = llm.resolve("path_planning")
            self.assertIsNone(model, "without the person's connection there must be no model, not a cloud one")
            with device_llm.use_device(with_browser().relay):
                model, _effort = llm.resolve("path_planning")
                self.assertEqual(model.id, "device")

    def test_the_agents_helpers_work_through_the_device_and_nothing_is_charged(self):
        browser = with_browser(reply='{"steps": ["Call the clinic"]}')
        with mock.patch("core.budget.check", side_effect=AssertionError("a device call must not be checked against limits")), \
                mock.patch("core.budget.record", side_effect=AssertionError("a device call must not be charged")):
            with llm.use_selection(llm.parse_selection({"model": "device"}), actor="u1", verified=True):
                with device_llm.use_device(browser.relay):
                    self.assertTrue(llm.is_enabled())
                    out = asyncio.run(llm.complete_json("Plan a step.", "Goal: see a doctor", agent="path_planning"))
                    text = asyncio.run(llm.complete_text("Say hi.", "hi", agent="adaptation"))
        self.assertEqual(out, {"steps": ["Call the clinic"]})
        self.assertEqual(text, '{"steps": ["Call the clinic"]}')
        self.assertTrue(browser.sent[0]["json"])
        self.assertIn("Respond ONLY with valid JSON", browser.sent[0]["messages"][0]["content"])

    def test_a_device_that_fails_gives_the_agent_no_answer_not_a_cloud_one(self):
        browser = with_browser(reply=None, timeout=0.05)
        with llm.use_selection(llm.parse_selection({"model": "device"})):
            with device_llm.use_device(browser.relay):
                self.assertIsNone(asyncio.run(llm.complete_text("s", "u")))

    def test_the_device_is_not_a_server_choice(self):
        self.assertFalse(registry.is_model_available("device"))
        self.assertNotIn("device", registry.available_model_ids())
        self.assertNotIn("device", [m["id"] for m in registry.catalogue()["models"]])
        self.assertNotEqual(registry.default_model_id(), "device")


class EmbeddingTests(unittest.TestCase):
    def test_no_embedding_goes_to_openai_during_a_device_run(self):
        from core.agents.pattern_recognition_agent import PatternRecognitionAgent
        agent = PatternRecognitionAgent.__new__(PatternRecognitionAgent)
        called = []

        async def create(**kwargs):
            called.append(kwargs)
            raise AssertionError("must not be called during a device run")
        agent._openai_client = mock.Mock(embeddings=mock.Mock(create=create))
        with device_llm.use_device(with_browser().relay):
            out = asyncio.run(agent._generate_embedding({}, ["swim"], ["ADHD"]))
        self.assertIsNone(out)
        self.assertEqual(called, [])


class WebSocketTests(unittest.TestCase):
    def client(self):
        from fastapi.testclient import TestClient
        import main
        return TestClient(main.app)

    async def fake_pipeline(self, request, actor=None, on_stage=None, job_id=None):
        on_stage("Mapping out your milestones")
        with llm.use_selection(llm.parse_selection(request.llmConfig), actor=actor, verified=True):
            answer = await llm.complete_text("Write one step.", "Goal: swim", agent="path_planning")
        self.seen = (request.userId, request.llmConfig, answer)
        return "path_test123"

    def start(self, ws, token="good"):
        ws.send_json({"type": "start", "token": token, "request": {"userId": "user-1", "email": "a@example.org", "motivationType": "intrinsic", "barrierTypes": [], "goals": ["swim"],
                                                                    "llmConfig": {"model": "gpt-4o"}}})

    def test_a_plan_is_made_with_every_call_answered_by_the_device(self):
        with mock.patch("api.auth_guard.onboarding_user_id", return_value="user-1"), \
                mock.patch("api.routes.onboarding._generate_path_for", self.fake_pipeline):
            with self.client().websocket_connect("/api/device/plan") as ws:
                self.start(ws)
                messages = []
                while True:
                    m = ws.receive_json()
                    messages.append(m)
                    if m["type"] == "prompt":
                        ws.send_json({"type": "answer", "id": m["id"], "content": "Find a pool near you."})
                    if m["type"] in ("done", "error"):
                        break
        self.assertEqual(messages[-1], {"type": "done", "pathId": "path_test123", "answered": 1, "failed": 0})
        self.assertIn({"type": "stage", "stage": "Mapping out your milestones"}, messages)
        user, config, answer = self.seen
        self.assertEqual((user, config["model"], answer), ("user-1", "device", "Find a pool near you."))

    def test_a_bad_token_is_refused_before_anything_runs(self):
        from fastapi import HTTPException
        with mock.patch("api.auth_guard.onboarding_user_id", side_effect=HTTPException(status_code=401, detail="Invalid or expired session.")):
            with self.client().websocket_connect("/api/device/plan") as ws:
                self.start(ws, token="bad")
                self.assertEqual(ws.receive_json(), {"type": "error", "message": "Invalid or expired session."})

    def test_another_persons_plan_is_refused(self):
        with mock.patch("api.auth_guard.onboarding_user_id", return_value="someone-else"):
            with self.client().websocket_connect("/api/device/plan") as ws:
                self.start(ws)
                self.assertEqual(ws.receive_json()["type"], "error")

    def test_a_site_not_on_the_list_cannot_open_it(self):
        from starlette.websockets import WebSocketDisconnect
        with self.assertRaises(WebSocketDisconnect):
            with self.client().websocket_connect("/api/device/plan", headers={"origin": "https://evil.example"}) as ws:
                ws.receive_json()


if __name__ == "__main__":
    unittest.main()
