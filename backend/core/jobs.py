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

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from database.supabase_client import get_supabase

TABLE = "generation_jobs"

# A job still 'running' after this long is presumed dead — almost always a
# process restart mid-generation. Comfortably above the slowest observed run
# (~160s at five concurrent) so a merely slow job is never killed.
STALE_AFTER = timedelta(minutes=15)

# A generation is stopped after this long (api/routes/onboarding.py), well
# inside STALE_AFTER. A model call that hung used to run on past it: the job
# then counted as dead, so the person's next try started a second generation
# beside the first (bug audit, 17 November 2026, item 34).
GENERATION_DEADLINE = timedelta(minutes=10)

# Why a job failed, for the page that waits on it:
#   guardrail  the goals were turned down, and the message is written for the
#              person (it can be the crisis lines), so it is shown as it is;
#   limit      a daily or per-minute AI limit, also shown as it is;
#   internal   anything else, shown as INTERNAL_ERROR whatever it was.
# generation_jobs has no column for it, so it is kept at the front of the
# error, "[guardrail] ...", and taken off again when the job is read
# (failure, below).
ERROR_KINDS = ("guardrail", "limit", "internal")
INTERNAL_ERROR = "Your path couldn't be made just now, so please try again in a minute."
# What an internal failure was, kept with the job for the audits
# (scripts/agent_audit_path_planning.py). Never shown: the cause of an error
# is in the server log.
DEADLINE_REASON = "Stopped at the generation deadline."
INTERRUPTED_REASON = "Interrupted: the server restarted, or the generation hung."
_KIND_PREFIX = re.compile(r"^\[(guardrail|limit|internal)\]\s?(.*)$", re.DOTALL)
# What jobs failed with before the kind was kept (so before 18 November 2026).
_LIMIT_MESSAGES = ("Too many requests in the last minute", "You've reached today's usage limit",
                   "You've reached today's AI budget")
_OLD_INTERNAL_MESSAGES = ("Path generation failed. Please try again.",
                          "Generation was interrupted. Please try again.", "Generation failed")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse(value: Any) -> Optional[datetime]:
    """A database timestamp. Postgres trims trailing zeros from the fraction
    ('...:55.88668+00:00'), which older Pythons' fromisoformat rejects."""
    if not isinstance(value, str) or not value:
        return None
    text = value.replace("Z", "+00:00")
    head, _, rest = text.partition(".")
    if rest:
        digits = rest[:len(rest) - len(rest.lstrip("0123456789"))]
        zone = rest[len(digits):]
        text = f"{head}.{digits[:6].ljust(6, '0')}{zone}"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


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


def mark_failed(job_id: str, error: Optional[str] = None, kind: str = "internal") -> None:
    """Record a failure and its kind (ERROR_KINDS): for "guardrail" and
    "limit", a message written for the person; for "internal", at most a
    short reason for the audits (DEADLINE_REASON), never shown.

    Tracebacks stay in the logs; the client gets something it can act on.
    """
    kind = kind if kind in ERROR_KINDS else "internal"
    _update(job_id, {
        "status": "failed",
        "error": f"[{kind}] {error or INTERNAL_ERROR}"[:500],
        "stage": "Failed",
        "finished_at": _now(),
    })


def failure(row: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """Why a job failed, as (kind, message for the person); (None, None) when
    it hasn't failed.

    Jobs that failed before the kind was kept are read by what wrote them:
    the AI limits' messages, the two fixed internal ones, and otherwise a
    guardrail's own words, the only other failure recorded then.
    """
    if (row or {}).get("status") != "failed":
        return None, None
    text = str(row.get("error") or "").strip()
    match = _KIND_PREFIX.match(text)
    if match:
        kind, message = match.group(1), match.group(2).strip()
    elif text.startswith(_LIMIT_MESSAGES):
        kind, message = "limit", text
    elif not text or text in _OLD_INTERNAL_MESSAGES:
        kind, message = "internal", ""
    else:
        kind, message = "guardrail", text
    if kind == "internal":
        return kind, INTERNAL_ERROR
    return kind, message or INTERNAL_ERROR


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


def in_flight_for_user(user_id: str) -> Optional[Dict[str, Any]]:
    """The person's generation that is still queued or running, if any.

    One person, one generation at a time. A second one, started by a retry, a
    reload, or a request that gave up while the server was waking up (it
    sleeps when idle and took 41 s to answer on 5 October), used to run beside
    the first. Each makes about 15 AI calls, two make 30, and the per-person
    limit is 30 a minute (core/budget.py), so one or both failed with "Too
    many requests in the last minute": 223 of 293 generations in September.
    Riipen Labs Group 9 reported setup "freezing".
    """
    row = latest_for_user(user_id)
    if not row or row.get("status") not in ("queued", "running"):
        return None
    created = _parse(row.get("created_at"))
    if created is None or datetime.now(timezone.utc) - created > STALE_AFTER:
        return None
    return row


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
                "error": f"[internal] {INTERRUPTED_REASON}",
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
