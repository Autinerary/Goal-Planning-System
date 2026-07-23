"""Deterministic quality gates for generated agent output.

LLM output is untrusted data. These checks keep malformed, empty, repetitive,
or placeholder content from propagating through downstream agents. Repairs use
stable templates rather than another model call, so a failed generation cannot
cascade into a worse retry.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

_BAD_PHRASES = (
    "as an ai",
    "i cannot",
    "i can't",
    "lorem ipsum",
    "placeholder",
    "insert here",
    "undefined",
    "null response",
)


def _clean_text(value: Any, *, minimum: int, maximum: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    lowered = text.lower()
    if len(text) < minimum or any(phrase in lowered for phrase in _BAD_PHRASES):
        return ""
    return text[:maximum].rstrip()


def _fallback_milestones(goals: List[str]) -> List[Dict[str, Any]]:
    stages = (
        ("Clarify the next outcome", "Define a concrete result and the support needed to reach it."),
        ("Prepare a workable environment", "Set up tools, accommodations, and a realistic starting routine."),
        ("Take one measurable step", "Complete a small action that creates visible progress toward the goal."),
        ("Review and adjust the plan", "Use the result of the first step to keep, change, or simplify the approach."),
    )
    milestones: List[Dict[str, Any]] = []
    for goal_index, raw_goal in enumerate(goals or ["General wellbeing"]):
        goal = _clean_text(raw_goal, minimum=2, maximum=160) or "General wellbeing"
        for stage_index, (name, description) in enumerate(stages):
            milestones.append({
                "id": f"milestone_quality_{goal_index}_{stage_index}",
                "raceId": f"race_{goal_index}",
                "name": name,
                "description": f"{description} Goal: {goal}",
                "order": stage_index,
                "status": "in_progress" if stage_index == 0 else "not_started",
                "estimatedDays": 7,
                "goal": goal,
                "dimension": "general",
                "dimensionLabel": "General",
                "category": "other",
                "barrierAware": True,
                "strategies": [],
                "recommendedChoices": [],
            })
    return milestones


def _fallback_tasks(milestones: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    tasks: List[Dict[str, Any]] = []
    for milestone in milestones:
        milestone_id = milestone["id"]
        tasks.append({
            "id": f"task_{milestone_id}_quality",
            "milestoneId": milestone_id,
            "name": f"Start: {milestone['name']}",
            "description": "Choose one action that can be completed in the next 20 minutes.",
            "status": "pending",
            "estimatedDuration": 20,
            "difficulty": "easy",
            "priority": "high",
            "helperTricks": ["Make the first action small and observable"],
        })
    return tasks


def ensure_generation_quality(
    response: Dict[str, Any],
    goals: List[str],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Return a repaired path response plus an auditable quality report."""
    source = response if isinstance(response, dict) else {}
    raw_milestones = source.get("milestones")
    milestones: List[Dict[str, Any]] = []
    seen_ids = set()
    seen_names = set()

    for index, raw in enumerate(raw_milestones if isinstance(raw_milestones, list) else []):
        if not isinstance(raw, dict):
            continue
        name = _clean_text(raw.get("name"), minimum=3, maximum=100)
        if not name or name.lower() in seen_names:
            continue
        milestone_id = _clean_text(raw.get("id"), minimum=3, maximum=120) or f"milestone_repaired_{index}"
        if milestone_id in seen_ids:
            milestone_id = f"{milestone_id}_{index}"
        description = _clean_text(raw.get("description"), minimum=12, maximum=500)
        if not description:
            description = f"Take a concrete, manageable step toward {name}."
        try:
            estimated_days = max(1, min(180, int(raw.get("estimatedDays") or 7)))
        except (TypeError, ValueError):
            estimated_days = 7
        repaired = dict(raw)
        repaired.update({
            "id": milestone_id,
            "name": name,
            "description": description,
            "estimatedDays": estimated_days,
        })
        milestones.append(repaired)
        seen_ids.add(milestone_id)
        seen_names.add(name.lower())

    minimum_expected = max(4, 4 * max(1, len(goals)))
    used_fallback = len(milestones) < minimum_expected
    if used_fallback:
        milestones = _fallback_milestones(goals)

    milestone_ids = {milestone["id"] for milestone in milestones}
    raw_tasks = source.get("tasks")
    tasks: List[Dict[str, Any]] = []
    for index, raw in enumerate(raw_tasks if isinstance(raw_tasks, list) else []):
        if not isinstance(raw, dict) or raw.get("milestoneId") not in milestone_ids:
            continue
        name = _clean_text(raw.get("name"), minimum=3, maximum=140)
        if not name:
            continue
        description = _clean_text(raw.get("description"), minimum=8, maximum=500)
        repaired = dict(raw)
        repaired.update({
            "id": _clean_text(raw.get("id"), minimum=3, maximum=160) or f"task_repaired_{index}",
            "name": name,
            "description": description or f"Complete one clear step for {name}.",
        })
        tasks.append(repaired)

    if not tasks or not milestone_ids.issubset({task.get("milestoneId") for task in tasks}):
        tasks = _fallback_tasks(milestones)
        used_fallback = True

    cleaned = dict(source)
    cleaned["milestones"] = milestones
    cleaned["tasks"] = tasks
    cleaned["qualityValidated"] = True
    report = {
        "passed": True,
        "usedFallback": used_fallback,
        "milestoneCount": len(milestones),
        "taskCount": len(tasks),
    }
    cleaned["qualityReport"] = report
    return cleaned, report
