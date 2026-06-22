"""
Reflection API Routes — Step 6: Journal/Reflection View

This endpoint is the moment the system learns from the user.

When a journal entry comes in we now:
  1. Run the full LangGraph adaptation pipeline (reflection_analysis →
     adaptation → optional calendar → synthesis) — the orchestration that
     already existed but the previous in-memory version of this route
     wasn't calling.
  2. Compute a scalar reward signal from the agent output.
  3. Persist the full (state, action, reward) tuple to Supabase
     (`reflections` table) so we have a real labeled corpus growing with use.
  4. Update online learning signals so the NEXT run is better:
       - learned_patterns        — replaces the agent's hardcoded
                                   coupled_events dict over time
       - adaptation_outcomes     — closes the bandit loop for past decisions
                                   and logs new ones
       - pattern_user_embeddings — re-indexes the user with the latest
                                   success_rate so similar-user retrieval
                                   re-ranks toward people who actually do well

  5. Every step degrades gracefully if Supabase isn't configured. The
     OpenAI calls inside the agents are also optional. Marginal cost per
     entry with everything off: $0. With OpenAI on: < $0.001.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from core.orchestrator import Orchestrator
from core import learning

router = APIRouter()

# Shared orchestrator instance for this router. Reuses the same agents across
# requests; initialize() is idempotent. Mirrors how paths.py / onboarding.py
# do it.
_orchestrator: Optional[Orchestrator] = None

# Lightweight fallback log so the GET endpoint still has something to return
# when Supabase isn't configured. Holds only the most recent entries per
# process; not authoritative.
_in_memory_reflections: List[Dict[str, Any]] = []
_IN_MEMORY_MAX = 50


async def _get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    if not _orchestrator.initialized:
        await _orchestrator.initialize()
    return _orchestrator


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ReflectionRequest(BaseModel):
    contextType: str
    contextId: str
    questions: List[dict]
    freeFormText: Optional[str] = None


class ReflectionResponse(BaseModel):
    reflectionId: str
    insights: dict
    adaptations: Optional[dict] = None
    reward: float
    learning: dict


# ---------------------------------------------------------------------------
# POST /api/reflections/
# ---------------------------------------------------------------------------

@router.post("/", response_model=ReflectionResponse)
async def create_reflection(request: ReflectionRequest, user_id: str = "user_123"):
    """Create a reflection, trigger adaptation, and close the learning loop."""

    orchestrator = await _get_orchestrator()

    # Shape the reflection payload the LangGraph adaptation pipeline expects.
    reflection_data: Dict[str, Any] = {
        "freeFormText": request.freeFormText,
        "questions": request.questions,
        "contextType": request.contextType,
        "contextId": request.contextId,
        "user_profile": {},  # filled when we have a real user lookup
    }

    # 1. Run reflection_analysis + adaptation (+ optional calendar) via
    #    the existing LangGraph adaptation_graph. This is the same graph the
    #    orchestrator was wired with — we just hadn't been calling it from
    #    this route before.
    pipeline = await orchestrator.adapt_path(
        user_id=user_id,
        path_id=request.contextId or "default",
        reflection_data=reflection_data,
    )

    agent_responses = pipeline.get("agentResponses", [])
    reflection_response: Dict[str, Any] = {}
    adaptation_response: Dict[str, Any] = {}
    for entry in agent_responses:
        if entry.get("agentId") == "reflection_analysis":
            reflection_response = entry.get("result", {}) or {}
        elif entry.get("agentId") == "adaptation":
            adaptation_response = entry.get("result", {}) or {}

    # 2. Compute the scalar reward signal that drives every learning step.
    reward = learning.compute_reward_signal(reflection_response)

    # 3. Pull the pattern indicators that fired and grow the global
    #    correlation table.
    indicators = learning.extract_indicators(reflection_response)

    # 4. Close the bandit loop for past adaptations and persist the new
    #    reflection record.
    closed = await learning.close_previous_adaptation_loops(user_id, reward)
    reflection_id = learning.persist_reflection(
        user_id=user_id,
        context_type=request.contextType,
        context_id=request.contextId,
        questions=request.questions,
        free_form_text=request.freeFormText,
        reflection_response=reflection_response,
        adaptation_response=adaptation_response,
        reward_signal=reward,
        indicators=indicators,
    )
    await learning.update_learned_patterns(indicators)

    # 5. Record each adaptation rule that fired so it can be rewarded by the
    #    NEXT reflection.
    rules_logged = 0
    for adapt in (adaptation_response.get("adaptations", []) or []):
        rule = adapt.get("type") or adapt.get("rule") or "unknown"
        threshold = adapt.get("threshold_used")
        ok = await learning.record_adaptation_outcome(
            user_id=user_id,
            reflection_id=reflection_id,
            rule_fired=str(rule),
            threshold_used=threshold,
        )
        if ok:
            rules_logged += 1

    # 5b. Close the universal-agent feedback loops.
    #     The orchestrator snapshotted (profile_signature, milestone_count,
    #     est_days_avg, recommended_tool_ids, scheduled_buckets,
    #     retrieved_user_ids, barriers) when it generated the user's path.
    #     We read that snapshot back and attribute today's reward to every
    #     individual decision in parallel. Each call is best-effort; all
    #     degrade to False/None when Supabase isn't configured.
    path_outcome_recorded = False
    tool_outcomes_recorded = False
    calendar_outcomes_recorded = False
    pattern_feedback_recorded = False
    latest_ctx = await learning.get_user_latest_context(user_id)
    if latest_ctx:
        try:
            results = await asyncio.gather(
                learning.record_path_outcome(
                    profile_signature=str(latest_ctx.get("profile_signature") or ""),
                    milestone_count=int(latest_ctx.get("milestone_count") or 0),
                    est_days_avg=latest_ctx.get("est_days_avg"),
                    reward=reward,
                ),
                learning.record_tool_outcomes(
                    tool_ids=list(latest_ctx.get("recommended_tool_ids") or []),
                    barriers=list(latest_ctx.get("barriers") or []),
                    reward=reward,
                ),
                learning.record_calendar_outcomes(
                    user_id=user_id,
                    time_buckets=list(latest_ctx.get("scheduled_buckets") or []),
                    reward=reward,
                ),
                learning.record_pattern_user_feedback(
                    query_user_id=user_id,
                    retrieved_user_ids=list(latest_ctx.get("retrieved_user_ids") or []),
                    reward=reward,
                ),
                return_exceptions=True,
            )
            path_outcome_recorded     = bool(results[0]) is True
            tool_outcomes_recorded    = bool(results[1]) is True
            calendar_outcomes_recorded = bool(results[2]) is True
            pattern_feedback_recorded = bool(results[3]) is True
        except Exception as e:
            print(f"[reflections] universal loop close skipped: {e}")

    # 6. Re-index this user's embedding with the latest success signal so the
    #    similar-user retrieval ranker prefers them when they're doing well.
    #    success_rate is in [0, 1]; reward is in [-1, 1].
    success_rate = max(0.0, min(1.0, (reward + 1.0) / 2.0))
    user_profile = reflection_data.get("user_profile", {}) or {}
    barriers = list(user_profile.get("barrierTypes", []) or [])
    goals = list(reflection_response.get("goals", []) or [])
    indexed = False
    try:
        indexed = await orchestrator.index_user(
            user_id=user_id,
            user_profile=user_profile,
            goals=goals,
            barriers=barriers,
            agent_result={"path": pipeline.get("path"), "milestones": []},
            success_rate=success_rate,
        )
    except Exception as e:
        print(f"[reflections] index_user skipped: {e}")

    # 7. Best-effort in-memory mirror so the GET endpoint stays useful in
    #    development without Supabase.
    summary = ""
    if request.questions:
        first = (request.questions[0] or {}).get("answer", "") or ""
        summary = (first[:100] + "...") if len(first) > 100 else first
    _in_memory_reflections.insert(0, {
        "id": reflection_id or str(uuid.uuid4()),
        "userId": user_id,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "contextType": request.contextType,
        "contextId": request.contextId,
        "contextName": f"{request.contextType.capitalize()} Reflection",
        "sentiment": (reflection_response.get("sentiment") or {}).get("label", "neutral"),
        "summary": summary or "Reflection recorded",
        "questions": [
            {"q": q.get("question", ""), "a": q.get("answer", "")}
            for q in (request.questions or [])
        ],
        "insights": [
            *((reflection_response.get("insights") or {}).get("recommendations") or []),
        ][:5],
        "freeFormText": request.freeFormText,
        "reward": reward,
    })
    if len(_in_memory_reflections) > _IN_MEMORY_MAX:
        del _in_memory_reflections[_IN_MEMORY_MAX:]

    return ReflectionResponse(
        reflectionId=reflection_id or "in-memory",
        insights=reflection_response.get("insights", {}) or {
            "sentiment": (reflection_response.get("sentiment") or {}).get("label", "neutral"),
        },
        adaptations=adaptation_response or None,
        reward=reward,
        learning={
            "persisted": bool(reflection_id),
            "indicators_logged": len(indicators),
            "previous_adaptations_resolved": closed,
            "adaptation_rules_logged": rules_logged,
            "user_reindexed": bool(indexed),
            "path_outcome_recorded":     path_outcome_recorded,
            "tool_outcomes_recorded":    tool_outcomes_recorded,
            "calendar_outcomes_recorded": calendar_outcomes_recorded,
            "pattern_feedback_recorded": pattern_feedback_recorded,
        },
    )


# ---------------------------------------------------------------------------
# GET /api/reflections/user/{user_id}
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}")
async def get_user_reflections(user_id: str):
    """Return a user's reflection history. Reads from Supabase when available
    and falls back to the in-memory mirror otherwise."""
    from database.supabase_client import get_supabase

    uid = learning._try_parse_uuid(user_id)
    supa = get_supabase()
    if supa is not None and uid is not None:
        try:
            res = (
                supa.table("reflections")
                .select(
                    "id, created_at, context_type, context_id, sentiment_label, "
                    "reward_signal, free_form_text, questions, reflection_response"
                )
                .eq("user_id", uid)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            rows = res.data or []
            if rows:
                return [_row_to_legacy_shape(r) for r in rows]
        except Exception as e:
            print(f"[reflections] supabase fetch skipped: {e}")

    mirror = [r for r in _in_memory_reflections if r.get("userId") == user_id]
    if mirror:
        return mirror

    # Seed demo data only when there is literally nothing for this user.
    return _DEMO_REFLECTIONS


def _row_to_legacy_shape(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map a Supabase reflections row into the JSON shape the frontend
    already consumes."""
    refl = row.get("reflection_response") or {}
    return {
        "id": row.get("id"),
        "date": (row.get("created_at") or "")[:10],
        "contextType": row.get("context_type"),
        "contextId": row.get("context_id"),
        "contextName": f"{(row.get('context_type') or 'Path').capitalize()} Reflection",
        "sentiment": row.get("sentiment_label") or "neutral",
        "reward": row.get("reward_signal"),
        "summary": (row.get("free_form_text") or "")[:140] or "Reflection recorded",
        "questions": [
            {"q": q.get("question", ""), "a": q.get("answer", "")}
            for q in (row.get("questions") or [])
        ],
        "insights": ((refl.get("insights") or {}).get("recommendations") or [])[:5],
    }


