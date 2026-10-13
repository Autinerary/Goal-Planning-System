"""Calendar Optimization: who its rules reach, what it has to go on, and what
it measures (docs/reports/calendar-optimization-2026-10-13.md).

Read-only: it only selects. It prints counts, never ids, emails or anything
people typed.

Item 0, the condition rules: for each real account with a stored path, the
labels on its latest path, and the rule sets that apply to them,
  * before: the old comparison, the label lowercased with spaces as
    underscores and looked up as a rule key;
  * after: rule_keys, which goes through condition_taxonomy.match_keys, the
    canonicalisation Pattern Recognition's live filter uses;
  * and which rule sets ran when that path was generated (rules_applied).

Item 1, the per-person signals stored that could set someone's energy, for
real accounts: profiles.preferences (key names and the reminder time and
setup energy values), life_stats check-ins (mood) and snapshots (an energy
score inferred from activity), calendar_tasks (the energy view chosen when a
task was added: the view starts at 'average', so only 'worst' or 'best' is a
choice), setup_energy events, calendar_outcomes, milestone ratings and
reflections. Names of keys and counts only.

Accounts are split with the Vector deck's email rules, so "real" means the
same as in the other audits.

  python -m scripts.calendar_audit        (from backend/)
"""
from __future__ import annotations

import json
from collections import Counter
from typing import Any, Callable, Dict, List

from dotenv import load_dotenv

load_dotenv()

from core.agents.calendar_optimization_agent import rule_keys  # noqa: E402
from core.condition_taxonomy import match_keys  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

RULES = ("autism", "adhd", "ocd", "bipolar")
# A flag each rule set adds and no other does, to read from rules_applied.
SIGNATURE = {"autism": "sensory_breaks", "adhd": "novel_task_boost", "ocd": "clear_end_criteria",
             "bipolar": "mood_check_ins"}


def old_rule_keys(barriers: Any) -> List[str]:
    """The comparison the agent made until now."""
    keys = [str(b).lower().replace(" ", "_") for b in barriers or []]
    return [k for k in dict.fromkeys(keys) if k in RULES]


def payload_of(row: Dict[str, Any]) -> Dict[str, Any]:
    p = row.get("payload") or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except ValueError:
            p = {}
    return p if isinstance(p, dict) else {}


def calendar_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "calendar_optimization":
            result = response.get("result")
            return result if isinstance(result, dict) else {}
    return {}


def accounts(sb) -> Callable[[Any], str]:
    users = list_all_users(sb)
    kind = {str(u.id): "synthetic" if is_synthetic(u) else "team" if is_team_test(u) else "real" for u in users}
    return lambda uid: kind.get(str(uid), "no account")


def latest_paths(rows: List[Dict[str, Any]], account: Callable[[Any], str], who: str = "real") -> List[Dict[str, Any]]:
    latest: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        if account(r["user_id"]) != who:
            continue
        uid = str(r["user_id"])
        if uid not in latest or str(r.get("created_at")) > str(latest[uid].get("created_at")):
            latest[uid] = r
    return list(latest.values())


def item0(rows: List[Dict[str, Any]], account: Callable[[Any], str]) -> Dict[str, Any]:
    print("\n== Item 0: who the condition rules reach (real accounts, latest path each)")
    people = latest_paths(rows, account)
    print(f"  real accounts with a stored path: {len(people)}")
    has, before, after, ran = Counter(), Counter(), Counter(), Counter()
    for r in people:
        labels = (payload_of(r).get("userProfile") or {}).get("barrierTypes") or []
        keys = match_keys(labels)
        for condition in RULES:
            if condition in keys or (condition in ("autism", "adhd") and "audhd" in keys):
                has[condition] += 1
        before.update(old_rule_keys(labels))
        after.update(rule_keys(labels))
        applied = calendar_result(payload_of(r)).get("rules_applied") or {}
        ran.update(rule for rule, flag in SIGNATURE.items() if applied.get(flag))
    print(f"  {'rule':8} {'has it':>7} {'before':>7} {'after':>7} {'ran at generation':>18}")
    for rule in RULES:
        print(f"  {rule:8} {has[rule]:>7} {before[rule]:>7} {after[rule]:>7} {ran[rule]:>18}")
    # The 8 October audit counted paths of every account; the same here, to compare.
    p_has, p_before, p_after = Counter(), Counter(), Counter()
    for r in rows:
        labels = (payload_of(r).get("userProfile") or {}).get("barrierTypes") or []
        keys = match_keys(labels)
        for condition in RULES:
            if condition in keys or (condition in ("autism", "adhd") and "audhd" in keys):
                p_has[condition] += 1
        p_before.update(old_rule_keys(labels))
        p_after.update(rule_keys(labels))
    print(f"  every stored path, all accounts ({len(rows)}):")
    for rule in RULES:
        print(f"    {rule:8} has it {p_has[rule]:>3}  before {p_before[rule]:>3}  after {p_after[rule]:>3}")
    return {"people": len(people), "has": dict(has), "before": dict(before), "after": dict(after), "ran": dict(ran)}


