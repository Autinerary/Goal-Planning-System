"""The tuning script's serve command (frontend/public/own-model/autinerary_model.py), without a model.

On Windows and Linux, Ollama can't add a tuned model, so the script runs it itself and answers the way the app asks a
model on the person's computer (frontend lib/localModel.ts): it lists the model at /v1/models and answers at
/v1/chat/completions, with JSON when asked. It isn't Ollama's own API, so the app asks it the OpenAI way. Only
Autinerary, this computer's own pages and sites the person adds may use it from a browser, and only by this computer's
own names (so a website can't reach it by pointing its own name here).

Run from backend/:  python -m unittest tests.test_own_model_script -v
"""
import contextlib
import http.client
import importlib.util
import io
import json
import pathlib
import threading
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "public" / "own-model" / "autinerary_model.py"
_spec = importlib.util.spec_from_file_location("autinerary_model", SCRIPT)
script = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(script)


class FakeAnswerer:
    """The model's side: what it was asked, and a fixed answer."""
    def __init__(self):
        self.asked = []

    def answer(self, messages, max_tokens, temperature, json_mode):
        self.asked.append({"messages": messages, "max_tokens": max_tokens, "temperature": temperature, "json": json_mode})
        return ('{"tips": ["Go early."]}' if json_mode else "Go when it's quiet."), 12, 5


