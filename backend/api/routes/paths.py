"""
Path API Routes
Step 1: Path View - Serves AI-generated paths from agent orchestration
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional

from api.auth_guard import current_user_id, onboarding_user_id, require_self_or_guardian
from core.path_privacy import without_other_people

router = APIRouter()


class GuidanceRequest(BaseModel):
    # "Words we use" in Settings (frontend/lib/languageStyle.ts).
    languageStyle: Optional[str] = Field(default=None, max_length=10)


def _active_row(user_id: str) -> Optional[Dict[str, Any]]:
    """The caller's active plan row (path_id, payload), newest first."""
    from database.supabase_client import get_supabase

    client = get_supabase()
    if client is None:
        return None
    res = (
        client.table("user_paths")
        .select("path_id, payload")
        .eq("user_id", user_id)
        .order("is_active", desc=True)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows and isinstance(rows[0].get("payload"), dict) else None


class GoalEdit(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    text: str = Field(default="", max_length=300)
    # The goal as it was, when this one is a rename (or unchanged).
    from_: Optional[str] = Field(default=None, alias="from", max_length=600)
    area: Optional[str] = Field(default=None, max_length=20)


class ProfileEditRequest(BaseModel):
    goals: List[GoalEdit] = Field(default_factory=list, max_length=12)
    dreams: List[str] = Field(default_factory=list, max_length=12)
    obstacles: List[str] = Field(default_factory=list, max_length=12)
    ultimateDream: Optional[str] = Field(default=None, max_length=600)


class GoalStepsRequest(BaseModel):
    goal: str = Field(max_length=300)
    languageStyle: Optional[str] = Field(default=None, max_length=10)


def _save_payload(user_id: str, path_id: str, payload: Dict[str, Any]) -> bool:
    """Write one plan's payload, leaving which plan is active as it is."""
    from database.supabase_client import get_supabase
    from api.routes.onboarding import generated_paths

    client = get_supabase()
    if client is None:
        return False
    try:
        client.table("user_paths").update({"payload": payload}).eq("user_id", user_id).eq("path_id", path_id).execute()
    except Exception as e:  # pragma: no cover - network
        print(f"[paths] save skipped: {e}")
        return False
    if path_id in generated_paths:
        generated_paths[path_id] = payload
    return True


@router.put("/me/profile")
async def edit_my_profile(request: ProfileEditRequest, caller_id: str = Depends(onboarding_user_id)):
    """Change the plan's goals, dreams, obstacles and biggest dream from the
    Race view (core/profile_edit.py), without setting up again. The same
    checks as setup run first; nothing is regenerated."""
    from core import profile_edit
    from core.guardrails import validate_all_inputs

    row = _active_row(caller_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No plan yet.")
    try:
        edit = profile_edit.clean({
            "goals": [{"text": g.text, "from": g.from_, "area": g.area} for g in request.goals],
            "dreams": request.dreams,
            "obstacles": request.obstacles,
            "ultimateDream": request.ultimateDream,
        })
    except profile_edit.EditError as e:
        raise HTTPException(status_code=422, detail=str(e))
    ok, reason = validate_all_inputs(
        goals=[g["text"] for g in edit["goals"]],
        barriers=[],
        dreams=edit["dreams"] + ([edit["ultimateDream"]] if edit["ultimateDream"] else []),
        challenges=edit["obstacles"],
    )
    if not ok:
        raise HTTPException(status_code=422, detail=reason)

    latest = _active_row(caller_id)
    if latest is None or latest["path_id"] != row["path_id"]:
        raise HTTPException(status_code=409, detail="Your plan changed meanwhile. Try again.")
    updated = profile_edit.apply(latest["payload"], edit)
    if not _save_payload(caller_id, row["path_id"], updated):
        raise HTTPException(status_code=503, detail="Couldn't save that. Try again.")
    profile = updated.get("userProfile") or {}
    return {
        "goals": profile.get("goals", []),
        "goalCategories": profile.get("goalCategories", {}),
        "dreams": profile.get("dreams", []),
        "currentChallenges": profile.get("currentChallenges", []),
        "hiddenGoals": profile.get("hiddenGoals", []),
        "ultimateDream": profile.get("ultimateDream", ""),
        "goalsWithoutSteps": profile_edit.goals_without_steps(updated),
    }


@router.post("/me/goal-steps")
async def build_my_goal_steps(request: GoalStepsRequest, caller_id: str = Depends(onboarding_user_id)):
    """Plan the steps for a goal added in the Race view (core/goal_steps.py):
    the same agents as setup, for that one goal; the rest of the plan stays."""
    from core import budget, llm
    from core import goal_steps

    row = _active_row(caller_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No plan yet.")
    goals = [g for g in (row["payload"].get("userProfile") or {}).get("goals") or [] if isinstance(g, str)]
    goal = next((g for g in goals if g.strip().lower() == request.goal.strip().lower()), None)
    if goal is None:
        raise HTTPException(status_code=404, detail="That goal isn't in your plan.")
    if goal_steps.has_steps(row["payload"], goal):
        return {"added": 0, "goal": goal}
    try:
        with llm.use_selection(None, actor=caller_id, verified=True, language_style=request.languageStyle):
            planning, tools = await goal_steps.plan_goal(row["payload"], goal, caller_id)
    except budget.LimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)
    latest = _active_row(caller_id)
    if latest is None or latest["path_id"] != row["path_id"]:
        raise HTTPException(status_code=409, detail="Your plan changed meanwhile. Try again.")
    merged = goal_steps.merge_goal(latest["payload"], goal, planning, tools)
    if merged is not latest["payload"] and not _save_payload(caller_id, row["path_id"], merged):
        raise HTTPException(status_code=503, detail="Couldn't save that. Try again.")
    return {"added": len(planning.get("milestones") or []), "goal": goal}


@router.post("/me/guidance")
async def my_guidance(request: Optional[GuidanceRequest] = None, caller_id: str = Depends(current_user_id)):
    """What to avoid and what helps at each step of the caller's plan
    (core/milestone_guidance.py). Written once and kept in the plan, so the
    Race view's Avoidance and Suggestions views and the Milestone view's
    "Top 5 mistakes made at this stage" show the same words. Only steps
    without it (or renamed since) are written."""
    from core import llm
    from core import milestone_guidance as guide

    row = _active_row(caller_id)
    if row is None:
        return {"guidance": {}, "pathId": None}
    payload = row["payload"]
    milestones = guide.plan_milestones(payload)
    todo = guide.stale(payload, milestones)
    if not todo:
        return {"guidance": guide.merged(payload, {}, milestones), "pathId": row["path_id"]}

    with llm.use_selection(None, actor=caller_id, verified=True,
                           language_style=(request.languageStyle if request else None)):
        fresh = await guide.write_guidance(payload, todo)

    # Read again just before writing: only the guidance changes, so anything
    # else saved meanwhile (a renamed goal, a removed tool) is kept.
    latest = _active_row(caller_id)
    if latest is None or latest["path_id"] != row["path_id"]:
        return {"guidance": guide.merged(payload, fresh, milestones), "pathId": row["path_id"]}
    stored = latest["payload"]
    stored["milestoneGuidance"] = guide.merged(stored, fresh, guide.plan_milestones(stored))
    _save_payload(caller_id, row["path_id"], stored)
    return {"guidance": stored["milestoneGuidance"], "pathId": row["path_id"]}


@router.get("/{path_id}")
async def get_path(path_id: str, caller_id: str = Depends(current_user_id)):
    """
    Get a generated path by ID.
    First checks if it was generated by the agent system during onboarding.
    Only its owner, or their guardian, may read a generated path.
    """
    # Check the in-memory store from onboarding agent orchestration
    from api.routes.onboarding import generated_paths

    if path_id in generated_paths:
        require_self_or_guardian(str(generated_paths[path_id].get("userId") or ""), caller_id)
        return without_other_people(generated_paths[path_id])

    # Fallback for legacy/mock paths
    return {
        "id": path_id,
        "userId": "unknown",
        "name": "My Personal Path",
        "description": "Path toward your goals",
        "races": [],
        "stats": [
            {"name": "Mentality", "value": 3, "maxValue": 100, "color": "green"},
            {"name": "Happiness", "value": 8, "maxValue": 100, "color": "green"},
        ],
        "motivationWheel": {
            "id": "wheel_1",
            "options": ["Focus", "Energy", "Confidence", "Growth", "Resilience", "Connection"],
            "currentMotivation": None,
        },
        "createdAt": None,
        "updatedAt": None,
    }


@router.post("/{path_id}/adapt")
async def adapt_path(path_id: str, reflection_data: dict, caller_id: str = Depends(current_user_id)):
    """
    Adapt a path based on user reflection — triggers Reflection + Adaptation agents.
    Only for the path's owner, or their guardian.
    """
    from api.routes.onboarding import generated_paths
    from core.orchestrator import Orchestrator

    if path_id not in generated_paths:
        raise HTTPException(status_code=404, detail="Path not found")

    path_data = generated_paths[path_id]
    user_id = path_data.get("userId", "unknown")
    require_self_or_guardian(str(user_id), caller_id)

    orchestrator = Orchestrator()
    await orchestrator.initialize()

    adaptation_result = await orchestrator.adapt_path(
        user_id=user_id,
        path_id=path_id,
        reflection_data=reflection_data
    )

    await orchestrator.cleanup()

    # Merge adaptation into stored path
    generated_paths[path_id].update(adaptation_result)

    return adaptation_result

@router.get("/milestones/{milestone_id}/common-mistakes")
async def milestone_common_mistakes(milestone_id: str):
    """Real, cross-user 'what not to do' list for one milestone stage.

    Aggregate only — an indicator name, a percentage, and how many
    reflections it's based on. No individual's data is identifiable from
    this, so unlike the user-path endpoints this stays open.

    Milestone ids are structural (milestone_g{goal}_{dim}_{i}), so this
    naturally pools real signal across every user whose Nth milestone in a
    dimension is this one — not a single person's history.
    """
    from core.learning import get_common_mistakes

    mistakes = await get_common_mistakes(milestone_id)
    return {"milestoneId": milestone_id, "mistakes": mistakes}
