"""Downstream utility: train on synthetic, test on real (TSTR).

Pattern Recognition is not a trained model -- it is nearest-neighbour
retrieval: find people like you and learn from them. So "train on X" here
means "use X as the pool of people you can be matched against", and the task
has to be one that neighbour retrieval actually serves.

The task: condition completion. Take a real person with two or more
conditions, hide one, find their nearest neighbours by the conditions that
remain, and see whether the neighbours' conditions point to the hidden one
(hit@3). This works only if the pool captures which conditions really occur
together -- exactly what the matching relies on.

  TRTR  pool = the other real users            (the reference)
  TSTR  pool = the synthetic users             (the question)
  plus a popularity baseline for each pool: guess the three most common
  conditions, ignoring the person entirely.

Neighbours are matched on condition sets (Jaccard), not on ada-002 vectors:
synthetic accounts have no embeddings, and generating them would not change
the question being asked. This is the engineered-feature form of the same
retrieval.

Proposed pass criterion: TSTR reaches at least 80% of TRTR's hit@3. It is a
common rule of thumb for relative utility, stated here so it can be argued
with, not a standard the course set.

    python -m scripts.synthetic_validation.utility_tstr
"""
from __future__ import annotations

import sys
from collections import Counter
from typing import Dict, FrozenSet, List, Optional, Sequence, Tuple

from scripts.synthetic_validation.common import CheckResult, Person, load_people, split, wilson

K_NEIGHBOURS = 10
TOP_N = 3
PASS_RATIO = 0.8


def _jaccard(a: FrozenSet, b: FrozenSet) -> float:
    u = a | b
    return len(a & b) / len(u) if u else 0.0


def predict(query: FrozenSet, pool: Sequence[Tuple[str, FrozenSet]],
            popularity: Counter, k: int = K_NEIGHBOURS, n: int = TOP_N) -> Tuple[List[str], bool]:
    """Top-n conditions suggested by the k nearest people in the pool.

    Only people who share at least one condition with the query AND hold at
    least one it lacks are candidates. The second condition matters: without
    it, the nearest neighbours are often people whose conditions are a subset
    of the query's -- the closest match, but with nothing to suggest -- and
    the prediction silently degrades to popularity. That hit the synthetic
    pool hardest, since every synthetic account holds only one or two
    conditions. Applied identically to both pools.

    Returns (predictions, used_neighbours). With no such candidate the guess
    falls back to popularity, reported separately because a hit then says
    nothing about the pool's structure.
    """
    candidates = [(_jaccard(query, conds), uid, conds) for uid, conds in pool
                  if (conds & query) and (conds - query)]
    neighbours = sorted(candidates, key=lambda t: (-t[0], t[1]))[:k]
    votes: Dict[str, float] = {}
    for sim, _, conds in neighbours:
        for c in conds - query:
            votes[c] = votes.get(c, 0.0) + sim
    if not votes:
        ranked = [c for c, _ in popularity.most_common() if c not in query]
        return ranked[:n], False
    ranked = sorted(votes, key=lambda c: (-votes[c], -popularity[c], c))
    return ranked[:n], True


def popular_guess(query: FrozenSet, popularity: Counter, n: int = TOP_N) -> List[str]:
    return [c for c, _ in sorted(popularity.items(), key=lambda t: (-t[1], t[0]))
            if c not in query][:n]


