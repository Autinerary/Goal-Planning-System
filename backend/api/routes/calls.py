"""Video call scheduling and history.

Ported off raw psycopg2 for the same reason as memes and messaging: it opened
its own Postgres connection with a localhost fallback, so every request 500'd
in production. Uses the shared Supabase client now.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/calls", tags=["calls"])


class CallCreate(BaseModel):
    receiver_id: str
    call_type: str = "mentor"
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None


class CallUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class CallResponse(BaseModel):
    id: str
    caller_id: str
    receiver_id: str
    call_type: str
    status: str
    scheduled_at: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration: Optional[int] = None
    notes: Optional[str] = None
    created_at: str


def _client():
    sb = get_supabase()
    if sb is None:
        raise HTTPException(
            status_code=503,
            detail="Calls are temporarily unavailable. If you are the "
                   "operator, check the Supabase configuration.",
        )
    return sb


def _uuid(value: str, field: str) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"{field} must be a valid user id")


def _parse(ts) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None


def _shape(row: dict) -> dict:
    # duration is computed, not stored — video_calls has no duration_seconds
    # column, and the old SQL selected one that does not exist.
    started, ended = _parse(row.get("started_at")), _parse(row.get("ended_at"))
    duration = int((ended - started).total_seconds()) if started and ended and ended > started else None
    return {
        "id": str(row["id"]),
        "caller_id": str(row["caller_id"]),
        "receiver_id": str(row["receiver_id"]),
        "call_type": row.get("call_type") or "mentor",
        "status": row.get("status") or "scheduled",
        "scheduled_at": str(row["scheduled_at"]) if row.get("scheduled_at") else None,
        "started_at": str(row["started_at"]) if row.get("started_at") else None,
        "ended_at": str(row["ended_at"]) if row.get("ended_at") else None,
        "duration": duration,
        "notes": row.get("notes"),
        "created_at": str(row.get("created_at")),
    }


@router.post("/start", response_model=CallResponse)
async def start_call(call: CallCreate, user_id: str = Query(...)):
    """Start (or schedule) a call."""
    sb = _client()
    caller = _uuid(user_id, "user_id")
    receiver = _uuid(call.receiver_id, "receiver_id")
    if caller == receiver:
        raise HTTPException(status_code=400, detail="You cannot call yourself")

    now = datetime.now(timezone.utc).isoformat()
    scheduled = call.scheduled_at or None
    try:
        payload = {
            "id": str(uuid4()),
            "caller_id": caller,
            "receiver_id": receiver,
            "call_type": call.call_type,
            # A call with a future scheduled_at is booked, not live.
            "status": "scheduled" if scheduled else "in_progress",
            "scheduled_at": scheduled,
            "started_at": None if scheduled else now,
            "created_at": now,
        }
        if call.notes:
            payload["notes"] = call.notes
        res = sb.table("video_calls").insert(payload).select("*").execute()
        row = (res.data or [None])[0]
        if not row:
            raise HTTPException(status_code=500, detail="Could not start the call")
        return _shape(row)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[calls] start failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not start the call")


@router.post("/{call_id}/end", response_model=CallResponse)
async def end_call(call_id: str, user_id: str = Query(...)):
    """End a call. Only a participant may end it."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    cid = _uuid(call_id, "call_id")
    try:
        found = sb.table("video_calls").select("*").eq("id", cid).limit(1).execute()
        row = (found.data or [None])[0]
        if not row:
            raise HTTPException(status_code=404, detail="Call not found")
        # The old query matched on caller_id only, so a receiver could not end
        # their own call. Either participant can.
        if uid not in (str(row["caller_id"]), str(row["receiver_id"])):
            raise HTTPException(status_code=403, detail="You are not part of this call")

        res = (sb.table("video_calls")
               .update({"status": "completed", "ended_at": datetime.now(timezone.utc).isoformat()})
               .eq("id", cid).select("*").execute())
        return _shape((res.data or [row])[0])
    except HTTPException:
        raise
    except Exception as e:
        print(f"[calls] end failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not end the call")


@router.get("/history", response_model=List[CallResponse])
async def get_call_history(user_id: str = Query(...), limit: int = 50):
    """Calls this user took part in, either side, most recent first."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    try:
        cap = max(1, min(limit, 200))
        outgoing = sb.table("video_calls").select("*").eq("caller_id", uid) \
                     .order("created_at", desc=True).limit(cap).execute()
        incoming = sb.table("video_calls").select("*").eq("receiver_id", uid) \
                     .order("created_at", desc=True).limit(cap).execute()
        rows = (outgoing.data or []) + (incoming.data or [])
        rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
        return [_shape(r) for r in rows[:cap]]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[calls] history failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not load call history")
