"""The similar-user group behind a plan, described without saying who is in it,
and feedback on it as ground truth for Pattern Recognition (STEP 60).

A plan keeps the people Pattern Recognition matched it with (agentResponses
→ pattern_recognition → similar_users). The "Found N similar users" banner
names only how many. With the feature on, opening the banner shows:

  * the group's size, counting only members whose account still exists
    (their vector is still in pattern_user_embeddings);
  * the conditions at least MIN_SHARED of them share, from the condition
    vocabulary (core/condition_taxonomy.py). Placeholder answers and free
    text are never shown. A condition the vocabulary keeps general when it
    leaves the system (share_specific is False: rare conditions, identity,
    income and the like) is shown as its category phrase.

Never ids, names, goals or anything about one person. The person can answer
"Does this sound like people in a situation similar to yours?". The answer
is stored with the ids of the members it described, server-side only
(similar_group_feedback has no policies), and a short optional note that
nothing sends to an LLM.

Off unless SIMILAR_GROUP_FEEDBACK_ENABLED=true.
"""
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Any, Dict, List, Optional

from core.condition_taxonomy import normalize_condition

MIN_SHARED = 3      # a condition is shown only if at least this many members share it
MAX_SHOWN = 5       # at most this many conditions in the summary
NOTE_LIMIT = 500    # characters kept from the optional note
ANSWERS = ("yes", "somewhat", "no")


def enabled() -> bool:
    """The feature flag, read at call time. Off unless set to 'true'."""
    return os.getenv("SIMILAR_GROUP_FEEDBACK_ENABLED", "").strip().lower() == "true"


def plan_members(payload: Any) -> List[Dict[str, Any]]:
    """The people a plan was matched with: [{"user_id", "barriers"}], in order."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            return []
    if not isinstance(payload, dict):
        return []
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "pattern_recognition":
            members = []
            for entry in (response.get("result") or {}).get("similar_users") or []:
                if not isinstance(entry, dict):
                    continue
                uid = str(entry.get("user_id") or entry.get("userId") or "")
                if uid:
                    members.append({"user_id": uid, "barriers": list(entry.get("barriers") or [])})
            return members
    return []


def describe(members: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Size, and the conditions at least MIN_SHARED members share.

    "conditions" is what may be shown (labels or category phrases). "keys" are
    the vocabulary keys behind them, kept with the feedback.
    """
    counts: Counter = Counter()
    found = {}
    for member in members:
        keys = set()
        for raw in member.get("barriers") or []:
            condition = normalize_condition(raw).condition   # None for placeholders and free text
            if condition is not None:
                keys.add(condition.key)
                found[condition.key] = condition
        counts.update(keys)
    shown, keys, seen = [], [], set()
    for key, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        if n < MIN_SHARED:
            break
        phrase = found[key].outbound_phrase()
        keys.append(key)
        if phrase not in seen:
            seen.add(phrase)
            shown.append(phrase)
        if len(shown) == MAX_SHOWN:
            break
    return {"size": len(members), "conditions": shown, "keys": keys}


def active_plan(sb, user_id: str) -> Optional[Dict[str, Any]]:
    """The person's active plan (or newest), as {"path_id", "payload"}."""
    rows = (sb.table("user_paths").select("path_id, payload, is_active, updated_at")
            .eq("user_id", user_id).order("updated_at", desc=True).execute().data) or []
    row = next((r for r in rows if r.get("is_active")), rows[0] if rows else None)
    return {"path_id": row.get("path_id"), "payload": row.get("payload")} if row else None


def current_group(sb, user_id: str) -> Optional[Dict[str, Any]]:
    """The group behind the person's plan, members whose account still exists."""
    plan = active_plan(sb, user_id)
    if plan is None:
        return None
    members = plan_members(plan["payload"])
    ids = [m["user_id"] for m in members]
    if ids:
        alive = {str(r["user_id"]) for r in (sb.table("pattern_user_embeddings").select("user_id")
                                             .in_("user_id", ids).execute().data or [])}
        members = [m for m in members if m["user_id"] in alive]
    summary = describe(members)
    return {"path_id": plan["path_id"], "members": [m["user_id"] for m in members], **summary}
