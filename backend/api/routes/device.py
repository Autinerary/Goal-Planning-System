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
    """Browsers send Origin on a WebSocket and CORS doesn't apply to one, so it is checked here, by the same rule as the
    CORS middleware: the list and the pattern (main.cors_origin_allowed). Checking the list alone refused the app's
    own address in production (2 November 2026), where it's allowed by the pattern, not listed."""
    if not origin:
        return True                    # not a browser (tests, scripts): the token still has to be valid
    import main
    return main.cors_origin_allowed(origin)


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


# ---- Everything else that writes with AI, on the person's device ---------------------------------------------------
#
#     WebSocket /api/device/run
#
# The same as /plan, for the other work that writes with AI while "Use my own model" is on: the browser sends
# {"type": "start", "token", "job", "request"}, answers each prompt from the model on the person's device, and gets
# {"type": "done", "result"} (the same result the job's own endpoint returns) or {"type": "error", "message"}.
#   guidance     what to avoid and what helps at each step (POST /api/paths/me/guidance)
#   goal-steps   the steps for a goal added later (POST /api/paths/me/goal-steps)
#   reflection   a journal entry: its insights, and the plan changes it suggests (POST /api/reflections/)
#   assistant    the assistant's answer (the app's /api/assistant/chat, with About me and "Words we use" read here
#                from the person's own row, as that route reads them)
#   goal-helper  goal ideas from what they wrote in setup (POST /api/onboarding/goal-helper)
# While it runs every model call goes to their device (core.llm.resolve): nothing in it reaches a cloud model.

JOBS = ("guidance", "goal-steps", "reflection", "assistant", "goal-helper")
JOB_TIMEOUT_SECONDS = RUN_TIMEOUT_SECONDS     # a goal's steps took about 15 minutes with llama3.2:3b on an M3 laptop
_jobs: Set[str] = set()                # one of each job per person at a time

# The About me page's sections, as frontend/lib/aboutMe.ts names them (ABOUT_ME_SECTIONS).
_ABOUT_ME = (("strengths", "What I'm good at"), ("helps", "What helps me"), ("hard", "What's hard for me"),
             ("know", "What I want people to know"), ("other", "Anything else"))


def about_me_for_assistant(about_me: Any, limit: int = 900) -> str:
    """About me, as the assistant gets it: only when its owner turned on "Share with the assistant" (the same words as
    frontend/lib/aboutMe.ts, aboutMeForAssistant)."""
    if not isinstance(about_me, dict) or about_me.get("shareWithAssistant") is not True:
        return ""
    sections = about_me.get("sections") if isinstance(about_me.get("sections"), dict) else {}
    lines = []
    for key, label in _ABOUT_ME:
        text = " ".join(str(sections.get(key) or "").split())
        if text:
            lines.append(f"{label}: {text}")
    if not lines:
        return ""
    block = "About them, in their own words (from their About me page):\n" + "\n".join(lines)
    return block if len(block) <= limit else block[: limit - 1] + "…"


def _own_profile(actor: str) -> Dict[str, Any]:
    from database.supabase_client import get_supabase
    sb = get_supabase()
    if sb is None:
        return {}
    try:
        rows = sb.table("profiles").select("preferences").eq("id", actor).limit(1).execute().data or []
    except Exception:
        return {}
    prefs = (rows[0].get("preferences") if rows else None) or {}
    return prefs if isinstance(prefs, dict) else {}


async def _run_job(job: str, request: Any, actor: str, token: str) -> Any:
    from fastapi.encoders import jsonable_encoder
    from api.routes import assistant, onboarding, paths, reflections

    body = request if isinstance(request, dict) else {}
    if job == "guidance":
        return await paths.my_guidance(paths.GuidanceRequest.model_validate(body), caller_id=actor)
    if job == "goal-steps":
        return await paths.build_my_goal_steps(paths.GoalStepsRequest.model_validate(body), caller_id=actor)
    if job == "reflection":
        out = await reflections.create_reflection(reflections.ReflectionRequest.model_validate(body),
                                                  authorization=f"Bearer {token}")
        return jsonable_encoder(out)
    if job == "goal-helper":
        return await onboarding.goal_helper(onboarding.GoalHelperRequest.model_validate(body), actor=actor)
    # The assistant: what the app's route adds, read here from the person's own row, never taken from the browser.
    prefs = await asyncio.to_thread(_own_profile, actor)
    style = prefs.get("languageStyle")
    chat = assistant.ChatRequest.model_validate({
        "messages": body.get("messages") or [],
        "context": "\n\n".join(x for x in (about_me_for_assistant(prefs.get("aboutMe")), str(body.get("context") or "")) if x),
        "language_style": style if style in ("identity", "person") else None,
    })
    return await assistant.chat(chat, actor=actor)


@router.websocket("/run")
async def run_on_device(ws: WebSocket) -> None:
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
        await fail("Nothing to do arrived.")
        return
    if not isinstance(start, dict) or start.get("type") != "start" or start.get("job") not in JOBS:
        await fail("That can't run on your device.")
        return
    job, token = start["job"], str(start.get("token") or "")

    from api.auth_guard import current_user_id
    try:
        actor = current_user_id(f"Bearer {token}")
    except HTTPException as e:
        await fail(str(e.detail))
        return
    key = f"{actor}:{job}"
    if key in _jobs:
        await fail("That's already being written on your device. Wait for it to finish.")
        return
    _jobs.add(key)
    relay = device_llm.DeviceRelay(send)

    async def work() -> Any:
        with device_llm.use_device(relay):
            return await _run_job(job, start.get("request"), actor, token)

    async def read() -> None:
        while True:
            message = await ws.receive_json()
            if isinstance(message, dict) and message.get("type") in ("answer", "error"):
                relay.deliver(message)
            elif isinstance(message, dict) and message.get("type") == "cancel":
                return

    task = asyncio.create_task(asyncio.wait_for(work(), JOB_TIMEOUT_SECONDS))
    reader = asyncio.create_task(read())
    try:
        await asyncio.wait({task, reader}, return_when=asyncio.FIRST_COMPLETED)
        if not task.done():
            relay.close()
            task.cancel()
            return
        reader.cancel()
        try:
            result = task.result()
        except HTTPException as e:
            await fail(str(e.detail))
            return
        except budget.LimitExceeded as e:
            await fail(e.message)
            return
        except asyncio.TimeoutError:
            await fail("That took too long on your device.")
            return
        except Exception as e:
            print(f"[device] {job} failed: {type(e).__name__}")
            await fail("That didn't work on your device. Please try again.")
            return
        await send({"type": "done", "result": result, "answered": relay.answered, "failed": relay.failed})
        await ws.close()
    except WebSocketDisconnect:
        relay.close()
        task.cancel()
    finally:
        relay.close()
        reader.cancel()
        _jobs.discard(key)
