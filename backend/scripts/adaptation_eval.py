"""Adaptation, measured on real accounts (docs/reports/adaptation-2026-10-13.md).

Which of Adaptation's rules can fire on today's data, and for how many real
people each would (core/adaptation_rules.py): run on each person's own
analysis (core/reflection_analysis.py), and named on their active path. And,
labelled as a what-if, how many the rules would reach if the completion rate
alone counted as data, for everyone with a path (it doesn't: the analysis
needs a journal entry or a rating), and how many of those have completed
any step. Then the offers recorded so far, when STEP 73 is applied.

Read-only: it only selects, and nothing is offered, recorded or applied. It
prints counts, never ids, emails or anything people typed.

The run is logged with core/evaluation_runs.py at the start and the end,
never through the Supabase client: only to the Postgres named by
EVALUATION_RUNS_DSN, so a run against production writes nothing there.

  python -m scripts.adaptation_eval        (from backend/)
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

from core import adaptation_rules as rules  # noqa: E402
from core import reflection_analysis as ra  # noqa: E402
from core.evaluation_runs import RunLog  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.reflection_analysis_eval import by_user, safe_fetch  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

SCRIPT = "scripts.adaptation_eval"
RULES = ("behind_schedule", "ahead_of_schedule", "rated_low", "stress")


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
    try:
        offers = fetch_all(sb, "adaptation_outcomes", "user_id, suggestion_id, rule_fired, offered_at, "
                                                      "accepted_at, dismissed_at, helped_first, helped_second")
        offers_note = None
    except Exception:
        offers, offers_note = [], "not recorded yet (STEP 73 and STEP 74 not applied)"
    offer_rows = [o for o in offers if o.get("suggestion_id")]

    run_log = RunLog()  # never the Supabase client: EVALUATION_RUNS_DSN or nothing
    run_id = run_log.start(SCRIPT, {
        "analysis_version": ra.VERSION,
        "real_accounts": len(real),
        "rows": {"reflections": sum(len(v) for v in reflections.values()),
                 "milestone_ratings": sum(len(v) for v in ratings.values()),
                 "race_progress": sum(len(v) for v in completions.values()),
                 "user_paths": sum(len(v) for v in paths.values()),
                 "adaptation_offers": len(offer_rows)},
        "settings": {"low_completion": rules.LOW_COMPLETION, "positive_momentum": rules.POSITIVE_MOMENTUM,
                     "keep_tasks": rules.KEEP_TASKS, "max_offers": rules.MAX_OFFERS, "rules": list(RULES)},
    })
    print(f"run log: {'run ' + run_id + ' in ' + str(run_log.where) if run_id else 'not logged (EVALUATION_RUNS_DSN not set)'}")

    now = datetime.now(timezone.utc)
    fired, named, what_if = Counter(), Counter(), Counter()
    status = Counter()
    for uid in real:
        r, g, c, p = reflections.get(uid, []), ratings.get(uid, []), completions.get(uid, []), paths.get(uid, [])
        analysis = ra.analyze(reflections=r, ratings=g, completions=c, paths=p, now=now)
        status[analysis["status"]] += 1
        fired.update({d["rule"] for d in rules.decide(analysis)})
        active = ra.active_path(p, None)
        if active is not None:
            done = [str(x["milestone_id"]) for x in c if (x.get("kind") or "completed") == "completed"]
            payload = ra._payload(active.get("payload"))
            named.update({s["rule"] for s in rules.suggestions(analysis, payload, str(active.get("path_id")), done)})
            # What-if: the completion rate alone as data. The analysis doesn't allow it.
            if analysis["status"] == "no_data":
                completion = ra.completion_part(active, [x for x in c if (x.get("kind") or "completed") == "completed"], now)
                pretend = {"version": ra.VERSION, "status": "ok", "completion": completion,
                           "ratings": {"low": []}, "concerns": []}
                what_if["(people with a path)"] += 1
                what_if["(rate known)"] += completion["rate_status"] == "known"
                what_if["(with a completed step)"] += completion["completed"] > 0
                what_if["(rate 0)"] += completion["rate"] == 0
                what_if.update({s["rule"] for s in rules.suggestions(pretend, payload, str(active.get("path_id")), done)})

    print(f"\n== Real accounts: {len(real)}; analysis: {dict(status)}")
    print(f"  {'rule':20} {'fires for':>10} {'names a step for':>17}  {'what-if: the rate alone as data':>32}")
    for rule in RULES:
        print(f"  {rule:20} {fired[rule]:>10} {named[rule]:>17}  {what_if[rule]:>32}")
    print(f"  what-if, people with a path and no data: {what_if['(people with a path)']}; rate known "
          f"{what_if['(rate known)']}; rate 0 {what_if['(rate 0)']}; with a completed step on that path "
          f"{what_if['(with a completed step)']}")
    print(f"\n== Offers: {offers_note or str(len(offer_rows)) + ' rows'}"
          + (f"; accepted {sum(1 for o in offer_rows if o.get('accepted_at'))}, "
             f"not now {sum(1 for o in offer_rows if o.get('dismissed_at'))}, "
             f"helped (first) {dict(Counter(o.get('helped_first') for o in offer_rows if o.get('helped_first')))}, "
             f"helped (second) {dict(Counter(o.get('helped_second') for o in offer_rows if o.get('helped_second')))}"
             if offer_rows else ""))

    run_log.finish()
    print(f"\nrun log: {'finished ' + run_id if run_id else 'not logged'}")


if __name__ == "__main__":
    main()
