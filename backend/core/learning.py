"""
Reflection learning loop.

This module is the bridge between a user submitting a journal entry and the
system getting measurably better the next time. It is the closest thing we
have to RLHF that runs at zero per-entry cost:

  - We can't fine-tune OpenAI / Anthropic weights for free, so the foundation
    model stays fixed.
  - Instead, every reflection updates four cheap, persistent learning signals
    that the agents read on the NEXT call:
      1. learned_patterns       — online correlation table that replaces the
                                  hardcoded coupled_events dict
      2. pattern_user_feedback  — re-ranking signal for similar-user retrieval
      3. adaptation_outcomes    — contextual bandit for adaptation thresholds
      4. pattern_user_embeddings.success_rate — drives the retrieval prior

  - Every reflection is also persisted in full (`reflections` table) so that
    if you ever DO decide to spend money on a fine-tune, you have a labeled
    (state, action, reward) corpus ready to go.

All functions degrade gracefully to no-ops when Supabase isn't configured,
matching the rest of the backend.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from database.supabase_client import get_supabase


# ---------------------------------------------------------------------------
# Reward computation
# ---------------------------------------------------------------------------

def _try_parse_uuid(value: Any) -> Optional[str]:
    """Return a stringified UUID if value parses, else None. Lets us skip
    persistence cleanly when the caller passes a non-UUID demo user id like
    'user_123'."""
    if value is None:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def compute_reward_signal(reflection_response: Dict[str, Any]) -> float:
    """Combine sentiment, completion, and concerns into a single reward in
    [-1.0, 1.0].

    Reward = 0.5 * sentiment + 0.4 * completion + 0.1 * concern_penalty
      - sentiment   : positive=+1, neutral=0, negative=-1  (LLM or keyword)
      - completion  : completion_rate mapped from [0, 1] to [-1, 1]
      - concerns    : -1 per high-severity concern, capped at -1 total

    This is the scalar the bandit and the similar-user retrieval re-ranker
    both consume.
    """
    sentiment = (reflection_response or {}).get("sentiment", {}) or {}
    label = sentiment.get("label", "neutral")
    if label == "positive":
        sent = 1.0
    elif label == "negative":
        sent = -1.0
    else:
        sent = 0.0

    progress = (reflection_response or {}).get("progress", {}) or {}
    completion = float(progress.get("completion_rate", 0.5) or 0.5)
    # completion_rate is in [0, 1]; remap so 0.5 = neutral, 1.0 = +1, 0.0 = -1
    completion_term = (completion - 0.5) * 2.0

    concerns = (reflection_response or {}).get("concerns", []) or []
    high = sum(1 for c in concerns if (c or {}).get("severity") == "high")
    concern_term = max(-1.0, -1.0 * high)

    reward = 0.5 * sent + 0.4 * completion_term + 0.1 * concern_term
    # Clip
    if reward > 1.0:
        reward = 1.0
    if reward < -1.0:
        reward = -1.0
    return round(reward, 4)


def extract_indicators(reflection_response: Dict[str, Any]) -> List[str]:
    """Pull all pattern indicators that fired in this reflection so we can
    update co-occurrence statistics."""
    patterns = (reflection_response or {}).get("patterns", []) or []
    out: List[str] = []
    for p in patterns:
        if not isinstance(p, dict):
            continue
        trig = p.get("trigger") or p.get("id")
        if trig:
            out.append(str(trig))
        outc = p.get("potential_outcome") or p.get("outcome")
        if outc:
            out.append(str(outc))
    # de-dup while preserving order
    seen = set()
    deduped = []
    for x in out:
        if x not in seen:
            seen.add(x)
            deduped.append(x)
    return deduped


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def persist_reflection(
    user_id: Any,
    context_type: str,
    context_id: Optional[str],
    questions: List[Dict[str, Any]],
    free_form_text: Optional[str],
    reflection_response: Dict[str, Any],
    adaptation_response: Optional[Dict[str, Any]],
    reward_signal: float,
    indicators: List[str],
) -> Optional[str]:
    """Insert a full reflection record. Returns the reflection id (UUID str)
    on success, or None if Supabase isn't configured / the user id isn't a
    real UUID / the insert fails."""
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None:
        return None

    sentiment = (reflection_response or {}).get("sentiment", {}) or {}
    progress = (reflection_response or {}).get("progress", {}) or {}

    row = {
        "user_id": uid,
        "context_type": context_type,
        "context_id": context_id,
        "questions": questions or [],
        "free_form_text": free_form_text,
        "sentiment_label": sentiment.get("label"),
        "sentiment_score": float(sentiment.get("score", 0.5) or 0.5),
        "completion_rate": float(progress.get("completion_rate", 0.5) or 0.5),
        "reward_signal": float(reward_signal),
        "reflection_response": reflection_response or {},
        "adaptation_response": adaptation_response or {},
        "indicators": indicators or [],
    }
    try:
        res = supa.table("reflections").insert(row).execute()
        data = res.data or []
        if data and isinstance(data[0], dict):
            return data[0].get("id")
    except Exception as e:
        print(f"[learning] persist_reflection skipped: {e}")
    return None


# ---------------------------------------------------------------------------
# Pattern learning (online correlation table)
# ---------------------------------------------------------------------------

async def update_learned_patterns(indicators: List[str]) -> bool:
    supa = get_supabase()
    if supa is None or not indicators:
        return False
    try:
        supa.rpc(
            "update_learned_patterns",
            {"present_indicators": [str(i) for i in indicators]},
        ).execute()
        return True
    except Exception as e:
        print(f"[learning] update_learned_patterns skipped: {e}")
        return False


async def get_top_learned_patterns(
    min_observations: int = 5,
    min_correlation: float = 0.5,
    max_results: int = 50,
) -> List[Dict[str, Any]]:
    """Returns rows like {trigger, outcome, correlation, observations, recommendation}.
    Empty list if no Supabase / no data yet."""
    supa = get_supabase()
    if supa is None:
        return []
    try:
        res = supa.rpc(
            "get_top_learned_patterns",
            {
                "min_observations": int(min_observations),
                "min_correlation": float(min_correlation),
                "max_results": int(max_results),
            },
        ).execute()
        return res.data or []
    except Exception as e:
        print(f"[learning] get_top_learned_patterns skipped: {e}")
        return []


# ---------------------------------------------------------------------------
# Bandit: per-rule adaptive thresholds
# ---------------------------------------------------------------------------

async def record_adaptation_outcome(
    user_id: Any,
    reflection_id: Optional[str],
    rule_fired: str,
    threshold_used: Optional[float],
) -> bool:
    """Log a (rule, threshold) decision so a future reflection can attribute
    a reward to it. Reward gets filled in by close_previous_adaptation_loops."""
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None:
        return False
    try:
        row: Dict[str, Any] = {
            "user_id": uid,
            "rule_fired": str(rule_fired),
        }
        rid = _try_parse_uuid(reflection_id)
        if rid is not None:
            row["reflection_id"] = rid
        if threshold_used is not None:
            row["threshold_used"] = float(threshold_used)
        supa.table("adaptation_outcomes").insert(row).execute()
        return True
    except Exception as e:
        print(f"[learning] record_adaptation_outcome skipped: {e}")
        return False


async def close_previous_adaptation_loops(user_id: Any, new_reward: float) -> int:
    """Attribute the latest reward to recent unresolved adaptation decisions
    for this user. Returns number of rows updated."""
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None:
        return 0
    try:
        res = supa.rpc(
            "close_adaptation_loop",
            {"user_id_in": uid, "reward_in": float(new_reward)},
        ).execute()
        # Postgres function returns INT; supabase-py wraps it in data
        data = res.data
        if isinstance(data, int):
            return data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            for v in data[0].values():
                if isinstance(v, int):
                    return v
        return 0
    except Exception as e:
        print(f"[learning] close_previous_adaptation_loops skipped: {e}")
        return 0


async def get_adaptive_threshold(
    rule_name: str,
    default_threshold: float,
    min_samples: int = 3,
) -> float:
    """Bandit pick: highest-mean-reward threshold for this rule, or default
    if there isn't enough data."""
    supa = get_supabase()
    if supa is None:
        return float(default_threshold)
    try:
        res = supa.rpc(
            "best_rule_threshold",
            {
                "rule_name": str(rule_name),
                "default_threshold": float(default_threshold),
                "min_samples": int(min_samples),
            },
        ).execute()
        data = res.data
        if isinstance(data, (int, float)):
            return float(data)
        if isinstance(data, list) and data:
            v = data[0]
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, dict):
                for x in v.values():
                    if isinstance(x, (int, float)):
                        return float(x)
        return float(default_threshold)
    except Exception as e:
        print(f"[learning] get_adaptive_threshold skipped: {e}")
        return float(default_threshold)