def count_rows(sb, table: str) -> int:
    try:
        return sb.table(table).select("*", count="exact").limit(1).execute().count or 0
    except Exception:
        return -1


def item1(sb, account: Callable[[Any], str]) -> Dict[str, Any]:
    print("\n== Item 1: per-person signals stored (real accounts)")
    out: Dict[str, Any] = {}
    profiles = fetch_all(sb, "profiles", "id, preferences")
    real = [p for p in profiles if account(p["id"]) == "real"]
    prefs = [p.get("preferences") if isinstance(p.get("preferences"), dict) else {} for p in real]
    print(f"  profiles of real accounts: {len(real)}; with any preferences: {sum(1 for x in prefs if x)}")
    print(f"    preference keys, by how many real accounts have them: "
          f"{dict(Counter(k for x in prefs for k in x).most_common())}")
    times = Counter(str((x.get('reminders') or {}).get('time')) for x in prefs
                    if isinstance(x.get('reminders'), dict) and (x['reminders'].get('enabled') or x['reminders'].get('time')))
    print(f"    reminder time (when they want reminders, not their energy): {dict(times)}")
    print(f"    setup energy (one answer, about the day of setup): "
          f"{dict(Counter(x.get('setupEnergy') for x in prefs if x.get('setupEnergy')))}")
    out["reminder_times"] = dict(times)
    # Who sees the weekday's energy at all: the Path's guide picks the fast or
    # the slow animal from it when the person chose two (lib/spiritAnimal.ts).
    print(f"    guide mode (fastSlow uses the schedule's energy): "
          f"{dict(Counter(str(x.get('spiritAnimalMode')) for x in prefs if x.get('spiritAnimalMode')))}")

    checkins = fetch_all(sb, "life_stats_checkins", "user_id, mood")
    snapshots = fetch_all(sb, "life_stats_snapshots", "user_id, energy")
    for label, rows in (("life_stats_checkins (mood 1-10, self-reported)", checkins),
                        ("life_stats_snapshots (energy inferred from activity, not reported)", snapshots)):
        mine = [r for r in rows if account(r["user_id"]) == "real"]
        print(f"  {label}: {len(rows)} rows; real accounts {len({r['user_id'] for r in mine})}, rows {len(mine)}")
    tasks = fetch_all(sb, "calendar_tasks", "user_id, source, scenario, time, day")
    mine = [t for t in tasks if account(t["user_id"]) == "real"]
    chosen = [t for t in mine if t.get("scenario") in ("worst", "best")]
    print(f"  calendar_tasks: {len(tasks)}; real accounts {len({t['user_id'] for t in mine})}, rows {len(mine)}; "
          f"scenario: {dict(Counter(t.get('scenario') for t in mine))}; "
          f"an energy chosen ('worst' or 'best'): {len(chosen)} rows, {len({t['user_id'] for t in chosen})} people")
    events = (sb.table("onboarding_events").select("user_id, onboarding_version").eq("event", "setup_energy")
              .limit(5000).execute().data or [])
    events = [e for e in events if not str(e.get("onboarding_version") or "").startswith("qa")]
    print(f"  setup_energy events: {len(events)}; real accounts {len({e['user_id'] for e in events if e.get('user_id') and account(e['user_id']) == 'real'})}")
    for table in ("calendar_outcomes", "milestone_ratings", "reflections"):
        print(f"  {table}: {count_rows(sb, table)}")
    out.update({"chosen_energy_people": len({t['user_id'] for t in chosen}), "checkins": len(checkins)})
    return out


def item2(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    print("\n== Item 2: the confidence stored with each schedule")
    out: Dict[str, Any] = {}
    for label, keep in (("current", lambda r: not r.get("is_legacy")), ("legacy", lambda r: bool(r.get("is_legacy")))):
        values, days_with_work, no_explanation = Counter(), Counter(), 0
        for r in rows:
            if not keep(r):
                continue
            p = payload_of(r)
            response = next((a for a in p.get("agentResponses") or []
                             if isinstance(a, dict) and a.get("agentId") == "calendar_optimization"), {})
            values[response.get("confidence")] += 1
            result = calendar_result(p)
            days = result.get("schedule") or []
            days_with_work[(sum(1 for d in days if d.get("tasks")), len(days))] += 1
            no_explanation += not str(result.get("explanation") or "").strip()
        print(f"  {label}: confidence values {dict(values)}; (days with work, days) {dict(days_with_work)}; "
              f"without an explanation (when the banner would show the confidence): {no_explanation}")
        out[label] = {str(k): v for k, v in values.items()}
    return out


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return
    account = accounts(sb)
    rows = fetch_all(sb, "user_paths", "user_id, path_id, is_legacy, created_at, payload")
    print(f"== Stored paths: {len(rows)}  legacy {sum(1 for r in rows if r.get('is_legacy'))}  "
          f"by account: {dict(Counter(account(r['user_id']) for r in rows))}")
    item0(rows, account)
    item1(sb, account)
    item2(rows)


if __name__ == "__main__":
    main()
