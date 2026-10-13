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


if __name__ == "__main__":
    main()