# ---------------------------------------------------------------------------
# Few-shot examples (in-context "RLHF" without training)
# ---------------------------------------------------------------------------

async def get_success_examples(
    barriers: Optional[List[str]] = None,
    max_results: int = 3,
) -> List[Dict[str, Any]]:
    """Retrieve a small set of high-reward past reflections to inject as
    few-shot examples into the adaptation LLM prompt. Empty list if no data."""
    supa = get_supabase()
    if supa is None:
        return []
    try:
        res = supa.rpc(
            "get_success_examples",
            {
                "barriers_filter": [str(b) for b in barriers] if barriers else None,
                "max_results": int(max_results),
            },
        ).execute()
        return res.data or []
    except Exception as e:
        print(f"[learning] get_success_examples skipped: {e}")
        return []


def format_success_examples_for_prompt(examples: List[Dict[str, Any]]) -> str:
    """Render examples as a compact prompt block. Returns '' when empty so
    callers can cheaply omit them."""
    if not examples:
        return ""
    lines = [
        "Reference cases — past adaptations that produced positive reflections:"
    ]
    for i, ex in enumerate(examples, 1):
        reward = ex.get("reward_signal")
        sent = ex.get("sentiment_label", "?")
        ref = (ex.get("reflection_summary") or "").strip()
        adapt = (ex.get("adaptation_summary") or "").strip()
        lines.append(
            f"{i}. [{sent}, reward={reward:+.2f}] reflection={ref!r}; "
            f"successful adaptation={adapt!r}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Convenience: shape learned patterns like the agent's hardcoded dict
# ---------------------------------------------------------------------------

def merge_with_hardcoded_couples(
    learned: List[Dict[str, Any]],
    hardcoded: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """Overlay learned (trigger, outcome) correlations on top of the agent's
    hardcoded coupled_events dict. Learned entries win when both exist.

    Keys: stable strings of the form 'learned::{trigger}->{outcome}' for new
    entries, original keys for hardcoded ones. The reflection_analysis_agent's
    detection loop only cares about the (trigger, outcome, correlation,
    description, recommendation) shape so we keep that contract.
    """
    out: Dict[str, Dict[str, Any]] = dict(hardcoded or {})
    for row in learned or []:
        trig = row.get("trigger")
        outc = row.get("outcome")
        if not trig or not outc:
            continue
        key = f"learned::{trig}->{outc}"
        out[key] = {
            "trigger": str(trig),
            "outcome": str(outc),
            "correlation": float(row.get("correlation", 0.5)),
            "description": (
                row.get("recommendation")
                or f"Learned pattern: {trig} → {outc}"
            ),
            "recommendation": (
                row.get("recommendation")
                or f"When {trig} appears, watch for {outc}"
            ),
        }
    return out


# ---------------------------------------------------------------------------
# Universal agent feedback loops (2026_universal_agent_learning.sql)
#
# Every public function below either:
#   * reads a learned signal an agent uses to bias its next decision, or
#   * writes a reward attribution after a reflection, closing the loop.
#
# All degrade to safe defaults when Supabase isn't configured.
# ---------------------------------------------------------------------------

import hashlib


def compute_profile_signature(
    barriers: Optional[List[str]],
    goals: Optional[List[str]],
) -> str:
    """Stable hash of (sorted barriers, sorted goal categories) so we can
    aggregate path outcomes across users with the same shape of problem.

    We intentionally lowercase + sort so 'ADHD'/'adhd' and order changes
    don't fragment the aggregate. Length-capped to keep the key compact.
    """
    bset = sorted({str(b).strip().lower() for b in (barriers or []) if b})
    gset = sorted({str(g).strip().lower()[:32] for g in (goals or []) if g})
    raw = "barriers=" + ",".join(bset) + "|goals=" + ",".join(gset)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]


# ---- path planning ---------------------------------------------------------

async def get_best_path_shape(
    profile_signature: str,
    min_samples: int = 3,
) -> Optional[Dict[str, Any]]:
    """Returns {milestone_count, est_days_avg, reward_avg, sample_count} or
    None if there isn't enough data yet — caller falls back to defaults."""
    supa = get_supabase()
    if supa is None or not profile_signature:
        return None
    try:
        res = supa.rpc(
            "get_best_path_shape",
            {
                "profile_signature_in": str(profile_signature),
                "min_samples": int(min_samples),
            },
        ).execute()
        rows = res.data or []
        if rows and isinstance(rows[0], dict):
            return rows[0]
    except Exception as e:
        print(f"[learning] get_best_path_shape skipped: {e}")
    return None


async def record_path_outcome(
    profile_signature: str,
    milestone_count: int,
    est_days_avg: Optional[float],
    reward: float,
) -> bool:
    supa = get_supabase()
    if supa is None or not profile_signature:
        return False
    try:
        supa.rpc(
            "record_path_outcome",
            {
                "profile_signature_in": str(profile_signature),
                "milestone_count_in":   int(milestone_count),
                "est_days_avg_in":      float(est_days_avg) if est_days_avg is not None else None,
                "reward_in":            float(reward),
            },
        ).execute()
        return True
    except Exception as e:
        print(f"[learning] record_path_outcome skipped: {e}")
        return False


# ---- tool / resource recommendation ---------------------------------------

async def get_tool_outcome_scores(
    barriers: Optional[List[str]],
    min_samples: int = 2,
) -> Dict[str, Dict[str, Any]]:
    """Returns {tool_id: {'reward_avg': float, 'sample_count': int}}. Empty
    dict if no Supabase / no data. Used by tool_recommendation_agent and
    ServiceHub scorer alike."""
    supa = get_supabase()
    if supa is None:
        return {}
    try:
        bars = [str(b).strip().lower() for b in (barriers or []) if b]
        res = supa.rpc(
            "get_tool_outcome_scores",
            {
                "barriers_in": bars or None,
                "min_samples": int(min_samples),
            },
        ).execute()
        rows = res.data or []
        out: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            tid = r.get("tool_id")
            if tid is None:
                continue
            out[str(tid)] = {
                "reward_avg":   float(r.get("reward_avg") or 0.0),
                "sample_count": int(r.get("sample_count") or 0),
            }
        return out
    except Exception as e:
        print(f"[learning] get_tool_outcome_scores skipped: {e}")
        return {}


async def record_tool_outcomes(
    tool_ids: List[str],
    barriers: Optional[List[str]],
    reward: float,
) -> bool:
    supa = get_supabase()
    if supa is None or not tool_ids:
        return False
    try:
        supa.rpc(
            "record_tool_outcomes",
            {
                "tool_ids_in": [str(t) for t in tool_ids],
                "barriers_in": [str(b).strip().lower() for b in (barriers or []) if b],
                "reward_in":   float(reward),
            },
        ).execute()
        return True
    except Exception as e:
        print(f"[learning] record_tool_outcomes skipped: {e}")
        return False


# ---- calendar optimization -------------------------------------------------

async def get_user_calendar_preferences(
    user_id: Any,
    min_samples: int = 2,
    max_results: int = 5,
) -> List[Dict[str, Any]]:
    """Returns [{'time_bucket': str, 'reward_avg': float, 'sample_count': int}]
    sorted best-first. Empty list if no data / no Supabase / non-UUID user."""
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None:
        return []
    try:
        res = supa.rpc(
            "get_user_calendar_preferences",
            {
                "user_id_in":  uid,
                "min_samples": int(min_samples),
                "max_results": int(max_results),
            },
        ).execute()
        return res.data or []
    except Exception as e:
        print(f"[learning] get_user_calendar_preferences skipped: {e}")
        return []


async def record_calendar_outcomes(
    user_id: Any,
    time_buckets: List[str],
    reward: float,
) -> bool:
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None or not time_buckets:
        return False
    try:
        supa.rpc(
            "record_calendar_outcomes",
            {
                "user_id_in":     uid,
                "time_buckets_in": [str(b) for b in time_buckets],
                "reward_in":      float(reward),
            },
        ).execute()
        return True
    except Exception as e:
        print(f"[learning] record_calendar_outcomes skipped: {e}")
        return False


# ---- pattern_recognition feedback (missing writer) ------------------------

async def record_pattern_user_feedback(
    query_user_id: Any,
    retrieved_user_ids: List[str],
    reward: float,
    alpha: float = 0.3,
) -> bool:
    """Update pattern_user_feedback with an EMA toward the latest reward, for
    every similar user that was retrieved on the last generation. Skips if
    either id isn't a real UUID, or Supabase isn't configured."""
    supa = get_supabase()
    quid = _try_parse_uuid(query_user_id)
    if supa is None or quid is None:
        return False
    rids: List[str] = []
    for r in retrieved_user_ids or []:
        parsed = _try_parse_uuid(r)
        if parsed is not None:
            rids.append(parsed)
    if not rids:
        return False
    try:
        supa.rpc(
            "record_pattern_user_feedback",
            {
                "query_user_id_in":      quid,
                "retrieved_user_ids_in": rids,
                "reward_in":             float(reward),
                "alpha_in":              float(alpha),
            },
        ).execute()
        return True
    except Exception as e:
        print(f"[learning] record_pattern_user_feedback skipped: {e}")
        return False


# ---- attribution snapshot --------------------------------------------------

async def snapshot_user_context(
    user_id: Any,
    profile_signature: str,
    milestone_count: int,
    est_days_avg: Optional[float],
    recommended_tool_ids: List[str],
    scheduled_buckets: List[str],
    retrieved_user_ids: List[str],
    barriers: List[str],
) -> bool:
    """Persist the most recent generation context so the NEXT reflection
    can attribute reward back to the right (path shape, tool ids, schedule
    buckets, retrieved similar users)."""
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None:
        return False
    rid_uuids: List[str] = []
    for r in retrieved_user_ids or []:
        parsed = _try_parse_uuid(r)
        if parsed is not None:
            rid_uuids.append(parsed)
    try:
        supa.rpc(
            "snapshot_user_context",
            {
                "user_id_in":              uid,
                "profile_signature_in":    str(profile_signature or ""),
                "milestone_count_in":      int(milestone_count or 0),
                "est_days_avg_in":         float(est_days_avg) if est_days_avg is not None else None,
                "recommended_tool_ids_in": [str(t) for t in (recommended_tool_ids or [])],
                "scheduled_buckets_in":    [str(b) for b in (scheduled_buckets or [])],
                "retrieved_user_ids_in":   rid_uuids,
                "barriers_in":             [str(b).strip().lower() for b in (barriers or []) if b],
            },
        ).execute()
        return True
    except Exception as e:
        print(f"[learning] snapshot_user_context skipped: {e}")
        return False


async def get_user_latest_context(user_id: Any) -> Optional[Dict[str, Any]]:
    """Read the most recent attribution context for a user. None if no
    Supabase / no snapshot yet / non-UUID user."""
    supa = get_supabase()
    uid = _try_parse_uuid(user_id)
    if supa is None or uid is None:
        return None
    try:
        res = supa.rpc(
            "get_user_latest_context",
            {"user_id_in": uid},
        ).execute()
        rows = res.data or []
        if rows and isinstance(rows[0], dict):
            return rows[0]
    except Exception as e:
        print(f"[learning] get_user_latest_context skipped: {e}")
    return None


# ---- helpers used by the calendar agent for bucket naming ----------------

def schedule_to_buckets(
    scheduled_days: List[Dict[str, Any]],
) -> List[str]:
    """Map a day-by-day schedule (output of calendar_optimization_agent) into
    a list of human-readable time_bucket strings the learning loop can
    aggregate against. Stable strings, intentionally coarse-grained so we
    actually accumulate samples.
    """
    out: List[str] = []
    for day in scheduled_days or []:
        if not isinstance(day, dict):
            continue
        dtype = str(day.get("type") or "balanced").lower()
        energy = str(day.get("energyLevel") or "medium").lower()
        bucket = f"{dtype}_{energy}"
        out.append(bucket)
    return out

