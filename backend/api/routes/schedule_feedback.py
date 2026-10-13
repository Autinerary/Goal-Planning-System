"""Schedule feedback: "Did this schedule work for you?" (STEP 72).

  POST /api/schedule-feedback           { pathId, scheduleId, answer: 'yes' | 'no' }
  GET  /api/schedule-feedback/{pathId}  the schedule's id, and the answer if given

Calendar Optimization has nothing to judge a week by: calendar_outcomes and
reflections are empty, and the confidence it reported was 0.75 for everyone
(docs/reports/calendar-optimization-2026-10-13.md). This asks the person,
once per generated schedule, yes or no. Same pattern as milestone ratings
(api/routes/milestone_ratings.py): the path must be the person's own and the
schedule the one stored in it; the table is the backend's to write.

Once per schedule: an answer given stands, and asking again returns it.

Off unless SCHEDULE_FEEDBACK_ENABLED=true (the app also needs
NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED=true). Until STEP 72 is applied, GET
says it isn't available and POST answers 503, so the app shows nothing.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id
from database.supabase_client import get_supabase

router = APIRouter()

TABLE = "schedule_feedback"
ANSWERS = ("yes", "no")


def enabled() -> bool:
    """The feature flag, read at call time. Off unless set to 'true'."""
    return os.getenv("SCHEDULE_FEEDBACK_ENABLED", "").strip().lower() == "true"


def schedule_id(payload: Any, path_id: str) -> Optional[str]:
    """The id of the schedule stored in a path, or None when it has none.

    Calendar Optimization's scheduleId since 13 October 2026; before that a
    path held one generated schedule, so 'path:<path_id>' names it.
    """
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            payload = {}
    if not isinstance(payload, dict):
        return None
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "calendar_optimization":
            result = response.get("result") if isinstance(response.get("result"), dict) else {}
            if not result.get("schedule"):
                return None
            sid = result.get("scheduleId")
            return str(sid) if isinstance(sid, str) and sid else f"path:{path_id}"
    return None


class FeedbackIn(BaseModel):
    pathId: str = Field(..., min_length=1, max_length=100)
    scheduleId: str = Field(..., min_length=1, max_length=120)
    answer: str = Field(..., min_length=2, max_length=3)


def _load_path(sb, user_id: str, path_id: str) -> Optional[Dict[str, Any]]:
    """The person's own stored path (as milestone_ratings._load_path)."""
    rows = (sb.table("user_paths").select("payload").eq("user_id", user_id).eq("path_id", path_id)
            .limit(1).execute().data or [])
    if not rows:
        return None
    payload = rows[0].get("payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def _answer(sb, user_id: str, sid: str) -> Optional[str]:
    rows = (sb.table(TABLE).select("answer").eq("user_id", user_id).eq("schedule_id", sid)
            .limit(1).execute().data or [])
    return rows[0]["answer"] if rows else None


def _client():
    if not enabled():
        raise HTTPException(status_code=404, detail="Not available.")
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Feedback is not available just now.")
    return sb


@router.get("/{path_id}")
async def get_feedback(path_id: str, user_id: str = Depends(current_user_id)):
    sb = _client()
    payload = _load_path(sb, user_id, path_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Path not found.")
    sid = schedule_id(payload, path_id)
    if sid is None:
        return {"available": False, "scheduleId": None, "answer": None}
    try:
        answer = _answer(sb, user_id, sid)
    except Exception:
        # Most likely STEP 72 is not applied yet.
        return {"available": False, "scheduleId": sid, "answer": None}
    return {"available": True, "scheduleId": sid, "answer": answer}


@router.post("")
async def give_feedback(body: FeedbackIn, user_id: str = Depends(current_user_id)):
    if body.answer not in ANSWERS:
        raise HTTPException(status_code=422, detail="The answer is yes or no.")
    sb = _client()
    payload = _load_path(sb, user_id, body.pathId)
    if payload is None or schedule_id(payload, body.pathId) != body.scheduleId:
        raise HTTPException(status_code=404, detail="That schedule is not in your path.")
    try:
        given = _answer(sb, user_id, body.scheduleId)
        if given is not None:
            return {"saved": False, "alreadyAnswered": True, "answer": given}
        sb.table(TABLE).insert({
            "user_id": user_id, "path_id": body.pathId,
            "schedule_id": body.scheduleId, "answer": body.answer,
        }).execute()
    except Exception as e:
        # A second answer racing the first meets the unique key: the first stands.
        if "duplicate" in str(e).lower() or "23505" in str(e):
            return {"saved": False, "alreadyAnswered": True, "answer": _answer(sb, user_id, body.scheduleId)}
        # Most likely STEP 72 is not applied yet.
        raise HTTPException(status_code=503, detail="Feedback is not available yet.")
    return {"saved": True, "alreadyAnswered": False, "answer": body.answer}
