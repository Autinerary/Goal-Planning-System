"""The similar-user group behind the caller's plan, and their feedback on it
(core/similar_group.py, STEP 60). Off unless SIMILAR_GROUP_FEEDBACK_ENABLED=true.

  GET  /api/pattern/group            size and shared conditions, nothing else
  POST /api/pattern/group/feedback   { answer: yes|somewhat|no, note? }

The group is always worked out here from the caller's stored plan; nothing
from the browser says who was in it, and no member id is ever returned.
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id
from core import similar_group as sg
from database.supabase_client import get_supabase

router = APIRouter()


class FeedbackIn(BaseModel):
    answer: Literal["yes", "somewhat", "no"]
    note: Optional[str] = Field(default=None, max_length=5000)


def _client():
    if not sg.enabled():
        raise HTTPException(status_code=404, detail="Not available.")
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Not available just now.")
    return sb


@router.get("/group")
async def get_group(user_id: str = Depends(current_user_id)):
    group = sg.current_group(_client(), user_id)
    if group is None:
        return {"size": 0, "conditions": []}
    return {"size": group["size"], "conditions": group["conditions"]}


@router.post("/group/feedback")
async def give_feedback(body: FeedbackIn, user_id: str = Depends(current_user_id)):
    sb = _client()
    group = sg.current_group(sb, user_id)
    if not group or not group["size"]:
        raise HTTPException(status_code=409, detail="There is no group to rate.")
    # The note is stored for the team to read. Nothing sends it to an LLM.
    note = (body.note or "").strip()[:sg.NOTE_LIMIT] or None
    row = {
        "user_id": user_id,
        "path_id": group["path_id"],
        "answer": body.answer,
        "note": note,
        "member_ids": group["members"],
        "group_size": group["size"],
        "shown_conditions": group["keys"],
    }
    try:
        sb.table("similar_group_feedback").insert(row).execute()
    except Exception as e:
        if "similar_group_feedback" in str(e):
            raise HTTPException(status_code=503, detail="Not set up yet.")
        raise
    return {"ok": True}