class ServeTests(unittest.TestCase):
    def setUp(self):
        self.answerer = FakeAnswerer()
        self.server = script.make_server(self.answerer, "my-model", 0, ["https://example.org"])
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def call(self, method, path, body=None, headers=None, host=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request(method, path, body=None if body is None else json.dumps(body),
                     headers={"Host": host or f"localhost:{self.port}", "Content-Type": "application/json", **(headers or {})})
        response = conn.getresponse()
        data = response.read()
        conn.close()
        return response.status, {k.lower(): v for k, v in response.getheaders()}, json.loads(data) if data else None

    def ask(self, headers=None, **extra):
        return self.call("POST", "/v1/chat/completions", {"model": "my-model", "messages": [
            {"role": "system", "content": "You help with plans."}, {"role": "user", "content": "What helps at the pool?"}], **extra},
            headers=headers)

    def test_it_lists_its_model_the_way_the_app_asks(self):
        status, _, body = self.call("GET", "/v1/models")
        self.assertEqual(status, 200)
        self.assertEqual([m["id"] for m in body["data"]], ["my-model"])

    def test_it_isnt_ollamas_own_api_so_the_app_asks_it_the_openai_way(self):
        self.assertEqual(self.call("GET", "/api/version")[0], 404)
        self.assertEqual(self.call("POST", "/api/show", {"model": "my-model"})[0], 404)
        self.assertEqual(self.call("POST", "/api/chat", {"model": "my-model", "messages": []})[0], 404)
        self.assertEqual(self.answerer.asked, [])

    def test_an_answer(self):
        status, _, body = self.ask(max_tokens=100, temperature=0.2, stream=False)
        self.assertEqual(status, 200)
        self.assertEqual(body["choices"][0]["message"], {"role": "assistant", "content": "Go when it's quiet."})
        self.assertEqual(body["model"], "my-model")
        self.assertEqual(body["usage"], {"prompt_tokens": 12, "completion_tokens": 5, "total_tokens": 17})
        self.assertEqual(self.answerer.asked[0]["messages"][1], {"role": "user", "content": "What helps at the pool?"})
        self.assertEqual((self.answerer.asked[0]["max_tokens"], self.answerer.asked[0]["temperature"], self.answerer.asked[0]["json"]),
                         (100, 0.2, False))

    def test_json_when_asked(self):
        status, _, body = self.ask(response_format={"type": "json_object"})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body["choices"][0]["message"]["content"]), {"tips": ["Go early."]})
        self.assertTrue(self.answerer.asked[0]["json"])

    def test_limits_and_defaults(self):
        self.ask(max_tokens=99999, temperature=9)
        self.ask()
        self.assertEqual([(a["max_tokens"], a["temperature"]) for a in self.answerer.asked], [(4096, 2.0), (600, 0.7)])

    def test_a_bad_request_runs_nothing(self):
        for body in ({}, {"messages": []}, {"messages": [{"role": "tool", "content": "x"}]}, {"messages": [{"role": "user"}]}):
            self.assertEqual(self.call("POST", "/v1/chat/completions", body)[0], 400, body)
        self.assertEqual(self.answerer.asked, [])

    def test_autinerary_and_this_computers_pages_may_ask_from_a_browser(self):
        for origin in ("https://app.autinerary.ca", "http://localhost:3100", "http://127.0.0.1:8080", "https://example.org"):
            status, headers, _ = self.ask(headers={"Origin": origin})
            self.assertEqual((status, headers.get("access-control-allow-origin")), (200, origin), origin)
        status, headers, _ = self.call("OPTIONS", "/v1/chat/completions", headers={
            "Origin": "https://app.autinerary.ca", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type", "Access-Control-Request-Private-Network": "true"})
        self.assertEqual(status, 204)
        self.assertEqual(headers.get("access-control-allow-origin"), "https://app.autinerary.ca")
        self.assertIn("POST", headers.get("access-control-allow-methods", ""))
        self.assertIn("Content-Type", headers.get("access-control-allow-headers", ""))
        self.assertEqual(headers.get("access-control-allow-private-network"), "true")

    def test_other_sites_cant_use_it(self):
        for origin in ("https://evil.example", "http://localhost.evil.example", "https://app.autinerary.ca.evil.example"):
            status, headers, body = self.ask(headers={"Origin": origin})
            self.assertEqual(status, 403, origin)
            self.assertNotIn("access-control-allow-origin", headers)
        self.assertEqual(self.answerer.asked, [], "the model never ran for them")
        status, headers, _ = self.call("OPTIONS", "/v1/chat/completions", headers={"Origin": "https://evil.example"})
        self.assertNotIn("access-control-allow-origin", headers)

    def test_only_by_this_computers_own_names(self):
        # A website that points its own name at 127.0.0.1 sends that name as the Host.
        for host in (f"evil.example:{self.port}", "evil.example"):
            status = self.call("POST", "/v1/chat/completions", {"messages": [{"role": "user", "content": "Hi"}]}, host=host)[0]
            self.assertEqual(status, 403, host)
            self.assertEqual(self.call("GET", "/v1/models", host=host)[0], 403, host)
        self.assertEqual(self.answerer.asked, [])
        self.assertEqual(self.call("GET", "/v1/models", host=f"127.0.0.1:{self.port}")[0], 200)


class HelperTests(unittest.TestCase):
    def test_the_json_object_in_an_answer(self):
        self.assertEqual(script.json_object('Sure! ```json\n{"tips": ["a"]}\n```'), {"tips": ["a"]})
        self.assertEqual(script.json_object('{"a": {"b": "}"}} and then more'), {"a": {"b": "}"}})
        self.assertEqual(script.json_object('[1, 2] {"x": 1}'), {"x": 1})
        self.assertEqual(script.json_object('{"broken": } {"ok": true}'), {"ok": True})
        self.assertIsNone(script.json_object("No JSON here."))

    def test_a_model_name_from_a_files_name(self):
        self.assertEqual(script.clean_name("Calm First Steps (1)"), "calm-first-steps-1")
        self.assertEqual(script.clean_name("calm-first-steps"), "calm-first-steps")
        self.assertEqual(script.clean_name("***"), "shared-model")

    def test_how_to_use_it_from_here(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            script.use_it_here("my-model", "my-model", "Ollama isn't on this computer")
            script.use_it_here("calm", "/Users/x/Calm Steps.safetensors", "Ollama on this computer can't add a tuned model yet")
            script.use_it_here("calm-steps", "/Users/x/calm-steps.safetensors", "Ollama isn't on this computer")
        text = out.getvalue()
        self.assertIn("autinerary_model.py serve my-model\n", text)
        self.assertIn('serve "/Users/x/Calm Steps.safetensors" --name calm\n', text)
        self.assertIn("serve /Users/x/calm-steps.safetensors\n", text)
        self.assertIn("http://localhost:11435/v1", text)


if __name__ == "__main__":
    unittest.main()
