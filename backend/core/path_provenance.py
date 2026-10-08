"""Which stored paths carry fixed numbers from the old agents.

Before 064801c (26 August 2026) the agents wrote constants into every path:
path planning's confidence 0.85, calendar optimization's 0.82, pattern
recognition's 0.80, and pattern recognition "patterns" with a made-up
success_rate of 0.82 (and 0.79). Paths generated since compute them.

The same change added `nameSource` to every milestone, so a path none of
whose milestones has it was written by the old code. That is the rule
user_paths.is_legacy uses (STEP 53, 2026_user_paths_is_legacy.sql); this is
the same rule in Python, for scripts that run before the migration is applied
and for checking the column after it is.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

# The fixed values, by agent, for reporting which ones a legacy path carries.
FIXED_CONFIDENCE = {
    "path_planning": 0.85,
    "calendar_optimization": 0.82,
    "pattern_recognition": 0.8,
}
FIXED_PATTERN_SUCCESS_RATE = 0.82


def _payload(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
            return value if isinstance(value, dict) else {}
        except ValueError:
            return {}
    return {}


def _milestones(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    races = payload.get("races") if isinstance(payload.get("races"), list) else []
    return [m for r in races if isinstance(r, dict)
            for m in (r.get("milestones") if isinstance(r.get("milestones"), list) else [])
            if isinstance(m, dict)]


def is_legacy_payload(raw: Any) -> bool:
    """True when the path has milestones and none carries nameSource."""
    milestones = _milestones(_payload(raw))
    return bool(milestones) and not any("nameSource" in m for m in milestones)


def fixed_values(raw: Any) -> List[str]:
    """Which of the old fixed values the path carries (for reporting)."""
    payload = _payload(raw)
    found: List[str] = []
    for response in payload.get("agentResponses") or []:
        if not isinstance(response, dict):
            continue
        agent = response.get("agentId")
        if agent in FIXED_CONFIDENCE and response.get("confidence") == FIXED_CONFIDENCE[agent]:
            found.append(f"{agent} confidence {FIXED_CONFIDENCE[agent]}")
        if agent == "pattern_recognition":
            patterns = (response.get("result") or {}).get("patterns") or []
            if any(isinstance(p, dict) and p.get("success_rate") == FIXED_PATTERN_SUCCESS_RATE for p in patterns):
                found.append(f"pattern_recognition patterns success_rate {FIXED_PATTERN_SUCCESS_RATE}")
    return found
