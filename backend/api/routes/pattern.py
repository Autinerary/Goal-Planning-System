"""POST /api/pattern/reindex: rebuild the caller's profile vector now (STEP 56).

The vector is rebuilt by itself when someone's conditions change: a trigger
marks it and the backend's sweep rebuilds it (core/pattern_reindex.py, main.py).
This is for doing it at once, for example right after a profile change.
"""
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException

from api.auth_guard import current_user_id
from core.pattern_reindex import reindex_user
from database.supabase_client import get_supabase

router = APIRouter()

_last_request = defaultdict(float)
MIN_INTERVAL_SECONDS = 60


@router.post("/reindex")
async def reindex_me(user_id: str = Depends(current_user_id)):
    now = time.monotonic()
    if now - _last_request[user_id] < MIN_INTERVAL_SECONDS:
        raise HTTPException(status_code=429, detail="Already rebuilt in the last minute.")
    _last_request[user_id] = now
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Not available just now.")
    from api.routes.reflections import _get_orchestrator

    return {"rebuilt": await reindex_user(sb, await _get_orchestrator(), user_id)}
