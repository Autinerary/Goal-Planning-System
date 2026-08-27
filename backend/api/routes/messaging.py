"""Direct messages between connected users.

Ported off raw psycopg2 for the same reason as memes and calls: it opened its
own Postgres connection with a localhost fallback, so every request 500'd in
production. Uses the shared Supabase client now.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/messaging", tags=["messaging"])


class MessageCreate(BaseModel):
    receiver_id: str
    content: str


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    content: str
    is_moderated: bool
    moderation_status: str
    created_at: str
    read_at: Optional[str] = None


def _client():
    sb = get_supabase()
    if sb is None:
        raise HTTPException(
            status_code=503,
            detail="Messaging is temporarily unavailable. If you are the "
                   "operator, check the Supabase configuration.",
        )
    return sb


def _uuid(value: str, field: str) -> str:
    """A real user id or a 400 — never a phantom account.

    Replaces get_or_create_user(), which created a row for any string it was
    handed, including the frontend's 'demo_user' fallback.
    """
    try:
        return str(UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"{field} must be a valid user id")


def _shape(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "sender_id": str(row["sender_id"]),
        "receiver_id": str(row["receiver_id"]),
        "content": row["content"],
        "is_moderated": bool(row.get("is_moderated")),
        "moderation_status": row.get("moderation_status") or "pending",
        "created_at": str(row.get("created_at")),
        "read_at": str(row["read_at"]) if row.get("read_at") else None,
    }


@router.post("/send", response_model=MessageResponse)
async def send_message(message: MessageCreate, user_id: str = Query(...)):
    """Send a message. Held at moderation_status='pending' until reviewed."""
    sb = _client()
    sender = _uuid(user_id, "user_id")
    receiver = _uuid(message.receiver_id, "receiver_id")

    body = (message.content or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(body) > 5000:
        raise HTTPException(status_code=400, detail="Message is too long (max 5000 characters)")

    try:
        res = sb.table("messages").insert({
            "id": str(uuid4()),
            "sender_id": sender,
            "receiver_id": receiver,
            "content": body,
            "is_moderated": True,
            "moderation_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).select("*").execute()
        row = (res.data or [None])[0]
        if not row:
            raise HTTPException(status_code=500, detail="Could not send the message")
        return _shape(row)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[messaging] send failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not send the message")


@router.get("/conversations", response_model=List[dict])
async def get_conversations(user_id: str = Query(...)):
    """Everyone this user has exchanged messages with, most recent first."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    try:
        sent = sb.table("messages").select("receiver_id, created_at") \
                 .eq("sender_id", uid).is_("deleted_at", "null").execute()
        got = sb.table("messages").select("sender_id, created_at") \
                .eq("receiver_id", uid).is_("deleted_at", "null").execute()

        latest: dict = {}
        for r in (sent.data or []):
            other = str(r["receiver_id"])
            latest[other] = max(latest.get(other, ""), str(r.get("created_at") or ""))
        for r in (got.data or []):
            other = str(r["sender_id"])
            latest[other] = max(latest.get(other, ""), str(r.get("created_at") or ""))

        return [
            {"other_user_id": uid_, "last_message_at": ts}
            for uid_, ts in sorted(latest.items(), key=lambda kv: kv[1], reverse=True)
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[messaging] conversations failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not load conversations")


@router.get("/conversation/{other_user_id}", response_model=List[MessageResponse])
async def get_conversation(other_user_id: str, user_id: str = Query(...)):
    """Approved messages between two people, oldest first."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    other = _uuid(other_user_id, "other_user_id")
    try:
        # Two directed queries rather than one OR: PostgREST's or() with
        # multiple and() groups is easy to get subtly wrong, and a mistake here
        # would leak someone else's messages.
        a = (sb.table("messages").select("*")
             .eq("sender_id", uid).eq("receiver_id", other)
             .eq("moderation_status", "approved").is_("deleted_at", "null").execute())
        b = (sb.table("messages").select("*")
             .eq("sender_id", other).eq("receiver_id", uid)
             .eq("moderation_status", "approved").is_("deleted_at", "null").execute())
        rows = (a.data or []) + (b.data or [])
        rows.sort(key=lambda r: str(r.get("created_at") or ""))
        return [_shape(r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[messaging] conversation failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not load the conversation")
