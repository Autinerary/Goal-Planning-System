"""Adaptation's rules, on Reflection Analysis's analysis
(docs/reports/adaptation-2026-10-13.md).

Adaptation used to get the wrong part of the reflection analysis and a
completion rate fixed at 0.65, so no rule could fire (8 October audit). The
rules now read the whole analysis (core/reflection_analysis.py), and its
completion rate is computed from the person's stored milestone completions
against their path's own estimates.

When the analysis has no data, nothing fires. When the completion rate is
unknown (fewer than 2 milestones due), the two rules that need it don't
fire: "unknown" is never read as a number.

The rules, with the old agent's thresholds:
  behind_schedule    the completion rate is known and below 0.5
  ahead_of_schedule  the completion rate is known and above 0.8
  rated_low          a milestone rated 2 or less ("Not useful", "A little")
  stress             a burnout or sustained-negative-mood concern in a journal
                     entry of the last 14 days

decide() says which rules fire and on what evidence. It changes nothing and
offers nothing by itself.
"""
from __future__ import annotations

from typing import Any, Dict, List

LOW_COMPLETION = 0.5
POSITIVE_MOMENTUM = 0.8
STRESS_CONCERNS = ("burnout_risk", "sustained_negative_mood")


def decide(analysis: Any) -> List[Dict[str, Any]]:
    """The rules that fire for this analysis, each with its evidence."""
    if not isinstance(analysis, dict) or analysis.get("status") != "ok":
        return []
    fired: List[Dict[str, Any]] = []
    completion = analysis.get("completion") or {}
    rate = completion.get("rate") if completion.get("rate_status") == "known" else None
    if isinstance(rate, (int, float)):
        evidence = {"rate": rate, "due": completion.get("expected_by_now"), "done": completion.get("completed")}
        if rate < LOW_COMPLETION:
            fired.append({"rule": "behind_schedule", **evidence})
        elif rate > POSITIVE_MOMENTUM:
            fired.append({"rule": "ahead_of_schedule", **evidence})
    low = (analysis.get("ratings") or {}).get("low") or []
    if low:
        fired.append({"rule": "rated_low", "ratings": low})
    stress = [c for c in analysis.get("concerns") or [] if c.get("type") in STRESS_CONCERNS]
    if stress:
        fired.append({"rule": "stress", "concerns": stress})
    return fired
