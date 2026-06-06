"""
Agent memory store.

Gives the multi-agent orchestrator persistent, cross-session memory of a user.
Unlike user_paths (one current path per user), this is an append-only log of
compact run summaries that agents can read to build on past plans instead of
starting from scratch every time.

Backed by the shared Supabase project (table: public.agent_memory). When
Supabase isn't configured the store degrades gracefully to a no-op so local
simulation runs are unaffected.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from database.supabase_client import get_supabase

# How many recent runs to surface back to the agents.
_RECENT_LIMIT = 5


def _compact_summary(
    kind: str,
    user_profile: Dict[str, Any],
    goals: List[str],
    barriers: List[str],
    agent_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Reduce a full agent run to a small, prompt-friendly summary."""
    path = agent_result.get("path") or {}
    milestones = agent_result.get("milestones") or path.get("milestones") or []
    explanations = agent_result.get("explanations") or []

    return {
        "kind": kind,
        "timestamp": datetime.utcnow().isoformat(),
        "goals": goals,
        "barriers": barriers,
        "motivationType": user_profile.get("motivationType"),
        "milestoneCount": len(milestones),
        "milestoneTitles": [
            (m.get("title") or m.get("name") or "")
            for m in milestones[:8]
            if isinstance(m, dict)
        ],
        "keyInsights": [str(e)[:160] for e in explanations[:3]],
    }


def load_user_memory(user_id: str) -> Dict[str, Any]:
    """Return a compact memory object for a user.

    Shape:
        {
            "runCount": int,
            "recentRuns": [ {summary}, ... ],   # newest first
            "lastGoals": [...],
            "lastBarriers": [...],
        }
    Returns an empty-but-valid object when there's no history or no DB.
    """
    empty: Dict[str, Any] = {
        "runCount": 0,
        "recentRuns": [],
        "lastGoals": [],
        "lastBarriers": [],
    }
    if not user_id:
        return empty

    client = get_supabase()
    if client is None:
        return empty

    try:
        res = (
            client.table("agent_memory")
            .select("summary, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(_RECENT_LIMIT)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"[memory] load skipped: {e}")
        return empty

    if not rows:
        return empty

    recent = [r.get("summary", {}) for r in rows if r.get("summary")]
    last = recent[0] if recent else {}
    return {
        "runCount": len(recent),
        "recentRuns": recent,
        "lastGoals": last.get("goals", []),
        "lastBarriers": last.get("barriers", []),
    }


def record_run(
    user_id: str,
    kind: str,
    user_profile: Dict[str, Any],
    goals: List[str],
    barriers: List[str],
    agent_result: Dict[str, Any],
) -> None:
    """Append a compact summary of an agent run to the user's memory log."""
    if not user_id:
        return
    client = get_supabase()
    if client is None:
        return
    try:
        summary = _compact_summary(kind, user_profile, goals, barriers, agent_result)
        client.table("agent_memory").insert(
            {"user_id": user_id, "kind": kind, "summary": summary}
        ).execute()
    except Exception as e:
        print(f"[memory] record skipped: {e}")


def summarize_for_prompt(memory: Optional[Dict[str, Any]]) -> str:
    """Render memory as a short natural-language block for LLM prompts.

    Returns '' when there's no useful history, so callers can cheaply skip it.
    """
    if not memory or not memory.get("recentRuns"):
        return ""

    runs = memory["recentRuns"]
    lines: List[str] = [
        f"This user has {len(runs)} prior planning session(s). "
        "Build on this history; do not repeat milestones they've already seen."
    ]
    for i, run in enumerate(runs[:3], 1):
        goals = ", ".join(run.get("goals", [])) or "n/a"
        titles = "; ".join(t for t in run.get("milestoneTitles", []) if t)
        lines.append(f"Session {i}: goals=[{goals}]. Earlier milestones: {titles or 'n/a'}")
    return "\n".join(lines)
