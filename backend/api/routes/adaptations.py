"""Adaptation offers: a suggested change, and only Accept applies it (STEP 73).

  GET  /api/adaptations/{pathId}                  the suggestions for this path, and the
                                                  "Did that help?" questions due
  POST /api/adaptations/{suggestionId}/respond    { pathId, response: 'accept' | 'not_now' }
  POST /api/adaptations/{suggestionId}/helped     { pathId, answer: 'yes' | 'no' }

"Did that help?" (STEP 74) is asked once after Accept, and once more on the
first visit to the Path at least SECOND_ASK_DAYS days after accepting. There
is no scheduled job: which question is due is worked out when the Path asks
for its suggestions. Both answers are kept on the offer's row.

Adaptation never changed anyone's plan (8 October audit). Now, for the
person's own path, Reflection Analysis's analysis (computed on read) goes
through Adaptation's rules (core/adaptation_rules.py), and each suggestion
names one step. Every suggestion shown is recorded in adaptation_outcomes
once (offered_at), with its answer (accepted_at or dismissed_at). Only
Accept changes the stored path, and only with the change that was offered.

Off unless ADAPTATION_OFFERS_ENABLED=true (the app also needs
NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED=true). Until STEP 73 is applied, GET
says offers aren't available and nothing is offered.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id
from core import adaptation_rules, reflection_analysis
from database.supabase_client import get_supabase

router = APIRouter()

TABLE = "adaptation_outcomes"
OFFER_COLUMNS = "suggestion_id, rule_fired, path_id, milestone_id, change, offered_at, accepted_at, dismissed_at"
HELPED_COLUMNS = "helped_first, helped_first_at, helped_second, helped_second_at"
SECOND_ASK_DAYS = 7


def enabled() -> bool:
    """The feature flag, read at call time. Off unless set to 'true'."""
    return os.getenv("ADAPTATION_OFFERS_ENABLED", "").strip().lower() == "true"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client():
    if not enabled():
        raise HTTPException(status_code=404, detail="Not available.")
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Suggestions are not available just now.")
    return sb


def _load_path(sb, user_id: str, path_id: str) -> Optional[Dict[str, Any]]:
    """The person's own stored path (as milestone_ratings._load_path)."""
    rows = (sb.table("user_paths").select("payload").eq("user_id", user_id).eq("path_id", path_id)
            .limit(1).execute().data or [])
    if not rows:
        return None
    payload = rows[0].get("payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def _done_ids(sb, user_id: str) -> List[str]:
    rows = (sb.table("race_progress").select("milestone_id").eq("user_id", user_id)
            .eq("kind", "completed").execute().data or [])
    return [str(r["milestone_id"]) for r in rows if r.get("milestone_id")]


def _offers(sb, user_id: str, path_id: str) -> Dict[str, Dict[str, Any]]:
    """The person's offers on this path, with the "Did that help?" answers
    when STEP 74 is applied (without them, no question is asked)."""
    query = lambda cols: (sb.table(TABLE).select(cols).eq("user_id", user_id).eq("path_id", path_id)
                          .execute().data or [])
    try:
        rows = query(f"{OFFER_COLUMNS}, {HELPED_COLUMNS}")
        for r in rows:
            r["_asks"] = True
    except Exception:
        rows = query(OFFER_COLUMNS)
    return {str(r["suggestion_id"]): r for r in rows if r.get("suggestion_id")}


def _parse(value: Any) -> Optional[datetime]:
    from core.reflection_analysis import parse_ts
    return parse_ts(value)


def ask_due(row: Dict[str, Any], now: Optional[datetime] = None) -> Optional[str]:
    """'first', 'second' or None: which "Did that help?" this accepted offer is due.

    first: once accepted, until answered, for SECOND_ASK_DAYS days.
    second: from SECOND_ASK_DAYS days after accepting, until answered.
    """
    if not row.get("_asks"):
        return None
    accepted = _parse(row.get("accepted_at"))
    if accepted is None:
        return None
    now = now or datetime.now(timezone.utc)
    if now - accepted >= timedelta(days=SECOND_ASK_DAYS):
        return "second" if not row.get("helped_second") else None
    return "first" if not row.get("helped_first") else None


def _shown(s: Dict[str, Any]) -> Dict[str, Any]:
    """What the app shows of a suggestion."""
    return {k: s[k] for k in ("id", "rule", "milestone_id", "milestone_name", "text", "reason")}


def _record(s: Dict[str, Any]) -> Dict[str, Any]:
    return {"rule_fired": s["rule"], "path_id": s["path_id"], "milestone_id": s["milestone_id"],
            "suggestion_id": s["id"], "offered_at": _now(),
            "change": {"change": s["change"], "before": s["before"], "text": s["text"], "reason": s["reason"],
                       "milestone_name": s["milestone_name"]}}


def _forget_cached(path_id: str) -> None:
    """The path routes keep a per-process copy of each path (api/routes/onboarding.py)."""
    try:
        from api.routes import onboarding
        onboarding.generated_paths.pop(path_id, None)
    except Exception:
        pass


@router.get("/{path_id}")
async def get_suggestions(path_id: str, user_id: str = Depends(current_user_id)):
    sb = _client()
    payload = _load_path(sb, user_id, path_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Path not found.")
    try:
        offered = _offers(sb, user_id, path_id)
    except Exception:
        # Most likely STEP 73 is not applied yet: offer nothing.
        return {"available": False, "offers": []}
    analysis = reflection_analysis.analyze_person(sb, user_id, path_id=path_id)
    current = adaptation_rules.suggestions(analysis, payload, path_id, _done_ids(sb, user_id))
    shown: List[Dict[str, Any]] = []
    for s in current:
        row = offered.get(s["id"])
        if row is None:
            try:
                sb.table(TABLE).insert({"user_id": user_id, **_record(s)}).execute()
            except Exception as e:
                # Offered from another tab a moment ago: the unique key keeps one.
                if "duplicate" not in str(e).lower() and "23505" not in str(e):
                    continue
            shown.append(_shown(s))
        elif not row.get("accepted_at") and not row.get("dismissed_at"):
            shown.append(_shown(s))
    asks = []
    for sid, row in offered.items():
        due = ask_due(row)
        if due:
            change = row.get("change") or {}
            asks.append({"id": sid, "ask": due, "milestone_id": row.get("milestone_id"),
                         "milestone_name": change.get("milestone_name") or "This step",
                         "text": change.get("text") or "", "accepted_at": row.get("accepted_at")})
    return {"available": True, "offers": shown, "asks": asks}


class ResponseIn(BaseModel):
    pathId: str = Field(..., min_length=1, max_length=100)
    response: str = Field(..., min_length=6, max_length=7)


@router.post("/{suggestion_id}/respond")
async def respond(suggestion_id: str, body: ResponseIn, user_id: str = Depends(current_user_id)):
    if body.response not in ("accept", "not_now"):
        raise HTTPException(status_code=422, detail="The response is accept or not_now.")
    sb = _client()
    try:
        row = _offers(sb, user_id, body.pathId).get(suggestion_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Suggestions are not available yet.")
    if row is None:
        raise HTTPException(status_code=404, detail="That suggestion was not offered to you.")
    if row.get("accepted_at") or row.get("dismissed_at"):
        return {"answered": True, "accepted": bool(row.get("accepted_at"))}

    def mark(field: str) -> None:
        sb.table(TABLE).update({field: _now()}).eq("user_id", user_id).eq("suggestion_id", suggestion_id).execute()

    if body.response == "not_now":
        mark("dismissed_at")
        return {"answered": True, "accepted": False}

    # Accept: the change that was offered, to the step it named, in the stored path.
    payload = _load_path(sb, user_id, body.pathId)
    change = (row.get("change") or {}).get("change") or {}
    if payload is None:
        raise HTTPException(status_code=404, detail="Path not found.")
    try:
        changed = adaptation_rules.apply(payload, row["milestone_id"], change)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    try:
        sb.table("user_paths").update({"payload": changed}).eq("user_id", user_id).eq("path_id", body.pathId).execute()
    except Exception:
        raise HTTPException(status_code=503, detail="The change could not be saved just now.")
    _forget_cached(body.pathId)
    mark("accepted_at")
    return {"answered": True, "accepted": True}


class HelpedIn(BaseModel):
    pathId: str = Field(..., min_length=1, max_length=100)
    answer: str = Field(..., min_length=2, max_length=3)


@router.post("/{suggestion_id}/helped")
async def helped(suggestion_id: str, body: HelpedIn, user_id: str = Depends(current_user_id)):
    """The answer to whichever "Did that help?" is due for this accepted offer."""
    if body.answer not in ("yes", "no"):
        raise HTTPException(status_code=422, detail="The answer is yes or no.")
    sb = _client()
    try:
        row = _offers(sb, user_id, body.pathId).get(suggestion_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Suggestions are not available yet.")
    if row is None:
        raise HTTPException(status_code=404, detail="That suggestion was not offered to you.")
    due = ask_due(row)
    if due is None:
        raise HTTPException(status_code=409, detail="No question is due for this change.")
    sb.table(TABLE).update({f"helped_{due}": body.answer, f"helped_{due}_at": _now()}) \
        .eq("user_id", user_id).eq("suggestion_id", suggestion_id).execute()
    return {"saved": True, "ask": due, "answer": body.answer}
