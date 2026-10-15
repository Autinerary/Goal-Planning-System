"""Tool Recommendation: what it recommends from, and what stored paths point at
(docs/reports/tool-recommendation-2026-10-13.md).

Read-only: it only selects. It prints counts and distributions, never ids,
emails or anything people typed.

Item 0, the pool:
  * the resource directory (ResourceHub's `resources`) by status;
  * the pool the agent draws from today: the same query the agent runs
    (status 'approved', at most 500 rows, in no order), without Autinerary's
    own listing, and the first 60 of it, which are all the LLM scores;
  * every recommendation stored in a path (agentResponses[tool_recommendation]
    .result.recommendations, per milestone, and its pit stop shelf), by the
    status its resource has now. Current paths store ResourceHub ids
    ('sh_<uuid>'); legacy paths store ids from the old built-in catalogue
    ('svc_...'), which are not ResourceHub rows.

Item 1, the baseline (current paths, real accounts only, unless it says):
  * paths with at least one recommendation, and recommendations per path;
  * concentration: the share of all recommendations taken by the 5 items
    recommended most;
  * relevance proxy: the share of recommendations whose resource category
    serves one of the person's normalised conditions. Conditions come from
    the path's barrierTypes through core/condition_taxonomy.py; each broad
    category of condition is served by the resource categories in SERVES
    (below). A resource category is compared lowercased, with spaces as
    underscores. Recommendations for people with no normalised condition
    are counted apart. Read literally, "a category that names a condition"
    matches nothing: no ResourceHub category names one;
  * the agent's confidence, for current and legacy paths apart.

Item 2, the ratings it reads: the `ratings` table by rater (seed personas
apart from other team accounts), by the status of the rated resource, by
which form most likely wrote the row (ResourceHub's form records the rater's
conditions; the app's Milestone View writes only a score), and how many
ratings fall on the resources in today's pool.

Item 4, the run log: core/evaluation_runs.py is called at the start and the
end, but never with the Supabase client, so it writes only to the Postgres
named by EVALUATION_RUNS_DSN (a run against production writes nothing
there); without it the run isn't logged, and says so. It records counts and
hashes only: recommendations, how many point at approved items, the is_legacy
rows excluded, the condition map's hash and the real feedback answers. No
user ids, emails or free text.

Accounts are split with the Vector deck's email rules, so "real" means the
same as in the other audits.

  python -m scripts.tool_rec_audit        (from backend/)
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

import hashlib  # noqa: E402
import statistics  # noqa: E402

from core.evaluation_runs import RunLog  # noqa: E402

from core.agents.tool_recommendation_agent import is_self_listing  # noqa: E402
from core.condition_taxonomy import TAXONOMY_VERSION, normalize_conditions  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

POOL_LIMIT = 500      # _fetch_resource_pool's .limit(500)
LLM_SCORED = 60       # _barrier_fit_scores scores pool[:60]; the rest get 0.5

# Item 1's relevance proxy: which resource categories serve each broad
# category of condition in core/condition_taxonomy.py. A judgement, kept
# deliberately narrow: a service or organisation for that kind of need. Parks,
# recreation, stores, books and apps serve everyone and count for no one.
_HEALTH = {"therapist", "doctor", "support_group", "organization"}
SERVES: Dict[str, set] = {
    "neurodevelopmental": _HEALTH | {"school"},
    "learning": _HEALTH | {"school"},
    "intellectual_developmental": _HEALTH | {"school"},
    "communication": _HEALTH | {"school"},
    "sensory_processing": _HEALTH,
    "mental_health": _HEALTH,
    "sensory_disability": _HEALTH,
    "physical": _HEALTH,
    "chronic_health": _HEALTH,
    "socioeconomic": {"food_support", "social_services", "supported_housing", "shelter", "employment", "organization"},
    "language": {"community_center", "school", "social_services", "organization"},
    "identity": {"support_group", "community_center", "organization"},
}


def payload_of(row: Dict[str, Any]) -> Dict[str, Any]:
    p = row.get("payload") or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except ValueError:
            p = {}
    return p if isinstance(p, dict) else {}


def agent_result(payload: Dict[str, Any], agent_id: str) -> Dict[str, Any]:
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == agent_id:
            result = response.get("result")
            return result if isinstance(result, dict) else {}
    return {}


def agent_confidence(payload: Dict[str, Any], agent_id: str) -> Optional[float]:
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == agent_id:
            c = response.get("confidence")
            return float(c) if isinstance(c, (int, float)) else None
    return None


def stored_recommendations(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Every per-milestone recommendation in a stored path."""
    recs = agent_result(payload, "tool_recommendation").get("recommendations")
    if not isinstance(recs, dict):
        return []
    return [t for lst in recs.values() if isinstance(lst, list) for t in lst if isinstance(t, dict)]


