"""
Request authentication.

Until now the backend had none: no Depends(), no middleware, no JWT check on
any route. `GET /api/onboarding/user/{user_id}/path` returned a user's whole
profile — including barrierTypes ("Bipolar Disorder", "Physical Impairment",
"Housing Instability") and their email address — to anyone who knew a UUID.
That is GDPR Article 9 special-category data, and the email makes it
identifying rather than pseudonymous.

Verification is delegated to Supabase rather than done locally with a shared
secret: get_user(token) validates signature, expiry and revocation in one
call, and there is no JWT secret to leak or rotate here.
"""

from typing import Optional

from fastapi import Header, HTTPException

from database.supabase_client import get_supabase


def _bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """The signed-in user's id, or 401. Use as a FastAPI dependency."""
    token = _bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Sign-in required.")

    client = get_supabase()
    if client is None:
        # Fail closed. An unconfigured backend must not become an open one.
        raise HTTPException(status_code=503, detail="Auth unavailable.")

    try:
        res = client.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    user = getattr(res, "user", None)
    uid = getattr(user, "id", None) if user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return str(uid)


def _is_guardian(guardian_id: str, child_id: str) -> bool:
    """Family accounts: a guardian may read the child they supervise."""
    client = get_supabase()
    if client is None:
        return False
    try:
        res = (
            client.table("guardianships")
            .select("child_id")
            .eq("guardian_id", guardian_id)
            .eq("child_id", child_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


def require_self_or_guardian(target_user_id: str, caller_id: str) -> None:
    """Raise unless the caller IS the target, or supervises them."""
    if caller_id == target_user_id:
        return
    if _is_guardian(caller_id, target_user_id):
        return
    # 404 rather than 403: telling a stranger "that user exists but you may not
    # see them" is itself a disclosure on a system holding health data.
    raise HTTPException(status_code=404, detail="No path found for user.")
