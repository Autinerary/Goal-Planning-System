"""Reflection Analysis, measured on real accounts
(docs/reports/reflection-analysis-2026-10-13.md, item 4).

For real accounts only: how many have any journal entries (reflections) or
milestone ratings, how many of each there are, and for how many the analysis
(core/reflection_analysis.py) returns "no data".

Read-only: it only selects. Each person's rows are read once, in bulk, and
the analysis is the same pure function the app runs. It prints counts, never
ids, emails or anything people typed (journal text is read to compute
concerns, never printed).

The run is logged with core/evaluation_runs.py at the start and the end,
but never through the Supabase client: only to the Postgres named by
EVALUATION_RUNS_DSN, so a run against production writes nothing there.

Accounts are split with the Vector deck's email rules, so "real" means the
same as in the other audits.

  python -m scripts.reflection_analysis_eval        (from backend/)
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

from core import reflection_analysis as ra  # noqa: E402
from core.evaluation_runs import RunLog  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

SCRIPT = "scripts.reflection_analysis_eval"


def by_user(rows: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        out[str(r.get("user_id"))].append(r)
    return out


def safe_fetch(sb, table: str, cols: str) -> List[Dict[str, Any]]:
    try:
        return fetch_all(sb, table, cols)
    except Exception as e:
        print(f"  {table}: unavailable ({str(e)[:80]})")
        return []


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return
    users = list_all_users(sb)
    real = sorted(str(u.id) for u in users if not is_synthetic(u) and not is_team_test(u))
    reflections = by_user(safe_fetch(sb, "reflections", "user_id, context_type, context_id, questions, "
                                                         "free_form_text, reflection_response, created_at"))
    ratings = by_user(safe_fetch(sb, "milestone_ratings", "user_id, path_id, milestone_id, rating, created_at"))
    completions = by_user(safe_fetch(sb, "race_progress", "user_id, milestone_id, kind, completed_at"))
    paths = by_user(safe_fetch(sb, "user_paths", "user_id, path_id, is_active, created_at, payload"))
    adaptations = by_user(safe_fetch(sb, "adaptation_outcomes", "user_id"))

    run_log = RunLog()  # never the Supabase client: EVALUATION_RUNS_DSN or nothing
    run_id = run_log.start(SCRIPT, {
        "analysis_version": ra.VERSION,
        "real_accounts": len(real),
        "rows": {"reflections": sum(len(v) for v in reflections.values()),
                 "milestone_ratings": sum(len(v) for v in ratings.values()),
                 "race_progress": sum(len(v) for v in completions.values()),
                 "user_paths": sum(len(v) for v in paths.values()),
                 "adaptation_outcomes": sum(len(v) for v in adaptations.values())},
        "settings": {"low_rating": ra.LOW_RATING, "weeks": ra.WEEKS, "recent_days": ra.RECENT_DAYS,
                     "min_expected": ra.MIN_EXPECTED},
    })
    print(f"run log: {'run ' + run_id + ' in ' + str(run_log.where) if run_id else 'not logged (EVALUATION_RUNS_DSN not set)'}")

    status, rate_status, outcomes = Counter(), Counter(), Counter()
    have = Counter()
    totals = Counter()
    for uid in real:
        r, g, c = reflections.get(uid, []), ratings.get(uid, []), completions.get(uid, [])
        have["any journal entry"] += bool(r)
        have["any milestone rating"] += bool(g)
        have["either"] += bool(r or g)
        have["a stored path"] += bool(paths.get(uid))
        have["completions, but no entries or ratings"] += bool(c) and not (r or g)
        totals["journal entries"] += len(r)
        totals["milestone ratings"] += len(g)
        totals["completions"] += sum(1 for x in c if (x.get("kind") or "completed") == "completed")
        result = ra.analyze(reflections=r, ratings=g, completions=c, paths=paths.get(uid, []),
                            adaptation_outcomes=len(adaptations.get(uid, [])))
        status[result["status"]] += 1
        if result["status"] == "ok":
            rate_status[result["completion"]["rate_status"]] += 1
            outcomes.update({k: v for k, v in result["outcomes"]["reflections"].items() if v})

    print(f"\n== Real accounts: {len(real)}")
    print(f"  with: {dict(have)}")
    print(f"  rows: {dict(totals)}")
    print(f"  analysis: {dict(status)}  (no data: {status.get('no_data', 0)} of {len(real)})")
    print(f"  completion rate, where there is data: {dict(rate_status)}")
    print(f"  outcomes recorded with journal entries: {dict(outcomes)}")

    run_log.finish()
    print(f"\nrun log: {'finished ' + run_id if run_id else 'not logged'}")


if __name__ == "__main__":
    main()
