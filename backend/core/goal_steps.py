"""Steps for a goal added in the Race view, without setting up again.

The team's notes, October 2026: "The 'Your Goals, Dreams & Obstacles' section
should be customizable here, so someone doesn't need to re-do the entire
onboarding for this." A goal added there (core/profile_edit.py) starts with
no steps; this plans that one goal with the same agents as setup (path
planning, then tool recommendations) and adds its race to the plan. The
rest of the plan is left as it is. The new tasks aren't on the calendar
until the plan is next adapted.
"""
from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Tuple

from core.path_storage import attach_tasks

_MILESTONE_G = re.compile(r"^milestone_g(\d+)_")
_RACE = re.compile(r"^race_(\d+)$")


def _key(s: Any) -> str:
    return str(s or "").strip().lower()


def _planning(payload: Dict[str, Any]) -> Dict[str, Any] | None:
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning" and isinstance(response.get("result"), dict):
            return response["result"]
    return None


def next_goal_index(payload: Dict[str, Any]) -> int:
    """The next free goal number: milestone ids are milestone_g<n>_..., races race_<n>."""
    used = [-1]
    for race in payload.get("races") or []:
        m = _RACE.match(str((race or {}).get("id") or ""))
        if m:
            used.append(int(m.group(1)))
        for ms in (race or {}).get("milestones") or []:
            g = _MILESTONE_G.match(str((ms or {}).get("id") or ""))
            if g:
                used.append(int(g.group(1)))
    for ms in (_planning(payload) or {}).get("milestones") or []:
        g = _MILESTONE_G.match(str((ms or {}).get("id") or ""))
        if g:
            used.append(int(g.group(1)))
    return max(used) + 1


def has_steps(payload: Dict[str, Any], goal: str) -> bool:
    for race in payload.get("races") or []:
        if isinstance(race, dict) and _key(race.get("goal") or race.get("name")) == _key(goal) and race.get("milestones"):
            return True
    return any(_key((m or {}).get("goal")) == _key(goal) for m in (_planning(payload) or {}).get("milestones") or [])


def renumber(planning: Dict[str, Any], tools: Dict[str, Any], k: int) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Goal 0's ids (it was planned alone) as goal k's, so nothing clashes."""
    def mid(value: Any) -> Any:
        return _MILESTONE_G.sub(f"milestone_g{k}_", value) if isinstance(value, str) else value

    planning = copy.deepcopy(planning)
    for m in planning.get("milestones") or []:
        m["id"] = mid(m.get("id"))
        m["raceId"] = f"race_{k}"
        for c in m.get("recommendedChoices") or []:
            if isinstance(c, dict) and isinstance(c.get("id"), str):
                c["id"] = c["id"].replace("_milestone_g0_", f"_milestone_g{k}_")
    for t in planning.get("tasks") or []:
        t["milestoneId"] = mid(t.get("milestoneId"))
        if isinstance(t.get("id"), str):
            t["id"] = t["id"].replace("task_milestone_g0_", f"task_milestone_g{k}_")
    recs = {mid(key): value for key, value in ((tools or {}).get("recommendations") or {}).items()}
    return planning, {"recommendations": recs}


def merge_goal(payload: Dict[str, Any], goal: str, planning: Dict[str, Any], tools: Dict[str, Any]) -> Dict[str, Any]:
    """A copy of the plan with the goal's race, milestones, tasks and tools added.
    Unchanged if the goal has steps already (asked twice)."""
    if has_steps(payload, goal):
        return payload
    k = next_goal_index(payload)
    planning, tools = renumber(planning, tools, k)
    out = copy.deepcopy(payload)
    milestones = [m for m in planning.get("milestones") or [] if isinstance(m, dict)]
    tasks = [t for t in planning.get("tasks") or [] if isinstance(t, dict)]
    for m in milestones:
        m["goal"] = goal
    race = {
        "id": f"race_{k}",
        "name": goal,
        "goal": goal,
        "progress": 0,
        "models": [],
        "milestones": attach_tasks(milestones, tasks),
    }
    races = [r for r in out.get("races") or [] if not (isinstance(r, dict) and _key(r.get("goal") or r.get("name")) == _key(goal) and not r.get("milestones"))]
    races.append(race)
    out["races"] = races

    result = _planning(out)
    if result is None:
        out.setdefault("agentResponses", []).append({"agentId": "path_planning", "agentName": "Path Planning Agent", "result": {"milestones": [], "tasks": []}})
        result = _planning(out)
    result["milestones"] = list(result.get("milestones") or []) + milestones
    result["tasks"] = list(result.get("tasks") or []) + tasks

    for response in out.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "tool_recommendation":
            res = response.setdefault("result", {})
            res["recommendations"] = {**(res.get("recommendations") or {}), **tools["recommendations"]}
            break
    else:
        out.setdefault("agentResponses", []).append({
            "agentId": "tool_recommendation", "agentName": "Tool Recommendation Agent",
            "result": {"recommendations": tools["recommendations"]},
        })

    if isinstance(out.get("path"), dict):
        out["path"]["races"] = races
        out["path"]["milestones"] = list(out["path"].get("milestones") or []) + milestones
    return out


async def plan_goal(payload: Dict[str, Any], goal: str, user_id: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Plan one goal with the setup agents: its milestones and tasks, then its tools."""
    from core import memory as mem
    from core.agents.path_planning_agent import PathPlanningAgent, milestones_per_area
    from core.agents.tool_recommendation_agent import ToolRecommendationAgent
    from core.output_quality import ensure_generation_quality

    profile = dict(payload.get("userProfile") or {})
    barriers = [b for b in profile.get("barrierTypes") or [] if isinstance(b, str)]
    goals_total = max(1, len([g for g in profile.get("goals") or [] if isinstance(g, str)]))

    planner = PathPlanningAgent()
    await planner.initialize()
    try:
        response = await planner.generate_path(
            user_profile=profile,
            goals=[goal],
            barriers=barriers,
            similar_patterns=[],
            memory=mem.load_user_memory(user_id),
            per_area=milestones_per_area(goals_total),
        )
        response, _report = ensure_generation_quality(response=response, goals=[goal])
    finally:
        await planner.cleanup()

    tools_agent = ToolRecommendationAgent()
    await tools_agent.initialize()
    try:
        tools = await tools_agent.recommend_tools(user_profile=profile, milestones=response.get("milestones") or [], barriers=barriers)
    finally:
        await tools_agent.cleanup()
    return response, tools
