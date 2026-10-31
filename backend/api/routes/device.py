"""Making a plan with a small open model on the person's own device (Settings, "Use my own model").

    WebSocket /api/device/plan

The browser opens this connection, sends {"type": "start", "token": <Supabase access token>, "request": <the same
body as POST /api/onboarding/jobs>}, and keeps it open while the agents run. Each model call arrives as
{"type": "prompt", "id", "messages", "temperature", "max_tokens", "json"}; the browser answers with
{"type": "answer", "id", "content"} or {"type": "error", "id"} after asking the model on the person's laptop. Progress
comes as {"type": "stage", "stage"}, and the end as {"type": "done", "pathId", "answered", "failed"} or
{"type": "error", "message"}.

One connection, one process: the run and its prompts stay in this worker's memory and nowhere else (no queue, no
table, no log), which is also why this is a WebSocket rather than polling, which another worker could answer.

The pipeline is the same as every other plan (onboarding._generate_path_for). Only the model differs: the person's
choice is forced to their device here, and core.llm never puts a cloud model in its place (core/device_llm.py).
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from core import budget, device_llm

router = APIRouter()

START_TIMEOUT_SECONDS = 20
RUN_TIMEOUT_SECONDS = 30 * 60          # a whole plan on a slow laptop; a bound on a stuck run, not an estimate
_running: Set[str] = set()             # one plan on a device per person at a time


def _origin_allowed(origin: Optional[str]) -> bool:
    """Browsers send Origin on a WebSocket and CORS doesn't apply to one, so it is checked here against the same list."""
    if not origin:
        return True                    # not a browser (tests, scripts): the token still has to be valid
    import main
    return origin in main._cors_origins()


@router.websocket("/plan")
async def plan_on_device(ws: WebSocket) -> None:
    if not _origin_allowed(ws.headers.get("origin")):
        await ws.close(code=4403)
        return
    await ws.accept()

    send_lock = asyncio.Lock()

    async def send(message: Dict[str, Any]) -> None:
        async with send_lock:
            await ws.send_json(message)

    async def fail(message: str) -> None:
        try:
            await send({"type": "error", "message": message})
            await ws.close()
        except Exception:
            pass

    try:
        start = await asyncio.wait_for(ws.receive_json(), START_TIMEOUT_SECONDS)
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError):
        await fail("No plan request arrived.")
        return
    if not isinstance(start, dict) or start.get("type") != "start":
        await fail("No plan request arrived.")
        return

    from api.auth_guard import onboarding_user_id
    from api.routes.onboarding import OnboardingRequest, _generate_path_for

    try:
        actor = onboarding_user_id(f"Bearer {start.get('token') or ''}")
    except HTTPException as e:
        await fail(str(e.detail))
        return
    try:
        request = OnboardingRequest.model_validate(start.get("request") or {})
    except Exception:
        await fail("That plan request isn't valid.")
        return
    if request.userId and request.userId != actor:
        await fail("Cannot create another account's path.")
        return
    request.userId = actor
    # Whatever the browser sent, every agent uses the person's device in this run.
    config = request.llmConfig if isinstance(request.llmConfig, dict) else {}
    request.llmConfig = {**config, "model": "device", "agents": {}}

    if actor in _running:
        await fail("A plan is already being made on your device. Wait for it to finish.")
        return
    _running.add(actor)
    relay = device_llm.DeviceRelay(send)

    async def send_stage(label: str) -> None:
        try:
            await send({"type": "stage", "stage": label})
        except Exception:
            pass                       # the browser has left; the run is being stopped

    def on_stage(label: str) -> None:
        asyncio.get_running_loop().create_task(send_stage(label))

    async def run() -> str:
        with device_llm.use_device(relay):
            return await _generate_path_for(request, actor=actor, on_stage=on_stage)

    async def read() -> None:
        while True:
            message = await ws.receive_json()
            if isinstance(message, dict) and message.get("type") in ("answer", "error"):
                relay.deliver(message)
            elif isinstance(message, dict) and message.get("type") == "cancel":
                return

    work = asyncio.create_task(asyncio.wait_for(run(), RUN_TIMEOUT_SECONDS))
    reader = asyncio.create_task(read())
    try:
        await asyncio.wait({work, reader}, return_when=asyncio.FIRST_COMPLETED)
        if not work.done():
            # The browser left or cancelled: the run can't continue without its model.
            relay.close()
            work.cancel()
            return
        reader.cancel()
        try:
            path_id = work.result()
        except HTTPException as e:
            await fail(str(e.detail))
            return
        except budget.LimitExceeded as e:
            await fail(e.message)
            return
        except asyncio.TimeoutError:
            await fail("Making your plan took too long on your device.")
            return
        except Exception as e:
            print(f"[device] plan failed: {type(e).__name__}")
            await fail("Path generation failed. Please try again.")
            return
        await send({"type": "done", "pathId": path_id, "answered": relay.answered, "failed": relay.failed})
        await ws.close()
    except WebSocketDisconnect:
        relay.close()
        work.cancel()
    finally:
        relay.close()
        reader.cancel()
        _running.discard(actor)