def evaluate(real: Sequence[Person], synth: Sequence[Person]) -> Dict:
    real_pool = [(p.user_id, p.conditions) for p in real if p.conditions]
    synth_pool = [(p.user_id, p.conditions) for p in synth if p.conditions]
    synth_vocab = set().union(*(c for _, c in synth_pool)) if synth_pool else set()
    synth_pop = Counter(c for _, cs in synth_pool for c in cs)

    tally = {name: [0, 0] for name in ("trtr", "tstr", "pop_real", "pop_synth",
                                         "trtr_invocab", "tstr_invocab")}
    fallback = {"trtr": 0, "tstr": 0}
    queries = 0
    for p in real:
        if len(p.conditions) < 2:
            continue
        queries += 1
        others = [(uid, cs) for uid, cs in real_pool if uid != p.user_id]
        real_pop = Counter(c for _, cs in others for c in cs)
        for hidden in sorted(p.conditions):
            q = p.conditions - {hidden}
            trtr, used_r = predict(q, others, real_pop)
            tstr, used_s = predict(q, synth_pool, synth_pop)
            fallback["trtr"] += not used_r
            fallback["tstr"] += not used_s
            for name, preds in (("trtr", trtr), ("tstr", tstr),
                                ("pop_real", popular_guess(q, real_pop)),
                                ("pop_synth", popular_guess(q, synth_pop))):
                tally[name][0] += hidden in preds
                tally[name][1] += 1
            if hidden in synth_vocab:
                for name, preds in (("trtr_invocab", trtr), ("tstr_invocab", tstr)):
                    tally[name][0] += hidden in preds
                    tally[name][1] += 1
    return {"tally": tally, "fallback": fallback, "queries": queries,
            "vocab": len(synth_vocab)}


def run(people: Optional[List[Person]] = None) -> CheckResult:
    people = people if people is not None else load_people()
    real, synth = split(people)
    res = evaluate(real, synth)
    t = res["tally"]

    def rate(name):
        hits, n = t[name]
        lo, hi = wilson(hits, n)
        return (hits / n if n else float("nan")), lo, hi, hits, n

    def cell(name):
        r, lo, hi, hits, n = rate(name)
        return f"{r:.0%} ({hits}/{n}; 95% CI {lo:.0%}–{hi:.0%})" if n else "—"

    trtr, tstr = rate("trtr")[0], rate("tstr")[0]
    ratio = tstr / trtr if trtr else float("nan")
    passed = None if not t["trtr"][1] else ratio >= PASS_RATIO
    n_cases = t["trtr"][1]

    lines = [
        f"Test cases: {n_cases} held-out conditions from {res['queries']} real people with two "
        f"or more named conditions. hit@{TOP_N}, {K_NEIGHBOURS} nearest neighbours.",
        "",
        "| pool | hit@3, all hidden conditions | hit@3, hidden condition exists in synthetic vocabulary |",
        "|---|---|---|",
        f"| TRTR — other real users | {cell('trtr')} | {cell('trtr_invocab')} |",
        f"| TSTR — synthetic users | {cell('tstr')} | {cell('tstr_invocab')} |",
        f"| popularity, real | {cell('pop_real')} | |",
        f"| popularity, synthetic | {cell('pop_synth')} | |",
        "",
        f"**TSTR / TRTR = {ratio:.2f}** (proposed pass: ≥ {PASS_RATIO}).",
        "",
        f"- The synthetic pool knows {res['vocab']} conditions. A hidden condition outside those "
        f"can never be recovered from it, whatever the matching does; the right-hand column "
        f"removes that handicap to ask whether the pool carries real co-occurrence structure "
        f"at all.",
        f"- Cases with no usable neighbour (nobody who shares a remaining condition and holds "
        f"one the person lacks), so the guess fell back to popularity: "
        f"TRTR {res['fallback']['trtr']}, TSTR {res['fallback']['tstr']}.",
        "- Several cases come from the same person, so they are not independent; the intervals "
        "are somewhat narrower than they should be. With this few real people, read the "
        "direction, not the decimals.",
    ]
    headline = (f"{'PASS' if passed else 'FAIL' if passed is False else 'UNDETERMINED'} — "
                f"TSTR hit@3 {tstr:.0%} vs TRTR {trtr:.0%} (ratio {ratio:.2f}, "
                f"pass ≥ {PASS_RATIO}) on {n_cases} cases")
    return CheckResult("Downstream utility (TSTR)", passed, headline, lines)


def main() -> int:
    result = run()
    print(f"# {result.name}\n\n{result.headline}\n")
    print("\n".join(result.lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
