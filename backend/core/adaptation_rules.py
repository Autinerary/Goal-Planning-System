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

decide() says which rules fire and on what evidence. suggestions() turns each
into one change to one milestone, named by path id and milestone id (ids
repeat across a person's paths), or drops it when it can't name one. Every
change is one the app shows (the step's tasks on its page, the order of steps
on the Path and the race lanes, the "In Progress" status); the plan's day
estimates are shown nowhere, so no change is made to them:

  rule               the milestone                            the change
  stress             the step the journal entry was about     moved later in its part of the plan
  behind_schedule    the earliest step due and not done       lighter: its first 3 tasks kept
  rated_low          the step rated low, not done             moved later in its part of the plan
  ahead_of_schedule  the next step not yet due, not begun     started now

A step gets one suggestion at most, in that order, and three at most are
offered at once. Nothing here changes a stored path: apply() does, and only
when the person accepts (api/routes/adaptations.py).
"""
from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

LOW_COMPLETION = 0.5
POSITIVE_MOMENTUM = 0.8
STRESS_CONCERNS = ("burnout_risk", "sustained_negative_mood")
MAX_OFFERS = 3
PRIORITY = ("stress", "behind_schedule", "rated_low", "ahead_of_schedule")
RATING_LABELS = {1: "Not useful", 2: "A little"}


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


# ---- naming a milestone ------------------------------------------------------------

KEEP_TASKS = 3


def suggestion_id(rule: str, path_id: str, milestone_id: str) -> str:
    """One per rule, path and milestone: once offered, never offered again."""
    return hashlib.sha1(f"{rule}|{path_id}|{milestone_id}".encode()).hexdigest()[:16]


def _day(value: Any) -> str:
    try:
        dt = datetime.fromisoformat(str(value)[:10])
        return f"{dt.day} {dt.strftime('%B')}"
    except ValueError:
        return "recently"


def _race_lists(payload: Any) -> List[List[Dict[str, Any]]]:
    races = payload.get("races") if isinstance(payload, dict) else None
    return [r["milestones"] for r in races or [] if isinstance(r, dict) and isinstance(r.get("milestones"), list)]


def _milestones(payload: Any) -> Dict[str, Dict[str, Any]]:
    return {str(m["id"]): m for lst in _race_lists(payload) for m in lst if isinstance(m, dict) and m.get("id")}


def _lane(m: Dict[str, Any]) -> Tuple[str, str]:
    return (str(m.get("raceId") or ""), str(m.get("dimension") or ""))


def tasks_of(payload: Any, milestone_id: str) -> List[Dict[str, Any]]:
    """A milestone's tasks as its page shows them: its own, else path planning's flat list."""
    m = _milestones(payload).get(str(milestone_id)) or {}
    if isinstance(m.get("tasks"), list) and m["tasks"]:
        return [t for t in m["tasks"] if isinstance(t, dict)]
    for response in (payload or {}).get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning":
            flat = (response.get("result") or {}).get("tasks") or []
            return [t for t in flat if isinstance(t, dict) and str(t.get("milestoneId")) == str(milestone_id)]
    return []


def _later(payload: Any, mid: str) -> bool:
    """Whether a step can move later: it isn't already last in its part of the plan."""
    for lst in _race_lists(payload):
        lane = [x for x in lst if isinstance(x, dict) and x.get("id")]
        for i, x in enumerate(lane):
            if str(x["id"]) == mid:
                return any(_lane(y) == _lane(x) for y in lane[i + 1:])
    return False


def _candidate(decision: Dict[str, Any], analysis: Dict[str, Any], path_id: str,
               payload: Any, done: set) -> Iterable[Tuple[str, Dict, Dict, str, str]]:
    """(milestone_id, change, before, text, reason) for each milestone the rule could name, best first."""
    rule = decision["rule"]
    milestones = _milestones(payload)
    completion = analysis.get("completion") or {}
    same_path = str(completion.get("path_id")) == str(path_id)
    if rule == "behind_schedule" and same_path:
        for mid in completion.get("behind") or []:
            tasks = tasks_of(payload, mid) if str(mid) in milestones and mid not in done else []
            if len(tasks) > KEEP_TASKS:
                aside = tasks[KEEP_TASKS:]
                yield (str(mid), {"keepTasks": KEEP_TASKS},
                       {"tasksSetAside": [{"id": t.get("id"), "name": t.get("name")} for t in aside]},
                       f"This step is taking longer than planned. Make it lighter: keep its first {KEEP_TASKS} "
                       f"tasks and set the other {len(aside)} aside.",
                       f"By your plan's own estimates, {decision.get('due')} steps would be done by now. "
                       f"{decision.get('done')} {'is' if decision.get('done') == 1 else 'are'}.")
    elif rule == "ahead_of_schedule" and same_path:
        mid = completion.get("next_up")
        m = milestones.get(str(mid)) if mid else None
        if m and mid not in done and (m.get("status") or "not_started") == "not_started":
            yield (str(mid), {"status": "in_progress"}, {"status": m.get("status") or "not_started"},
                   "You're ahead of your plan. Start this step now?",
                   f"{decision.get('done')} of the {decision.get('due')} steps due by now are done.")
    elif rule == "rated_low":
        for r in decision.get("ratings") or []:
            mid = str(r.get("milestone_id"))
            if str(r.get("path_id")) != str(path_id) or mid not in milestones or mid in done:
                continue   # another path's step with the same id, or done
            if _later(payload, mid):
                yield (mid, {"moveLater": True}, {},
                       f"You rated this step \u201c{RATING_LABELS.get(int(r['rating']), 'low')}\u201d. "
                       "Move it later, after the other steps in its part of the plan.",
                       f"Your rating on {_day(r.get('rated_at'))}.")
    elif rule == "stress":
        for c in decision.get("concerns") or []:
            mid = str(c.get("context_id") or "")
            if c.get("context_type") != "milestone" or mid not in milestones or mid in done:
                continue   # an entry about the path or the calendar names no step
            if _later(payload, mid):
                yield (mid, {"moveLater": True}, {},
                       "You wrote that things are a lot right now. Move this step later, "
                       "after the other steps in its part of the plan.",
                       f"From your journal entry on {_day(c.get('at'))}.")


def suggestions(analysis: Any, path_payload: Any, path_id: str, done_ids: Iterable[str] = ()) -> List[Dict[str, Any]]:
    """One change to one named milestone per rule that can name one; the rest produce nothing."""
    if not path_id or not isinstance(path_payload, dict):
        return []
    milestones = _milestones(path_payload)
    done = {str(x) for x in done_ids}
    fired = sorted(decide(analysis), key=lambda d: PRIORITY.index(d["rule"]))
    out: List[Dict[str, Any]] = []
    named = set()
    for decision in fired:
        for mid, change, before, text, reason in _candidate(decision, analysis, path_id, path_payload, done):
            if mid in named:
                continue
            named.add(mid)
            out.append({
                "id": suggestion_id(decision["rule"], path_id, mid),
                "rule": decision["rule"],
                "path_id": str(path_id),
                "milestone_id": mid,
                "milestone_name": milestones[mid].get("name") or "This step",
                "change": change,
                "before": before,
                "text": text,
                "reason": reason,
            })
            break
    return out[:MAX_OFFERS]
