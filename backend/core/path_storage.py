"""Tasks stored with their milestone, and adaptations applied where the app reads.

A generated path is stored as one JSON payload (user_paths.payload). Until now
the tasks were stored only once, as a flat list inside path planning's raw
agent response (agentResponses[path_planning].result.tasks), linked to their
milestone by `milestoneId`; the milestones the app shows (payload.races[]
.milestones) carried none. And an adaptation wrote its updated milestones and
tasks to top-level payload.milestones / payload.tasks, which nothing reads for
tasks, and which the milestones page and calendar read *before* the real
milestones, so an adaptation would have replaced the plan they show.

Here:
  * attach_tasks gives each race milestone its own `tasks` (a copy of its
    entries from the flat list, which stays for the pages that read it).
  * apply_adaptation merges updates into the milestones and tasks the app
    reads, and only for milestones that exist in the path. Anything else (the
    adaptation agent currently returns placeholders like 'updated_milestone_1')
    is ignored and counted, never written.

The `tasks` table from the original schema (database/schema.sql) is not used:
its milestone_id is a uuid referencing a `milestones` table that, like
`races`, `paths` and `users`, nothing writes to (all 0 rows on 8 Oct 2026),
while real milestone ids are strings such as 'milestone_g0_education_0'.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional, Tuple

# Fields an adaptation may change on a milestone. Ids, race links and
# provenance stay as generated.
ADAPTABLE_FIELDS = ("name", "description", "status", "estimatedDays", "strategies", "order")


def tasks_by_milestone(tasks: Any) -> Dict[str, List[Dict[str, Any]]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for task in tasks if isinstance(tasks, list) else []:
        if isinstance(task, dict) and isinstance(task.get("milestoneId"), str):
            grouped.setdefault(task["milestoneId"], []).append(task)
    return grouped


def attach_tasks(milestones: List[Dict[str, Any]], tasks: Any) -> List[Dict[str, Any]]:
    """Copies of the milestones, each carrying its own tasks."""
    grouped = tasks_by_milestone(tasks)
    return [dict(m, tasks=grouped.get(m.get("id"), [])) for m in milestones if isinstance(m, dict)]


def _race_milestones(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    races = payload.get("races") if isinstance(payload.get("races"), list) else []
    return [m for r in races if isinstance(r, dict)
            for m in (r.get("milestones") if isinstance(r.get("milestones"), list) else [])
            if isinstance(m, dict)]


def _path_planning_result(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Path planning's stored result (the dict inside the payload), if any."""
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning":
            result = response.get("result")
            if isinstance(result, dict):
                return result
    return None


def apply_adaptation(
    payload: Dict[str, Any],
    updated_milestones: Any,
    updated_tasks: Any,
) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """The payload with the adaptation merged in, and what was applied.

    Updates go to every copy the app reads: the race milestones (with their
    tasks), path planning's milestones and its flat task list.
    """
    out = copy.deepcopy(payload)
    race_ms = _race_milestones(out)
    result = _path_planning_result(out)
    agent_ms = [m for m in ((result or {}).get("milestones") or []) if isinstance(m, dict)]
    known = {m.get("id") for m in race_ms} | {m.get("id") for m in agent_ms}
    known.discard(None)
    counts = {"milestones_applied": 0, "tasks_applied": 0, "ignored": 0}

    for update in updated_milestones if isinstance(updated_milestones, list) else []:
        if not isinstance(update, dict) or update.get("id") not in known:
            counts["ignored"] += 1
            continue
        changes = {k: update[k] for k in ADAPTABLE_FIELDS if k in update}
        for m in race_ms + agent_ms:
            if m.get("id") == update["id"]:
                m.update(changes)
        counts["milestones_applied"] += 1

    new_tasks = tasks_by_milestone([t for t in (updated_tasks if isinstance(updated_tasks, list) else [])
                                    if isinstance(t, dict) and t.get("milestoneId") in known])
    counts["ignored"] += sum(1 for t in (updated_tasks if isinstance(updated_tasks, list) else [])
                             if not (isinstance(t, dict) and t.get("milestoneId") in known))
    if new_tasks:
        for m in race_ms:
            if m.get("id") in new_tasks:
                m["tasks"] = new_tasks[m["id"]]
        if result is not None:
            flat = [t for t in (result.get("tasks") or [])
                    if not (isinstance(t, dict) and t.get("milestoneId") in new_tasks)]
            for tasks in new_tasks.values():
                flat.extend(tasks)
            result["tasks"] = flat
        counts["tasks_applied"] = sum(len(v) for v in new_tasks.values())
    return out, counts
