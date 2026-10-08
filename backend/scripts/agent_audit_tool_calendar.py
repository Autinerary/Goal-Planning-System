"""What Tool Recommendation and Calendar Optimization actually produced, and
what exists to judge them by (docs/reports/agent-audit-tool-calendar-2026-10-08.md).

Read-only. Counts and distributions only, no identifiers or text.

Paths are split by era. A path is "legacy" when it has milestones and none
carries nameSource, which commit 064801c added when it replaced the agents'
fixed confidence values; the same rule as user_paths.is_legacy
(feat/legacy-path-flag). Legacy paths hold the old constants (tool 0.78,
calendar 0.82), so mixing them in hides what the agents compute now.

Accounts are split with the Vector deck's classifiers, so "real" means the
same as on the slides.

  python -m scripts.agent_audit_tool_calendar        (from backend/)
"""
from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import match_keys  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

# The calendar's own rule key for each condition, and a rule only that
# condition adds, to tell from rules_applied whether it ran.
CALENDAR_RULES = {"autism": "sensory_breaks", "adhd": "novel_task_boost", "ocd": "clear_end_criteria"}


def summary(values: List[float]) -> str:
    if not values:
        return "none"
    v = sorted(values)
    q = statistics.quantiles(v, n=4) if len(v) > 1 else [v[0]] * 3
    return (f"n={len(v)}  min={v[0]:.2f}  q1={q[0]:.2f}  median={statistics.median(v):.2f}  "
            f"q3={q[2]:.2f}  max={v[-1]:.2f}  distinct={len(set(v))}")


def is_legacy(payload: Dict[str, Any]) -> bool:
    ms = [m for race in payload.get("races") or [] if isinstance(race, dict)
          for m in race.get("milestones") or [] if isinstance(m, dict)]
    return bool(ms) and not any("nameSource" in m for m in ms)


def agent(payload: Dict[str, Any], agent_id: str) -> Dict[str, Any]:
    for a in payload.get("agentResponses") or []:
        if isinstance(a, dict) and a.get("agentId") == agent_id:
            return a
    return {}


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return
    users = list_all_users(sb)
    account = {str(u.id): "synthetic" if is_synthetic(u) else "team" if is_team_test(u) else "real" for u in users}
    persona = {str(u.id) for u in users if str(getattr(u, "email", "") or "").endswith("@test.com")}

    tool_conf, cal_conf = defaultdict(list), defaultdict(list)
    relevance, unique_share, energy_patterns, tasks_per_path = [], [], Counter(), []
    task_energy = Counter()
    has_condition, rule_ran, missed_labels = Counter(), Counter(), Counter()
    rows = fetch_all(sb, "user_paths", "user_id, payload")
    for row in rows:
        p = row.get("payload") or {}
        if isinstance(p, str):
            p = json.loads(p)
        era = "legacy" if is_legacy(p) else "current"
        tool, cal = agent(p, "tool_recommendation"), agent(p, "calendar_optimization")
        if isinstance(tool.get("confidence"), (int, float)):
            tool_conf[era].append(float(tool["confidence"]))
        if isinstance(cal.get("confidence"), (int, float)):
            cal_conf[era].append(float(cal["confidence"]))
        recs = [t for lst in ((tool.get("result") or {}).get("recommendations") or {}).values()
                if isinstance(lst, list) for t in lst if isinstance(t, dict)]
        if era == "current" and recs:
            relevance += [float(t["relevanceScore"]) for t in recs if isinstance(t.get("relevanceScore"), (int, float))]
            unique_share.append(len({t.get("id") for t in recs}) / len(recs))
        days = (cal.get("result") or {}).get("schedule") or []
        energy_patterns[tuple(sorted(Counter(d.get("energyLevel") for d in days).items()))] += 1
        n = 0
        for d in days:
            for _ in d.get("tasks") or []:
                n += 1
                task_energy[d.get("energyLevel")] += 1
        tasks_per_path.append(n)
        barriers = (p.get("userProfile") or {}).get("barrierTypes") or []
        keys = match_keys(barriers)
        rules = (cal.get("result") or {}).get("rules_applied") or {}
        for condition, rule in CALENDAR_RULES.items():
            if condition in keys or (condition in ("autism", "adhd") and "audhd" in keys):
                has_condition[condition] += 1
                if rule in rules:
                    rule_ran[condition] += 1
                else:
                    missed_labels.update(b for b in barriers if condition in match_keys([b]) or
                                         (condition in ("autism", "adhd") and "audhd" in match_keys([b])))

    print(f"== Stored paths: {len(rows)}  "
          f"(legacy {len(tool_conf['legacy'])}, current {len(tool_conf['current'])})")
    print("\n== Tool Recommendation")
    for era in ("legacy", "current"):
        print(f"  confidence, {era:7}: {summary(tool_conf[era])}")
    print(f"  relevanceScore per recommendation, current: {summary(relevance)}")
    print(f"  share of a path's recommendations that are distinct tools: {summary(unique_share)}")
    print("\n== Calendar Optimization")
    for era in ("legacy", "current"):
        print(f"  confidence, {era:7}: {summary(cal_conf[era])}  values {dict(Counter(cal_conf[era]))}")
    print(f"  energy levels per 7-day schedule: {[(dict(k), v) for k, v in energy_patterns.most_common(3)]}")
    print(f"  tasks scheduled per path: {summary(tasks_per_path)}")
    print(f"  task-days by the day's energy level: {dict(task_energy)}")
    for condition in CALENDAR_RULES:
        print(f"  {condition}: {has_condition[condition]} paths for people with it; "
              f"its calendar rules ran on {rule_ran[condition]}")
    print(f"  labels on the paths whose rules did not run: {dict(missed_labels)}")

    print("\n== What exists to judge them by")
    ratings = fetch_all(sb, "ratings", "user_id")
    by = Counter("seed persona (@test.com)" if str(r["user_id"]) in persona
                 else account.get(str(r["user_id"]), "no account") for r in ratings)
    print(f"  ratings: {len(ratings)}  by rater: {dict(by)}")
    for table, column in (("saved_resources", "status"), ("race_progress", "kind")):
        rs = fetch_all(sb, table, f"user_id, {column}")
        real = Counter(r[column] for r in rs if account.get(str(r["user_id"])) == "real")
        print(f"  {table}: {len(rs)}  by {column}: {dict(Counter(r[column] for r in rs))}  real accounts: {dict(real)}")
    tasks = fetch_all(sb, "calendar_tasks", "user_id, source, completed")
    print(f"  calendar_tasks: {len(tasks)}  by source: {dict(Counter(t['source'] for t in tasks))}  "
          f"completed: {sum(1 for t in tasks if t['completed'])}  "
          f"real accounts: {sum(1 for t in tasks if account.get(str(t['user_id'])) == 'real')}")
    for table in ("tool_outcomes", "calendar_outcomes", "reflections"):
        print(f"  {table}: {len(fetch_all(sb, table, '*'))}")
    ctx = fetch_all(sb, "user_latest_context", "recommended_tool_ids, scheduled_buckets")
    print(f"  user_latest_context: {len(ctx)}  with recommended tools recorded: "
          f"{sum(1 for c in ctx if c.get('recommended_tool_ids'))}  "
          f"with scheduled buckets: {sum(1 for c in ctx if c.get('scheduled_buckets'))}")


if __name__ == "__main__":
    main()
