"""Async job store for long-running path generation.

Why this exists: generating a path takes ~55s alone and ~160s when five people
go at once. Doing that inside the HTTP request ties up a worker for the whole
run, forces the client to pick a timeout long enough for the worst case, and
throws away completed work if the connection drops. Concurrency ends up bounded
by how long a browser will wait rather than by how much work the box can do.

Jobs are persisted rather than held in memory so a client that reloads, or
comes back on another device, can still find its result — and so a process
restart leaves a visible record instead of a silent gap.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from database.supabase_client import get_supabase

TABLE = "generation_jobs"

# A job still 'running' after this long is presumed dead — almost always a
# process restart mid-generation. Comfortably above the slowest observed run
# (~160s at five concurrent) so a merely slow job is never killed.
STALE_AFTER = timedelta(minutes=15)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def enabled() -> bool:
    return get_supabase() is not None


def create(user_id: str, request: Dict[str, Any]) -> Optional[str]:
    """Enqueue a job. Returns its id, or None when the store is unavailable."""
    sb = get_supabase()
    if sb is None:
        return None
    try:
        res = (
            sb.table(TABLE)
            .insert({
                "user_id": user_id,
                "status": "queued",
                "request": request,
                "stage": "Queued",
            })
            .execute()
        )
        rows = res.data or []
        return str(rows[0]["id"]) if rows else None
    except Exception as e:
        print(f"[jobs] create failed: {e}")
        return None


def mark_running(job_id: str, stage: str = "Starting the agents") -> None:
    _update(job_id, {"status": "running", "stage": stage, "started_at": _now()})


def set_stage(job_id: str, stage: str) -> None:
    """Coarse progress for the waiting UI.

    A stage label, never a percentage: the pipeline cannot report real
    progress, and a bar that stalls at 80% is worse than an honest clock.
    """
    _update(job_id, {"stage": stage})


def mark_succeeded(job_id: str, path_id: str) -> None:
    _update(job_id, {
        "status": "succeeded",
        "path_id": path_id,
        "stage": "Done",
        "finished_at": _now(),
    })


def mark_failed(job_id: str, error: str) -> None:
    """Record a failure with a message safe to show a user.

    Tracebacks stay in the logs; the client gets something it can act on.
    """
    _update(job_id, {
        "status": "failed",
        "error": (error or "Generation failed")[:500],
        "stage": "Failed",
        "finished_at": _now(),
    })


def _update(job_id: str, patch: Dict[str, Any]) -> None:
    sb = get_supabase()
    if sb is None or not job_id:
        return
    try:
        sb.table(TABLE).update(patch).eq("id", job_id).execute()
    except Exception as e:
        print(f"[jobs] update {job_id} failed: {e}")


def get(job_id: str) -> Optional[Dict[str, Any]]:
    sb = get_supabase()
    if sb is None:
        return None
    try:
        res = sb.table(TABLE).select("*").eq("id", job_id).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[jobs] get {job_id} failed: {e}")
        return None


def latest_for_user(user_id: str) -> Optional[Dict[str, Any]]:
    """The user's most recent job — how a reloaded page finds its work again."""
    sb = get_supabase()
    if sb is None:
        return None
    try:
        res = (
            sb.table(TABLE).select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[jobs] latest_for_user failed: {e}")
        return None


def reap_stale() -> int:
    """Fail jobs that started but never finished.

    Without this a restart mid-generation leaves a job 'running' forever and
    the user watching a spinner with nothing behind it. Called opportunistically
    on enqueue, so it needs no scheduler.
    """
    sb = get_supabase()
    if sb is None:
        return 0
    cutoff = (datetime.now(timezone.utc) - STALE_AFTER).isoformat()
    try:
        res = (
            sb.table(TABLE)
            .update({
                "status": "failed",
                "error": "Generation was interrupted. Please try again.",
                "stage": "Failed",
                "finished_at": _now(),
            })
            .eq("status", "running")
            .lt("started_at", cutoff)
            .execute()
        )
        n = len(res.data or [])
        if n:
            print(f"[jobs] reaped {n} stale job(s)")
        return n
    except Exception as e:
        print(f"[jobs] reap failed: {e}")
        return 0
