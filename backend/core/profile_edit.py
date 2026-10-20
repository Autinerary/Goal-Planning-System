"""Change a plan's goals, dreams and obstacles without setting up again.

The team's notes, October 2026: "The 'Your Goals, Dreams & Obstacles' section
should be customizable here [the Race view], so someone doesn't need to
re-do the entire onboarding for this."

  * A renamed goal keeps its race and its milestones (their `goal` follows).
  * A goal taken out is not deleted: it is listed in userProfile.hiddenGoals
    and the app hides it, its race and its steps (frontend/lib/hiddenGoals.ts).
    Adding the same goal again brings them back.
  * A new goal starts with no steps; the Race view offers to build them
    (core/goal_steps.py).
  * Each goal keeps the life area it is under (userProfile.goalCategories),
    so the Race view shows it under that area only.

The same checks as setup (core/guardrails.py) run before anything is saved.
"""
from __future__ import annotations

import copy
from datetime import datetime
from typing import Any, Dict, List, Optional

AREAS = ("education", "career", "relationships", "health", "barrier", "other")
MAX_GOALS = 10
MAX_ITEMS = 10
MAX_GOAL_CHARS = 200
MAX_TEXT_CHARS = 300


class EditError(ValueError):
    """The edit can't be saved; the message says why, for the person."""


def _text(value: Any, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit].strip()


def clean(body: Dict[str, Any]) -> Dict[str, Any]:
    """The edit as the plan will store it, or EditError."""
    goals: List[Dict[str, Optional[str]]] = []
    seen = set()
    for g in body.get("goals") or []:
        text = _text((g or {}).get("text"), MAX_GOAL_CHARS)
        if not text:
            continue
        if text.lower() in seen:
            raise EditError(f"“{text}” is in the list twice.")
        seen.add(text.lower())
        area = (g or {}).get("area")
        goals.append({
            "text": text,
            "from": _text((g or {}).get("from"), 500) or None,
            "area": area if area in AREAS else "other",
        })
    if not goals:
        raise EditError("Keep at least one goal.")
    if len(goals) > MAX_GOALS:
        raise EditError(f"At most {MAX_GOALS} goals.")

    def items(key: str) -> List[str]:
        out: List[str] = []
        for v in body.get(key) or []:
            t = _text(v, MAX_TEXT_CHARS)
            if t and t.lower() not in {o.lower() for o in out}:
                out.append(t)
        if len(out) > MAX_ITEMS:
            raise EditError(f"At most {MAX_ITEMS} {key}.")
        return out

    return {
        "goals": goals,
        "dreams": items("dreams"),
        "obstacles": items("obstacles"),
        "ultimateDream": _text(body.get("ultimateDream"), MAX_TEXT_CHARS),
    }


def _key(s: Any) -> str:
    return str(s or "").strip().lower()


def apply(payload: Dict[str, Any], edit: Dict[str, Any], now: Optional[str] = None) -> Dict[str, Any]:
    """A copy of the plan with the edit applied (see the module docstring)."""
    out = copy.deepcopy(payload)
    profile = dict(out.get("userProfile") or {})
    old_goals = [g for g in profile.get("goals") or [] if isinstance(g, str)]
    old_keys = {_key(g): g for g in old_goals}

    # Renames, matched on the goal as it was; only goals the plan has.
    renames: Dict[str, str] = {}
    kept = set()
    for g in edit["goals"]:
        source = old_keys.get(_key(g.get("from"))) if g.get("from") else None
        if source is not None:
            kept.add(_key(source))
            if source != g["text"]:
                renames[_key(source)] = g["text"]

    new_goals = [g["text"] for g in edit["goals"]]
    new_keys = {_key(g) for g in new_goals}
    hidden = [h for h in profile.get("hiddenGoals") or [] if isinstance(h, str) and _key(h) not in new_keys]
    for g in old_goals:
        if _key(g) not in kept and _key(g) not in new_keys and _key(g) not in {_key(h) for h in hidden}:
            hidden.append(g)

    def renamed(value: Any) -> Any:
        return renames.get(_key(value), value) if isinstance(value, str) else value

    if renames:
        for race in out.get("races") or []:
            if isinstance(race, dict):
                race["name"] = renamed(race.get("name"))
                if "goal" in race:
                    race["goal"] = renamed(race.get("goal"))
                for m in race.get("milestones") or []:
                    if isinstance(m, dict) and "goal" in m:
                        m["goal"] = renamed(m["goal"])
        for response in out.get("agentResponses") or []:
            result = (response or {}).get("result") if isinstance(response, dict) else None
            if response.get("agentId") == "path_planning" and isinstance(result, dict):
                for m in result.get("milestones") or []:
                    if isinstance(m, dict) and "goal" in m:
                        m["goal"] = renamed(m["goal"])
        for m in out.get("milestones") or []:
            if isinstance(m, dict) and "goal" in m:
                m["goal"] = renamed(m["goal"])

    profile.update({
        "goals": new_goals,
        "goalCategories": {g["text"]: g["area"] for g in edit["goals"]},
        "dreams": edit["dreams"],
        "currentChallenges": edit["obstacles"],
        "hiddenGoals": hidden,
        "ultimateDream": edit["ultimateDream"],
        "updatedAt": now or datetime.utcnow().isoformat(),
    })
    out["userProfile"] = profile
    return out


def goals_without_steps(payload: Dict[str, Any]) -> List[str]:
    """The plan's goals with no milestones yet (new ones, added here)."""
    with_steps = set()
    for race in payload.get("races") or []:
        if isinstance(race, dict) and race.get("milestones"):
            with_steps.add(_key(race.get("goal") or race.get("name")))
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning":
            for m in (response.get("result") or {}).get("milestones") or []:
                if isinstance(m, dict):
                    with_steps.add(_key(m.get("goal")))
    goals = (payload.get("userProfile") or {}).get("goals") or []
    return [g for g in goals if isinstance(g, str) and _key(g) not in with_steps]
