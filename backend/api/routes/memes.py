"""Meme sharing between connected users.

Ported off raw psycopg2. This route (with messaging and calls) was the only
part of the backend still opening its own Postgres connection, with a
localhost fallback baked in — which meant every request 500'd in production
while the rest of the app talked happily to Supabase. It now uses the same
client as everything else, so it needs no DATABASE_URL and cannot drift from
the database the rest of the product uses.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database.supabase_client import get_supabase

router = APIRouter()


class MemeCreate(BaseModel):
    content_type: str = "emoji"          # emoji, image, text
    content: str
    caption: Optional[str] = None
    shared_with: Optional[List[str]] = []  # empty = all connections


class MemeResponse(BaseModel):
    id: str
    user_id: str
    content_type: str
    content: str
    caption: Optional[str]
    shared_with: List[str]
    likes: int
    created_at: str
    liked_by_user: bool = False


def _client():
    sb = get_supabase()
    if sb is None:
        raise HTTPException(
            status_code=503,
            detail="This feature is temporarily unavailable. If you are the "
                   "operator, check the Supabase configuration.",
        )
    return sb


def _uuid(value: str, field: str) -> str:
    """Reject anything that is not a real user id.

    The old code called a get_or_create_user() SQL function, which minted a
    user row for whatever string arrived — including the frontend's
    'demo_user' fallback and any typo. That quietly filled the table with
    phantom accounts. A bad id is now a 400 the caller can act on.
    """
    try:
        return str(UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"{field} must be a valid user id")


@router.post("/share")
async def share_meme(meme: MemeCreate, user_id: str = Query(..., description="User ID")):
    """Share a meme with your connections."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    try:
        res = sb.table("memes").insert({
            "user_id": uid,
            "content_type": meme.content_type,
            "content": meme.content,
            "caption": meme.caption,
            "shared_with": meme.shared_with or [],
            "likes": 0,
        }).select("*").execute()
        row = (res.data or [None])[0]
        if not row:
            raise HTTPException(status_code=500, detail="Could not share the meme")
        return {
            "id": str(row["id"]),
            "user_id": str(row["user_id"]),
            "content_type": row["content_type"],
            "content": row["content"],
            "caption": row.get("caption"),
            "shared_with": row.get("shared_with") or [],
            "likes": row.get("likes") or 0,
            "created_at": str(row.get("created_at")),
            "liked_by_user": False,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[memes] share failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not share the meme")


@router.get("/feed")
async def get_meme_feed(user_id: str = Query(..., description="User ID"), limit: int = 50):
    """Memes from the people you're connected to, plus your own."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    try:
        conns = sb.table("connections").select("connected_user_id").eq("user_id", uid).execute()
        author_ids = [c["connected_user_id"] for c in (conns.data or []) if c.get("connected_user_id")]
        author_ids.append(uid)  # your own memes appear in your feed

        res = (sb.table("memes").select("*")
               .in_("user_id", author_ids)
               .order("created_at", desc=True)
               .limit(max(1, min(limit, 200)))
               .execute())
        memes = res.data or []
        if not memes:
            return []

        # One query for the viewer's likes rather than one per meme.
        liked = sb.table("meme_likes").select("meme_id").eq("user_id", uid) \
                  .in_("meme_id", [m["id"] for m in memes]).execute()
        liked_ids = {l["meme_id"] for l in (liked.data or [])}

        return [{
            "id": str(m["id"]),
            "user_id": str(m["user_id"]),
            "content_type": m["content_type"],
            "content": m["content"],
            "caption": m.get("caption"),
            "shared_with": m.get("shared_with") or [],
            "likes": m.get("likes") or 0,
            "created_at": str(m.get("created_at")),
            "liked_by_user": m["id"] in liked_ids,
        } for m in memes]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[memes] feed failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not load the feed")


@router.post("/like")
async def toggle_like(meme_id: str = Query(...), user_id: str = Query(...)):
    """Like or unlike a meme. Idempotent per (user, meme)."""
    sb = _client()
    uid = _uuid(user_id, "user_id")
    mid = _uuid(meme_id, "meme_id")
    try:
        existing = sb.table("meme_likes").select("id").eq("meme_id", mid).eq("user_id", uid).execute()
        current = sb.table("memes").select("likes").eq("id", mid).limit(1).execute()
        if not (current.data or []):
            raise HTTPException(status_code=404, detail="Meme not found")
        likes = (current.data[0].get("likes") or 0)

        if existing.data:
            sb.table("meme_likes").delete().eq("meme_id", mid).eq("user_id", uid).execute()
            likes = max(0, likes - 1)
            liked = False
        else:
            sb.table("meme_likes").insert({"meme_id": mid, "user_id": uid}).execute()
            likes += 1
            liked = True

        sb.table("memes").update({"likes": likes}).eq("id", mid).execute()
        return {"meme_id": mid, "likes": likes, "liked_by_user": liked}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[memes] like failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not update the like")