# ---------------------------------------------------------------------------
# GET /api/reflections/questions/{context_type}
# ---------------------------------------------------------------------------

@router.get("/questions/{context_type}")
async def get_reflection_questions(context_type: str):
    """Get reflection questions for context type"""
    questions = {
        "path": [
            "How was your overall progress?",
            "What worked well?",
            "What would you improve?"
        ],
        "race": [
            "How is this race going?",
            "What milestones are you proud of?",
            "What challenges are you facing?"
        ],
        "milestone": [
            "How did this milestone go?",
            "What tools helped?",
            "What would you do differently?"
        ],
        "task": [
            "How was this task?",
            "Did the helper tricks work?",
            "How do you feel about completing it?"
        ],
        "calendar": [
            "How was your day?",
            "Did you stick to the schedule?",
            "What would you change?"
        ]
    }
    return {"questions": questions.get(context_type, [])}


# Demo seed kept around so the journal screen has something to show during
# local development before any real reflections exist.
_DEMO_REFLECTIONS: List[Dict[str, Any]] = [
    {
        "id": "seed_1",
        "date": "2026-01-17",
        "contextType": "path",
        "contextName": "Graduate University Path",
        "sentiment": "positive",
        "summary": "Feeling good about progress on accommodation requests. The disability office was helpful!",
        "questions": [
            {"q": "How was today?", "a": "Really productive! Got a lot done."},
            {"q": "How well done do you think it was?", "a": "8/10 - better than expected"},
            {"q": "What would you improve?", "a": "Start earlier in the day next time"},
        ],
        "insights": ["Positive momentum detected", "Morning routines working well"],
    },
    {
        "id": "seed_2",
        "date": "2026-01-16",
        "contextType": "task",
        "contextName": "Group Project Meeting",
        "sentiment": "negative",
        "summary": "Struggled with the group project. Feeling overwhelmed by social interaction.",
        "questions": [
            {"q": "How was today?", "a": "Exhausting. The meeting went longer than expected."},
            {"q": "How well done do you think it was?", "a": "4/10 - I couldn't focus"},
            {"q": "What would you improve?", "a": "Ask for a smaller group or individual alternative"},
        ],
        "insights": ["Social fatigue detected", "Consider requesting accommodation"],
    },
    {
        "id": "seed_3",
        "date": "2026-01-15",
        "contextType": "milestone",
        "contextName": "Request Accommodations",
        "sentiment": "neutral",
        "summary": "Started the accommodation request process. Nervous but hopeful.",
        "questions": [
            {"q": "How was today?", "a": "Mixed feelings. Progress is slow but steady."},
            {"q": "How well done do you think it was?", "a": "6/10 - okay"},
            {"q": "What would you improve?", "a": "More preparation before meetings"},
        ],
        "insights": ["Steady progress", "Building confidence"],
    },
]
