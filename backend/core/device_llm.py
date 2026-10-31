"""A small open model on the person's own device, reached through their browser.

Our server (Render) can't reach anyone's localhost, so when someone chooses "Use my own model" their browser
opens one WebSocket to us (api/routes/device.py) and stays on it while the agents run. Each time an agent asks a
model something, the prompt goes down that connection; the browser asks the model on the person's laptop (Ollama's
OpenAI-compatible API, by default http://localhost:11434/v1) and sends the answer back the same way.

What this means, said plainly (and in the Settings copy): the prompts and answers never go to OpenAI, Google,
Anthropic or any other model provider; our server still builds the prompts from what the person entered, receives
the answers and saves their plan, as it does for every plan. Nothing here is stored or logged: a prompt lives only
in memory until its answer arrives.

To the agents, DeviceRelay looks like an OpenAI client (`relay.chat.completions.create(...)`), so core.llm's helpers
and all six agents work unchanged. It exists only for the length of one connection (use_device), so it can't be
picked up by another request, and a person who chose their own model never gets a cloud model in its place: with no
connection, core.llm.resolve returns no model and the agents take their rule-based path.
"""
from __future__ import annotations

import asyncio
import contextlib
from contextvars import ContextVar
from types import SimpleNamespace
from typing import Any, Awaitable, Callable, Dict, Optional

# How long one answer may take. A 3B model on a laptop writes about 20 tokens a second, and a plan step asks for up
# to ~1,200 tokens, so a minute is normal; three leaves room for a slow machine without hanging a run forever.
ANSWER_TIMEOUT_SECONDS = 180.0
# The most a device may send back for one prompt (characters). Longer answers are cut, not trusted.
MAX_ANSWER_CHARS = 32_000


class DeviceUnavailable(RuntimeError):
    """The person's model didn't answer: the connection closed, it timed out, or it reported an error."""


class DeviceRelay:
    """One open connection's worth of model calls. `send` delivers a message to the browser."""

    def __init__(self, send: Callable[[Dict[str, Any]], Awaitable[None]], timeout: float = ANSWER_TIMEOUT_SECONDS):
        self._send = send
        self._timeout = timeout
        self._pending: Dict[str, asyncio.Future] = {}
        self._next_id = 0
        self.closed = False
        self.answered = 0
        self.failed = 0
        # The shape core.llm calls: client.chat.completions.create(**kwargs).
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, *, messages: Any, temperature: Optional[float] = None, max_tokens: Optional[int] = None,
                      max_completion_tokens: Optional[int] = None, response_format: Any = None, **_ignored: Any):
        if self.closed:
            self.failed += 1
            raise DeviceUnavailable("the connection to your device closed")
        self._next_id += 1
        call_id = str(self._next_id)
        future = asyncio.get_running_loop().create_future()
        self._pending[call_id] = future
        try:
            try:
                await self._send({
                    "type": "prompt",
                    "id": call_id,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens or max_completion_tokens,
                    # The agent wants JSON back: the browser asks the model for it where the model can do so.
                    "json": bool(response_format),
                })
            except Exception as e:
                # A socket the browser has left raises here.
                raise DeviceUnavailable("the connection to your device closed") from e
            content = await asyncio.wait_for(future, self._timeout)
        except asyncio.TimeoutError:
            self.failed += 1
            raise DeviceUnavailable("your device's model took too long to answer")
        except DeviceUnavailable:
            self.failed += 1
            raise
        finally:
            self._pending.pop(call_id, None)
        self.answered += 1
        # No usage: a model on the person's own device costs us nothing and isn't charged to their limits.
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))], usage=None)

    def deliver(self, message: Dict[str, Any]) -> bool:
        """An answer (or an error) from the browser. Unknown or repeated ids are ignored. Returns True if used."""
        future = self._pending.get(str(message.get("id")))
        if future is None or future.done():
            return False
        content = message.get("content")
        if message.get("type") == "answer" and isinstance(content, str):
            future.set_result(content[:MAX_ANSWER_CHARS])
        else:
            future.set_exception(DeviceUnavailable("your device's model could not answer"))
        return True

    def close(self) -> None:
        """The connection ended: every call still waiting fails, and any later call fails at once."""
        self.closed = True
        for future in list(self._pending.values()):
            if not future.done():
                future.set_exception(DeviceUnavailable("the connection to your device closed"))


_relay: ContextVar[Optional[DeviceRelay]] = ContextVar("device_relay", default=None)


@contextlib.contextmanager
def use_device(relay: DeviceRelay):
    """Route this block's model calls to the person's device (when they chose it; core.llm.resolve)."""
    token = _relay.set(relay)
    try:
        yield relay
    finally:
        _relay.reset(token)


def current() -> Optional[DeviceRelay]:
    return _relay.get()
