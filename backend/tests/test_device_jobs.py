"""Everything else that writes with AI, on the person's own device (api/routes/device.py, /run; core.llm.resolve).

What must hold: while a job runs on their device, every model call in it goes there, even where the code asks for the
default (cloud) model; each job is the endpoint's own work, with its own result; the assistant gets About me and
"Words we use" from the person's own row, as the app's route does, and About me only when they share it; nothing runs
for an unknown job or a bad session, and one of each job at a time.

Run from backend/:  python -m unittest tests.test_device_jobs -v
"""
import asyncio
import unittest
from unittest import mock

from core import device_llm, llm, model_registry as registry


class Answers:
    """A browser's side of the connection: answers each prompt and remembers what it was asked."""
    def __init__(self, ws, content="An answer from the device."):
        self.ws, self.content, self.prompts = ws, content, []

    def run(self):
        while True:
            m = self.ws.receive_json()
            if m["type"] == "prompt":
                self.prompts.append(m)
                self.ws.send_json({"type": "answer", "id": m["id"], "content": self.content})
            if m["type"] in ("done", "error"):
                return m


class ResolveTests(unittest.TestCase):
    def test_while_the_device_is_connected_every_call_goes_to_it(self):
        relay = device_llm.DeviceRelay(lambda message: asyncio.sleep(0))
        with device_llm.use_device(relay):
            for selection in (None, {"model": "gpt-4o"}, {"model": "gpt-4o-mini", "agents": {"path_planning": {"model": "claude-opus"}}}):
                with llm.use_selection(llm.parse_selection(selection) if selection else None, actor="user-1", verified=True):
                    model, _ = llm.resolve("path_planning")
                    self.assertEqual(model.id, "device", selection)
        relay.close()
        # And without a connection, the person's own choice is kept as it was.
        with llm.use_selection(llm.parse_selection({"model": "gpt-4o-mini"}), actor="user-1", verified=True):
            model, _ = llm.resolve()
            self.assertNotEqual(getattr(model, "id", None), "device")


class WithoutAModelTests(unittest.TestCase):
    """A journal entry saved while the person's own model isn't ready: read by the agents' rules, by no model at all."""

    def test_no_model_answers_inside_it(self):
        relay = device_llm.DeviceRelay(lambda message: asyncio.sleep(0))
        with mock.patch.object(registry, "available_model_ids", return_value=["gpt-4o-mini"]):
            with llm.without_a_model():
                with device_llm.use_device(relay), llm.use_selection(llm.parse_selection({"model": "gpt-4o-mini"}), actor="user-1", verified=True):
                    self.assertEqual(llm.resolve("reflection_analysis")[0], None)
                    self.assertFalse(llm.is_enabled())
                    self.assertIsNone(asyncio.run(llm.complete_text("s", "u")))
            self.assertTrue(llm.is_enabled(), "and only inside it")
        relay.close()

    def test_an_entry_without_an_ai_reading_is_still_saved(self):
        from types import SimpleNamespace
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.routes import reflections
        from core import learning
        seen = []

        async def adapt_path(**kwargs):
            seen.append(llm.is_enabled())
            return {"agentResponses": [{"agentId": "reflection_analysis", "result": {"sentiment": {"label": "neutral"}}}]}

        app = FastAPI()
        app.include_router(reflections.router, prefix="/api/reflections")
        orchestrator = SimpleNamespace(adapt_path=adapt_path)
        persist = mock.MagicMock(return_value="r1")
        with mock.patch.object(registry, "available_model_ids", return_value=["gpt-4o-mini"]), \
                mock.patch.object(reflections, "_verified_user_id", lambda authorization: "user-1"), \
                mock.patch.object(reflections, "_get_orchestrator", mock.AsyncMock(return_value=orchestrator)), \
                mock.patch.object(learning, "persist_reflection", persist):
            client = TestClient(app)
            entry = {"contextType": "path", "contextId": "c", "questions": [{"id": "q1", "question": "How did it go?", "answer": "Well."}]}
            self.assertEqual(client.post("/api/reflections/", json={**entry, "aiReading": False}).json()["reflectionId"], "r1")
            self.assertEqual(client.post("/api/reflections/", json=entry).status_code, 200)
        self.assertEqual(seen, [False, True], "no model for the first, the usual one for the second")
        self.assertEqual(persist.call_count, 2)


class AboutMeTests(unittest.TestCase):
    def test_the_same_words_as_the_app(self):
        from api.routes.device import about_me_for_assistant
        about = {"shareWithAssistant": True, "sections": {"helps": "Written  instructions,\nquiet places.", "hard": "Phone calls.", "strengths": ""}}
        self.assertEqual(about_me_for_assistant(about),
                         "About them, in their own words (from their About me page):\nWhat helps me: Written instructions, quiet places.\nWhat's hard for me: Phone calls.")
        self.assertEqual(about_me_for_assistant({**about, "shareWithAssistant": False}), "", "only when they share it")
        self.assertEqual(about_me_for_assistant(None), "")
        long = about_me_for_assistant({"shareWithAssistant": True, "sections": {"other": "x " * 2000}})
        self.assertEqual(len(long), 900)
        self.assertTrue(long.endswith("…"))


