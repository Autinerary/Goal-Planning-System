"""Rebuild a person's profile vector when their profile changes (STEP 56).

A vector (pattern_user_embeddings) was rebuilt only at setup and after a
reflection, so a condition added later, for example in ResourceHub, never
reached it: on 8 Oct 2026, 5 of 72 vectors lacked a condition the person had
since added. Now a trigger on user_barriers marks the vector
(reindex_requested_at) whenever someone's conditions change, from any app,
and this rebuilds the marked ones:

  * reindex_user rebuilds one person's vector from their current profile:
    conditions from user_barriers, goals and the rest from their active
    path, through orchestrator.index_user, the same call setup and
    reflections make. Their success_rate is kept, not reset.
  * reindex_pending rebuilds every marked vector. The backend runs it at
    startup and then every few minutes while it is awake (main.py), and
    POST /api/pattern/reindex rebuilds the caller's own on request.

Writing a vector with the person's current conditions clears the mark
(upsert_user_vector). A write from an older copy of their profile, such as a
reflection sent from a page loaded before the change, leaves it for the sweep.
Goals change only when a path is generated, which already rebuilds the vector.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

PENDING_BATCH = 25


def _rows(result: Any) -> List[Dict[str, Any]]:
    return getattr(result, "data", None) or []


def current_profile(sb, user_id: str) -> Optional[Dict[str, Any]]:
    """What the vector should be built from now, or None if they have no vector."""
    existing = _rows(sb.table("pattern_user_embeddings")
                     .select("user_id, goals, success_rate, motivation_type")
                     .eq("user_id", user_id).limit(1).execute())
    if not existing:
        return None
    row = existing[0]
    barriers = [r.get("barrier_type") for r in _rows(
        sb.table("user_barriers").select("barrier_type").eq("user_id", user_id).execute())
        if r.get("barrier_type")]
    paths = _rows(sb.table("user_paths").select("payload, is_active, updated_at")
                  .eq("user_id", user_id).order("updated_at", desc=True).execute())
    path = next((p for p in paths if p.get("is_active")), paths[0] if paths else None)
    payload = (path or {}).get("payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            payload = {}
    profile = dict(payload.get("userProfile") or {})
    if not profile.get("motivationType") and row.get("motivation_type"):
        profile["motivationType"] = row["motivation_type"]
    return {
        "profile": profile,
        "goals": list(profile.get("goals") or row.get("goals") or []),
        "barriers": barriers,
        "path": payload.get("path"),
        "success_rate": float(row.get("success_rate") if row.get("success_rate") is not None else 0.5),
    }


async def reindex_user(sb, orchestrator, user_id: str) -> bool:
    """Rebuild one person's vector from their current profile."""
    state = current_profile(sb, user_id)
    if state is None:
        return False
    return await orchestrator.index_user(
        user_id=user_id,
        user_profile=state["profile"],
        goals=state["goals"],
        barriers=state["barriers"],
        agent_result={"path": state["path"], "milestones": []},
        success_rate=state["success_rate"],
    )


async def reindex_pending(sb, orchestrator, limit: int = PENDING_BATCH) -> Dict[str, Any]:
    """Rebuild every vector marked since it was written (oldest mark first)."""
    try:
        marked = _rows(sb.table("pattern_user_embeddings").select("user_id, reindex_requested_at")
                       .not_.is_("reindex_requested_at", "null")
                       .order("reindex_requested_at").limit(limit).execute())
    except Exception as e:
        if "reindex_requested_at" in str(e):
            return {"available": False, "pending": 0, "rebuilt": 0, "failed": 0}
        raise
    rebuilt = failed = 0
    for row in marked:
        try:
            if await reindex_user(sb, orchestrator, row["user_id"]):
                rebuilt += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            print(f"[pattern_reindex] rebuild failed: {str(e)[:120]}")
    return {"available": True, "pending": len(marked), "rebuilt": rebuilt, "failed": failed}
