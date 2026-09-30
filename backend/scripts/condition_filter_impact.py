"""Before/after for the Pattern Recognition condition filter.

Replays find_similar_pattern_users for every row in pattern_user_embeddings,
using that row's own stored vector and conditions as the query, twice:

  before  the SQL filter as deployed: `p.barriers && barriers_filter`, an
          exact-string overlap on the raw stored labels
  after   the RPC unfiltered, then apply_condition_filter from the agent,
          which is the code production would run

Everything else matches the RPC: cosine > 0.7, score = cosine
+ 0.1 * success_rate + feedback signal, self excluded, ordered by score,
capped at 10. The candidate pool is the whole table, as in production.

Read-only. Prints counts only, no identifiers.

Run:  python -m scripts.condition_filter_impact      (from backend/)
"""
from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import Dict, List

from dotenv import load_dotenv

load_dotenv()

from core.agents.pattern_recognition_agent import (  # noqa: E402
    CANDIDATE_POOL,
    apply_condition_filter,
)
from core.condition_taxonomy import match_keys, normalize_conditions  # noqa: E402
from core.retrieval_eval import cosine, jaccard, norm  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.pattern_experiment import fetch_all, parse_vec  # noqa: E402

THRESHOLD = 0.7   # match_threshold passed by _vector_search
TOP_K = 10        # `requested` in find_similar_patterns


def query_kind(barriers: List[str]) -> str:
    if not barriers:
        return "no conditions entered"
    _, counts = normalize_conditions(barriers)
    if counts["known"]:
        return "has a recognised condition"
    if counts["free_text"]:
        return "free text only"
    return "placeholder only"


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return

    rows = fetch_all(sb, "pattern_user_embeddings", "user_id, embedding, barriers, success_rate")
    try:
        versions = Counter(r.get("embedding_text_version")
                           for r in fetch_all(sb, "pattern_user_embeddings",
                                              "embedding_text_version"))
    except Exception:
        versions = Counter({"(column not applied yet)": len(rows)})
    feedback = {(f["query_user_id"], f["retrieved_user_id"]): float(f.get("signal") or 0)
                for f in fetch_all(sb, "pattern_user_feedback",
                                   "query_user_id, retrieved_user_id, signal")}

    vec = {r["user_id"]: parse_vec(r["embedding"]) for r in rows}
    nrm = {u: norm(v) for u, v in vec.items()}
    bars = {r["user_id"]: [str(b) for b in (r.get("barriers") or [])] for r in rows}
    succ = {r["user_id"]: 0.5 if r.get("success_rate") is None else float(r["success_rate"])
            for r in rows}
    ids = list(vec)

    print(f"rows (queries and candidates): {len(ids)}")
    print(f"embedding_text_version: {dict(versions)}")
    print(f"pattern_user_feedback rows: {len(feedback)}")

    cos = {}
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            cos[(a, b)] = cos[(b, a)] = cosine(vec[a], vec[b], nrm[a], nrm[b])

    def ranked(q: str) -> List[Dict]:
        """RPC rows for query q with no condition filter, best score first."""
        out = [{"user_id": c, "barriers": bars[c],
                "score": cos[(q, c)] + 0.1 * succ[c] + feedback.get((q, c), 0.0)}
               for c in ids if c != q and cos[(q, c)] > THRESHOLD]
        return sorted(out, key=lambda r: -r["score"])

    def before(q: str) -> List[str]:
        qb = bars[q]
        cands = ranked(q)
        if qb:  # old code: barriers_filter = raw strings, NULL when empty
            cands = [r for r in cands if set(r["barriers"]) & set(qb)]
        return [r["user_id"] for r in cands[:TOP_K]]

    def after(q: str) -> List[str]:
        filtered = bool(match_keys(bars[q]))
        cands = ranked(q)[:CANDIDATE_POOL if filtered else TOP_K]
        return [r["user_id"] for r in apply_condition_filter(cands, bars[q], TOP_K)]

    res = {q: (before(q), after(q)) for q in ids}

    def dist(which: int, qs: List[str]) -> str:
        n = [len(res[q][which]) for q in qs]
        if not n:
            return "—"
        return (f"mean {mean(n):.1f} | 0 matches: {sum(1 for x in n if x == 0)} | "
                f"full {TOP_K}: {sum(1 for x in n if x == TOP_K)} | "
                f"1-{TOP_K - 1}: {sum(1 for x in n if 0 < x < TOP_K)}")

    print("\n== Matches per query (all rows)")
    print(f"  before  {dist(0, ids)}")
    print(f"  after   {dist(1, ids)}")

    kinds = Counter(query_kind(bars[q]) for q in ids)
    print("\n== By what the query person entered")
    for kind, n in kinds.most_common():
        qs = [q for q in ids if query_kind(bars[q]) == kind]
        print(f"  {kind} ({n}); result list unchanged for "
              f"{sum(1 for q in qs if res[q][0] == res[q][1])}")
        print(f"    before  {dist(0, qs)}")
        print(f"    after   {dist(1, qs)}")

    def shares_real(q: str, c: str) -> bool:
        return bool(match_keys(bars[q]) & match_keys(bars[c]))

    print("\n== Returned matches that share a recognised or typed condition with the query")
    for label, which in (("before", 0), ("after", 1)):
        pairs = [(q, c) for q in ids for c in res[q][which]]
        real = sum(1 for q, c in pairs if shares_real(q, c))
        gated = [(q, c) for q, c in pairs if match_keys(bars[q])]
        real_g = sum(1 for q, c in gated if shares_real(q, c))
        print(f"  {label:<7} {real} of {len(pairs)} returned matches"
              f"  (queries that are filtered: {real_g} of {len(gated)})")

    print("\n== Pairs the filter admits, before the cap of 10 (unordered, over threshold)")
    placeholder_only = spelling_gain = raw_pass = norm_pass = 0
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if cos[(a, b)] <= THRESHOLD:
                continue
            shared_raw = set(bars[a]) & set(bars[b])
            r_ok, n_ok = bool(shared_raw), shares_real(a, b)
            raw_pass += r_ok
            norm_pass += n_ok
            if r_ok and not n_ok:
                placeholder_only += 1
            if n_ok and not r_ok:
                spelling_gain += 1
    print(f"  before (exact strings) {raw_pass}")
    print(f"  after  (normalised)    {norm_pass}")
    print(f"    removed: share only a placeholder answer     {placeholder_only}")
    print(f"    added:   same condition, different spelling  {spelling_gain}")

    print("\n== How much each query's top-10 changed")
    js = [jaccard(set(res[q][0]), set(res[q][1])) for q in ids
          if res[q][0] or res[q][1]]
    same = sum(1 for q in ids if res[q][0] == res[q][1])
    print(f"  identical result list: {same} of {len(ids)} queries")
    if js:
        print(f"  mean Jaccard(before, after) over queries with any match: {mean(js):.2f}")


if __name__ == "__main__":
    main()