class JobTests(unittest.TestCase):
    def client(self):
        from fastapi.testclient import TestClient
        import main
        return TestClient(main.app)

    def start(self, ws, job, request=None, token="good"):
        ws.send_json({"type": "start", "token": token, "job": job, "request": request or {}})

    def test_a_job_runs_with_every_call_answered_by_the_device(self):
        seen = {}

        async def fake_guidance(request=None, caller_id=None):
            # As the endpoint does: it asks for the default model, and gets the device.
            with llm.use_selection(None, actor=caller_id, verified=True):
                seen["model"] = llm.active_model_id()
                seen["answer"] = await llm.complete_text("What helps at this step?", "Step: find a pool")
            return {"guidance": {"m1": {"tips": [seen["answer"]]}}, "pathId": "path_x"}

        with mock.patch("api.auth_guard.current_user_id", return_value="user-1"), \
                mock.patch("api.routes.paths.my_guidance", fake_guidance):
            with self.client().websocket_connect("/api/device/run") as ws:
                self.start(ws, "guidance", {"languageStyle": "person"})
                browser = Answers(ws, "Go when it's quiet.")
                done = browser.run()
        self.assertEqual(done, {"type": "done", "result": {"guidance": {"m1": {"tips": ["Go when it's quiet."]}}, "pathId": "path_x"}, "answered": 1, "failed": 0})
        self.assertEqual(seen["model"], "device")
        self.assertEqual(len(browser.prompts), 1)

    def test_each_job_is_its_endpoints_own_work(self):
        from api.routes import device
        calls = []

        async def record(name, result):
            calls.append(name)
            return result

        with mock.patch("api.routes.paths.my_guidance", lambda request=None, caller_id=None: record("guidance", {"ok": 1})), \
                mock.patch("api.routes.paths.build_my_goal_steps", lambda request, caller_id=None: record(f"goal-steps:{request.goal}", {"added": 3})), \
                mock.patch("api.routes.reflections.create_reflection", lambda request, authorization=None: record(f"reflection:{authorization}", {"reflectionId": "r1"})), \
                mock.patch("api.routes.onboarding.goal_helper", lambda request, actor=None: record(f"goal-helper:{request.text}:{actor}", {"suggestions": []})):
            self.assertEqual(asyncio.run(device._run_job("guidance", {}, "user-1", "tok")), {"ok": 1})
            self.assertEqual(asyncio.run(device._run_job("goal-steps", {"goal": "Swim weekly"}, "user-1", "tok")), {"added": 3})
            self.assertEqual(asyncio.run(device._run_job("reflection", {"contextType": "path", "contextId": "c", "questions": [{"id": "q1", "question": "How did it go?", "answer": "Well."}]}, "user-1", "tok")), {"reflectionId": "r1"})
            self.assertEqual(asyncio.run(device._run_job("goal-helper", {"text": "I want to swim", "ideas": [{"category": "health", "text": "Swim weekly"}]}, "user-1", "tok")), {"suggestions": []})
        self.assertEqual(calls, ["guidance", "goal-steps:Swim weekly", "reflection:Bearer tok", "goal-helper:I want to swim:user-1"])

    def test_the_assistant_gets_about_me_and_words_we_use_from_their_own_row(self):
        from api.routes import device
        captured = {}

        async def fake_chat(req, actor=None):
            captured.update(context=req.context, style=req.language_style, messages=[m.content for m in req.messages], actor=actor)
            return {"configured": True, "reply": "Hello.", "model": "device"}

        prefs = {"languageStyle": "identity", "aboutMe": {"shareWithAssistant": True, "sections": {"helps": "Quiet places."}}}
        with mock.patch("api.routes.assistant.chat", fake_chat), mock.patch.object(device, "_own_profile", return_value=prefs):
            out = asyncio.run(device._run_job("assistant", {"messages": [{"role": "user", "content": "Hi"}], "context": "Goals: swim", "aboutMe": "sent by the browser"}, "user-1", "tok"))
        self.assertEqual(out["reply"], "Hello.")
        self.assertEqual(captured["context"], "About them, in their own words (from their About me page):\nWhat helps me: Quiet places.\n\nGoals: swim")
        self.assertEqual((captured["style"], captured["messages"], captured["actor"]), ("identity", ["Hi"], "user-1"))
        self.assertNotIn("sent by the browser", captured["context"], "About me is read from their row, never taken from the browser")

    def test_an_unknown_job_or_a_bad_session_runs_nothing(self):
        from fastapi import HTTPException
        with self.client().websocket_connect("/api/device/run") as ws:
            self.start(ws, "delete-everything")
            self.assertEqual(ws.receive_json(), {"type": "error", "message": "That can't run on your device."})
        with mock.patch("api.auth_guard.current_user_id", side_effect=HTTPException(status_code=401, detail="Invalid or expired session.")):
            with self.client().websocket_connect("/api/device/run") as ws:
                self.start(ws, "guidance", token="bad")
                self.assertEqual(ws.receive_json(), {"type": "error", "message": "Invalid or expired session."})

    def test_one_of_each_job_at_a_time(self):
        from api.routes import device
        device._jobs.add("user-1:guidance")
        try:
            with mock.patch("api.auth_guard.current_user_id", return_value="user-1"):
                with self.client().websocket_connect("/api/device/run") as ws:
                    self.start(ws, "guidance")
                    self.assertEqual(ws.receive_json()["message"], "That's already being written on your device. Wait for it to finish.")
        finally:
            device._jobs.discard("user-1:guidance")

    def test_a_site_not_on_the_list_cannot_open_it(self):
        from starlette.websockets import WebSocketDisconnect
        with self.assertRaises(WebSocketDisconnect):
            with self.client().websocket_connect("/api/device/run", headers={"origin": "https://evil.example"}) as ws:
                ws.receive_json()


if __name__ == "__main__":
    unittest.main()
