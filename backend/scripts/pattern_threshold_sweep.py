"""Pattern Recognition: matches per person as match_threshold moves.

The experiment plan's sweep: match_threshold from 0.50 to 0.90 in steps of
0.05, recording the match count at each step, on the stored vectors.

Every stored vector is a query against all the others, the way production
searches the whole pattern_user_embeddings table. Two counts per person:

  returned    what the search gives back: cosine above the threshold, then
              the live condition filter (apply_condition_filter, on the
              stored conditions), capped at 10 (match_count)
  above       everyone above the threshold, no filter, no cap

For each threshold: mean, median, min and max per person, and how many get
zero. Also the spread of pairwise cosines.

Read-only. Counts only, no identifiers. Nothing calls OpenAI.

  python -m scripts.pattern_threshold_sweep              (from backend/)
  python -m scripts.pattern_threshold_sweep --out FILE   also write the report
"""
from __future__ import annotations

import argparse
from collections import Counter
from statistics import mean, median
from typing import Dict, List

from dotenv import load_dotenv

load_dotenv()

from core.agents.pattern_recognition_agent import apply_condition_filter  # noqa: E402
from core.retrieval_eval import vector_sim  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.pattern_experiment import fetch_all, parse_vec  # noqa: E402

THRESHOLDS = [round(0.50 + 0.05 * i, 2) for i in range(9)]   # 0.50 .. 0.90
MATCH_COUNT = 10                                             # what the agent asks for


def stats(values: List[int]) -> Dict[str, float]:
    return {"mean": mean(values), "median": median(values), "min": min(values),
            "max": max(values), "zero": sum(1 for v in values if v == 0)}


def sweep(vectors: Dict[str, List[float]], barriers: Dict[str, List[str]]) -> Dict[float, Dict[str, Dict]]:
    ids = sorted(vectors)
    sim = vector_sim(vectors)
    sims = {u: {v: sim(u, v) for v in ids if v != u} for u in ids}
    out = {}
    for t in THRESHOLDS:
        above, returned = [], []
        for u in ids:
            rows = [{"user_id": v, "barriers": barriers.get(v, [])}
                    for v, s in sorted(sims[u].items(), key=lambda kv: -kv[1]) if s > t]
            above.append(len(rows))
            returned.append(len(apply_condition_filter(rows, barriers.get(u, []), MATCH_COUNT)))
        out[t] = {"returned": stats(returned), "above": stats(above)}
    return out


def pairwise(vectors: Dict[str, List[float]]) -> List[float]:
    ids = sorted(vectors)
    sim = vector_sim(vectors)
    return sorted(sim(a, b) for i, a in enumerate(ids) for b in ids[i + 1:])


def report(rows: List[Dict]) -> List[str]:
    versions = Counter(r.get("embedding_text_version") or "NULL" for r in rows)
    vectors = {r["user_id"]: parse_vec(r["embedding"]) for r in rows}
    barriers = {r["user_id"]: [str(b) for b in (r.get("barriers") or [])] for r in rows}
    result = sweep(vectors, barriers)
    pairs = pairwise(vectors)

    def table(kind: str, title: str) -> List[str]:
        lines = [f"### {title}", "", "| threshold | mean | median | min | max | people with 0 |",
                 "|---|---|---|---|---|---|"]
        for t in THRESHOLDS:
            s = result[t][kind]
            lines.append(f"| {t:.2f} | {s['mean']:.1f} | {s['median']:g} | {s['min']} | {s['max']} | {s['zero']} |")
        return lines + [""]

    lines = ["# Pattern Recognition threshold sweep", "",
             f"Stored vectors: {len(rows)} ({', '.join(f'{k}: {v}' for k, v in versions.items())}). "
             f"Each is a query against the other {len(rows) - 1}.", ""]
    if pairs:
        q = lambda p: pairs[min(len(pairs) - 1, int(p * len(pairs)))]  # noqa: E731
        lines += [f"Pairwise cosine over {len(pairs)} pairs: min {pairs[0]:.3f}, 10th pct {q(0.10):.3f}, "
                  f"median {median(pairs):.3f}, 90th pct {q(0.90):.3f}, max {pairs[-1]:.3f}.", ""]
        for t in THRESHOLDS:
            below = sum(1 for s in pairs if s <= t)
            lines.append(f"- pairs at or below {t:.2f}: {below} of {len(pairs)}")
        lines.append("")
    lines += table("returned", "What the search returns (threshold, live condition filter, at most 10)")
    lines += table("above", "Everyone above the threshold (no filter, no cap)")
    return lines


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", help="also write the report to this markdown file")
    args = ap.parse_args()
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return 1
    rows = fetch_all(sb, "pattern_user_embeddings", "user_id, embedding, barriers, embedding_text_version")
    lines = report(rows)
    print("\n".join(lines))
    if args.out:
        with open(args.out, "w") as f:
            f.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
