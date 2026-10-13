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

from core.agents.tool_recommendation_agent import is_self_listing  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

POOL_LIMIT = 500      # _fetch_resource_pool's .limit(500)
LLM_SCORED = 60       # _barrier_fit_scores scores pool[:60]; the rest get 0.5


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
    return lambda uid: kind.get(str(uid), "no account")


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


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return
    account = accounts(sb)
    rows = fetch_all(sb, "user_paths", "user_id, path_id, is_legacy, created_at, payload")
    print(f"== Stored paths: {len(rows)}  legacy {sum(1 for r in rows if r.get('is_legacy'))}  "
          f"by account: {dict(Counter(account(r['user_id']) for r in rows))}")
    item0(sb, rows, account)


if __name__ == "__main__":
    main()