def stored_pit_stop(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    shelf = agent_result(payload, "tool_recommendation").get("pit_stop_tools")
    if not isinstance(shelf, dict):
        return []
    return [t for lst in shelf.values() if isinstance(lst, list) for t in lst if isinstance(t, dict)]


def resource_id(tool: Dict[str, Any]) -> Optional[str]:
    """The ResourceHub id a stored recommendation points at, or None."""
    rid = tool.get("resourceId")
    if rid:
        return str(rid)
    tid = str(tool.get("id") or "")
    return tid[3:] if tid.startswith("sh_") else None


def status_of(tool: Dict[str, Any], statuses: Dict[str, str]) -> str:
    rid = resource_id(tool)
    if rid is None:
        return "not a ResourceHub resource (old built-in list)"
    return statuses.get(rid, "no longer in the directory")


def accounts(sb) -> Callable[[Any], str]:
    users = list_all_users(sb)
    kind = {str(u.id): "synthetic" if is_synthetic(u) else "team" if is_team_test(u) else "real" for u in users}
    persona = {str(u.id) for u in users if str(getattr(u, "email", "") or "").lower().endswith("@test.com")}

    def account(uid: Any, personas: bool = False) -> str:
        if personas and str(uid) in persona:
            return "seed persona (@test.com)"
        return kind.get(str(uid), "no account")
    return account


def item0(sb, rows: List[Dict[str, Any]], account: Callable[[Any], str]) -> Dict[str, Any]:
    print("\n== Item 0: what it recommends from")
    resources = fetch_all(sb, "resources", "id, status, source_type, category, created_at, name, is_first_party")
    statuses = {str(r["id"]): r["status"] for r in resources}
    by_status = Counter(r["status"] for r in resources)
    print(f"  resources: {len(resources)}  by status: {dict(by_status)}")
    print(f"  by status and source: {dict(Counter((r['status'], r['source_type']) for r in resources))}")
    print(f"  by status and day created: {dict(Counter((r['status'], str(r['created_at'])[:10]) for r in resources))}")
    approved_self = sum(1 for r in resources if r["status"] == "approved" and is_self_listing(r))
    print(f"  approved rows that are Autinerary's own listing (left out of the pool): {approved_self}")

    # The pool, exactly as the agent queries it.
    pool = (sb.table("resources").select("id, name, category, source_type, created_at, is_first_party")
            .eq("status", "approved").limit(POOL_LIMIT).execute().data or [])
    pool = [r for r in pool if not is_self_listing(r)]
    print(f"  the agent's pool today: {len(pool)} of {by_status.get('approved', 0)} approved rows "
          f"(.limit({POOL_LIMIT}), no order)")
    print(f"    by category: {dict(Counter(r['category'] for r in pool).most_common())}")
    print(f"    by source: {dict(Counter(r['source_type'] for r in pool))}  "
          f"created: {dict(Counter(str(r['created_at'])[:10] for r in pool))}")
    print(f"    the first {LLM_SCORED}, the only ones the LLM scores, by category: "
          f"{dict(Counter(r['category'] for r in pool[:LLM_SCORED]).most_common())}")

    out: Dict[str, Any] = {"resources": dict(by_status), "pool": len(pool)}
    for label, keep in (("current paths (is_legacy = false)", lambda r: not r.get("is_legacy")),
                        ("legacy paths", lambda r: bool(r.get("is_legacy")))):
        sel = [r for r in rows if keep(r)]
        recs = [(account(r["user_id"]), t) for r in sel for t in stored_recommendations(payload_of(r))]
        shelf = [(account(r["user_id"]), t) for r in sel for t in stored_pit_stop(payload_of(r))]
        print(f"  {label}: {len(sel)}")
        print(f"    per-milestone recommendations: {len(recs)}  by the status of what they point at: "
              f"{dict(Counter(status_of(t, statuses) for _, t in recs))}")
        print(f"      real accounts only: {dict(Counter(status_of(t, statuses) for who, t in recs if who == 'real'))}")
        print(f"      distinct items: {len({resource_id(t) or t.get('id') for _, t in recs})}")
        print(f"    pit stop shelf: {len(shelf)}  {dict(Counter(status_of(t, statuses) for _, t in shelf))}")
        rejected = Counter(resource_id(t) for _, t in recs if status_of(t, statuses) == "rejected")
        print(f"    recommendations of rejected rows: {sum(rejected.values())}, "
              f"to {len(rejected)} distinct rows, in {sum(1 for r in sel if any(status_of(t, statuses) == 'rejected' for t in stored_recommendations(payload_of(r))))} paths")
        # When the pool changed: each path's day, by what its recommendations point at.
        days = Counter()
        for r in sel:
            kinds = {status_of(t, statuses) for t in stored_recommendations(payload_of(r))}
            days[(str(r.get("created_at"))[:10], "+".join(sorted(kinds)) or "none")] += 1
        print(f"    paths by day generated and what they point at: {dict(sorted(days.items()))}")
        out[label] = dict(Counter(status_of(t, statuses) for _, t in recs))
    return out


def category_key(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def condition_categories(payload: Dict[str, Any]) -> set:
    """The broad categories of the person's normalised conditions."""
    conditions, _counts = normalize_conditions((payload.get("userProfile") or {}).get("barrierTypes") or [])
    return {c.category for c in conditions}


def serves(tool: Dict[str, Any], categories: set) -> bool:
    return any(category_key(tool.get("category")) in SERVES.get(c, set()) for c in categories)


def summary(values: List[float], digits: int = 2) -> str:
    if not values:
        return "none"
    v = sorted(values)
    f = f"{{:.{digits}f}}"
    return (f"n={len(v)}  mean={f.format(statistics.mean(v))}  median={f.format(statistics.median(v))}  "
            f"min={f.format(v[0])}  max={f.format(v[-1])}")


def item1(sb, rows: List[Dict[str, Any]], account: Callable[[Any], str]) -> Dict[str, Any]:
    print("\n== Item 1: baseline (current paths, real accounts)")
    statuses = {str(r["id"]): r["status"] for r in fetch_all(sb, "resources", "id, status")}
    names = {str(r["id"]): r["name"] for r in fetch_all(sb, "resources", "id, name")}
    current = [r for r in rows if not r.get("is_legacy") and account(r["user_id"]) == "real"]
    per_path = [len(stored_recommendations(payload_of(r))) for r in current]
    with_any = sum(1 for n in per_path if n > 0)
    print(f"  paths: {len(current)}; with at least one recommendation: {with_any} ({with_any / len(current):.0%})")
    print(f"  recommendations per path: {summary([float(n) for n in per_path], 1)}")

    items = Counter()
    proxy = Counter()
    for r in current:
        p = payload_of(r)
        cats = condition_categories(p)
        for t in stored_recommendations(p):
            items[resource_id(t) or str(t.get("id"))] += 1
            if not cats:
                proxy["person has no normalised condition"] += 1
            else:
                proxy["serves a condition" if serves(t, cats) else "doesn't"] += 1
                literal = {c.key for c in normalize_conditions((p.get("userProfile") or {}).get("barrierTypes") or [])[0]}
                proxy["category names a condition (literal)"] += any(k.replace("_", " ") in category_key(t.get("category")).replace("_", " ") for k in literal)
    total = sum(items.values())
    top = items.most_common(5)
    print(f"  recommendations: {total}, to {len(items)} distinct items")
    print(f"  top 5 items take {sum(n for _, n in top)} ({sum(n for _, n in top) / total:.0%}); the top one {top[0][1] / total:.0%}" if total else "  no recommendations")
    for rid, n in top:
        print(f"    {n:5}  {names.get(rid, rid)!r} ({statuses.get(rid, 'not in the directory')})")
    judged = proxy["serves a condition"] + proxy["doesn't"]
    print(f"  relevance proxy: {dict(proxy)}; serves a condition: "
          f"{proxy['serves a condition'] / judged:.0%} of {judged}" if judged else f"  relevance proxy: {dict(proxy)}")
    by_category = Counter(category_key(t.get("category")) for r in current for t in stored_recommendations(payload_of(r)))
    print(f"  recommendations by resource category: {dict(by_category.most_common())}")
    print(f"  people's condition categories (paths): "
          f"{dict(Counter(c for r in current for c in condition_categories(payload_of(r))).most_common())}")

    out: Dict[str, Any] = {"paths": len(current), "with_any": with_any, "per_path": per_path,
                           "top5_share": round(sum(n for _, n in top) / total, 3) if total else None,
                           "relevance": dict(proxy)}
    for label, keep in (("current", lambda r: not r.get("is_legacy")), ("legacy", lambda r: bool(r.get("is_legacy")))):
        for who in ("real", "all"):
            conf = [c for r in rows if keep(r) and (who == "all" or account(r["user_id"]) == "real")
                    if (c := agent_confidence(payload_of(r), "tool_recommendation")) is not None]
            q = statistics.quantiles(conf, n=4) if len(conf) > 1 else [None] * 3
            buckets = Counter("0" if c == 0 else "0.01-0.2" if c <= 0.2 else "0.2-0.4" if c <= 0.4
                              else "0.4-0.6" if c <= 0.6 else "0.6-0.8" if c <= 0.8 else "0.8-1" for c in conf)
            print(f"  confidence, {label} paths, {who} accounts: {summary(conf)}  "
                  f"q1={q[0] if q[0] is None else round(q[0], 2)} q3={q[2] if q[2] is None else round(q[2], 2)}  "
                  f"distinct={len(set(conf))}  by range: {dict(sorted(buckets.items()))}")
            out[f"confidence_{label}_{who}"] = conf
    return out


def filled(value: Any) -> bool:
    return bool(value) and value not in ({}, [], "")


def item2(sb, account: Callable[..., str]) -> Dict[str, Any]:
    print("\n== Item 2: the ratings it reads")
    ratings = fetch_all(sb, "ratings", "user_id, resource_id, overall_score, barrier_scores, comment, "
                                      "rater_diagnostics, rater_relationships, created_at")
    statuses = {str(r["id"]): r["status"] for r in fetch_all(sb, "resources", "id, status")}
    who = Counter(account(r["user_id"], personas=True) for r in ratings)
    print(f"  ratings: {len(ratings)}  by rater: {dict(who)}")
    print(f"  raters: {len({r['user_id'] for r in ratings})}; resources rated: {len({r['resource_id'] for r in ratings})}")
    print(f"  by the rated resource's status now: {dict(Counter(statuses.get(str(r['resource_id']), 'not in the directory') for r in ratings))}")
    for r in ratings:
        r["_form"] = ("ResourceHub's form (rater's conditions or barrier scores recorded)"
                      if filled(r.get("rater_diagnostics")) or filled(r.get("barrier_scores")) or filled(r.get("rater_relationships"))
                      else "a score only (the app's Milestone View, or ResourceHub with nothing else)")
    print(f"  by the form that most likely wrote it: {dict(Counter(r['_form'] for r in ratings))}")
    real = [r for r in ratings if account(r["user_id"]) == "real"]
    print(f"  real accounts: {len(real)}  scores: {dict(Counter(r['overall_score'] for r in real))}  "
          f"rated resource now: {dict(Counter(statuses.get(str(r['resource_id']), 'not in the directory') for r in real))}  "
          f"form: {dict(Counter(r['_form'] for r in real))}  written: {sorted(str(r['created_at'])[:10] for r in real)}")
    print(f"  with a comment: {sum(1 for r in ratings if filled(r.get('comment')))}")
    pool = (sb.table("resources").select("id, name, is_first_party").eq("status", "approved")
            .limit(POOL_LIMIT).execute().data or [])
    pool_ids = {str(r["id"]) for r in pool if not is_self_listing(r)}
    on_pool = [r for r in ratings if str(r["resource_id"]) in pool_ids]
    on_approved = [r for r in ratings if statuses.get(str(r["resource_id"])) == "approved"]
    print(f"  ratings on approved resources: {len(on_approved)}; on today's pool: {len(on_pool)}")
    saved = fetch_all(sb, "saved_resources", "user_id, resource_id, status")
    print(f"  saved_resources: {len(saved)}  by account: {dict(Counter(account(x['user_id'], personas=True) for x in saved))}  "
          f"resource now: {dict(Counter(statuses.get(str(x['resource_id']), 'not in the directory') for x in saved))}")
    print(f"  tool_outcomes: {len(fetch_all(sb, 'tool_outcomes', '*'))}")
    return {"ratings": len(ratings), "real": len(real), "by_rater": dict(who),
            "on_pool": len(on_pool), "on_approved": len(on_approved)}


SCRIPT = "scripts.tool_rec_audit"


def run_inputs(rows: List[Dict[str, Any]], statuses: Dict[str, str], ratings: List[Dict[str, Any]],
               account: Callable[..., str]) -> Dict[str, Any]:
    """What decides this run's result, for evaluation_runs. Counts and hashes only."""
    current = [r for r in rows if not r.get("is_legacy")]
    recs = [t for r in current for t in stored_recommendations(payload_of(r))]
    real_ratings = [r for r in ratings if account(r["user_id"]) == "real"]
    return {
        "paths": len(rows),
        "is_legacy_excluded": len(rows) - len(current),
        "recommendations": {
            "current": len(recs),
            "current_real_accounts": sum(len(stored_recommendations(payload_of(r))) for r in current
                                         if account(r["user_id"]) == "real"),
            "legacy": sum(len(stored_recommendations(payload_of(r))) for r in rows if r.get("is_legacy")),
        },
        "point_at_approved": sum(1 for t in recs if status_of(t, statuses) == "approved"),
        "point_at": dict(Counter(status_of(t, statuses) for t in recs)),
        "resources": dict(Counter(statuses.values())),
        "condition_map_hash": TAXONOMY_VERSION,
        "real_feedback_answers": {
            "ratings": len(real_ratings),
            "scores": dict(Counter(str(r.get("overall_score")) for r in real_ratings)),
        },
        "settings": {
            "pool_limit": POOL_LIMIT, "llm_scored": LLM_SCORED,
            "relevance_map_hash": hashlib.sha1(json.dumps(
                {k: sorted(v) for k, v in sorted(SERVES.items())}).encode()).hexdigest()[:12],
        },
    }


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return
    account = accounts(sb)
    rows = fetch_all(sb, "user_paths", "user_id, path_id, is_legacy, created_at, payload")
    statuses = {str(r["id"]): r["status"] for r in fetch_all(sb, "resources", "id, status")}
    ratings = fetch_all(sb, "ratings", "user_id, overall_score")
    run_log = RunLog()  # never the Supabase client: EVALUATION_RUNS_DSN or nothing
    run_id = run_log.start(SCRIPT, run_inputs(rows, statuses, ratings, account))
    print(f"run log: {'run ' + run_id + ' in ' + str(run_log.where) if run_id else 'not logged (EVALUATION_RUNS_DSN not set)'}")
    print(f"== Stored paths: {len(rows)}  legacy {sum(1 for r in rows if r.get('is_legacy'))}  "
          f"by account: {dict(Counter(account(r['user_id']) for r in rows))}")
    item0(sb, rows, account)
    item1(sb, rows, account)
    item2(sb, account)
    run_log.finish()
    print(f"\nrun log: {'finished ' + run_id if run_id else 'not logged'}")


if __name__ == "__main__":
    main()
