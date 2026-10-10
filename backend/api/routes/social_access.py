"""Who may use the social endpoints (messages, memes and calls).

They took the acting person from ?user_id= with no sign-in check, and the
service-role client skips the database's row rules, so anyone who knew an id
could read that person's conversations and call history, or send messages
and memes as them. The session now decides who is acting (current_user_id);
a user_id that is sent must be that person; and messages, calls and likes are
only between people who are connected, as in the app.
"""

from typing import Optional

from fastapi import HTTPException


def as_self(user_id: Optional[str], actor: str) -> str:
    """The signed-in person. A user_id that names anyone else is refused."""
    if user_id and str(user_id).strip().lower() != str(actor).lower():
        raise HTTPException(status_code=403, detail="You can only act as yourself.")
    return str(actor)


def connected(sb, a: str, b: str) -> bool:
    """Whether a connection links a and b, in either direction."""
    for owner, target in ((a, b), (b, a)):
        rows = (sb.table("social_connections").select("id")
                .eq("status", "connected").eq("owner_id", owner).eq("target_user_id", target)
                .limit(1).execute())
        if rows.data:
            return True
    return False


def require_connected(sb, a: str, b: str) -> None:
    if not connected(sb, a, b):
        raise HTTPException(status_code=403, detail="You can only do this with people you are connected to.")


def connected_ids(sb, uid: str) -> list:
    """Everyone a connection links to uid."""
    out = set()
    mine = sb.table("social_connections").select("target_user_id") \
             .eq("owner_id", uid).eq("status", "connected").execute()
    for r in (mine.data or []):
        if r.get("target_user_id"):
            out.add(str(r["target_user_id"]))
    theirs = sb.table("social_connections").select("owner_id") \
               .eq("target_user_id", uid).eq("status", "connected").execute()
    for r in (theirs.data or []):
        if r.get("owner_id"):
            out.add(str(r["owner_id"]))
    return sorted(out)
