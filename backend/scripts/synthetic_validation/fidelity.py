"""Fidelity: do the synthetic accounts look like the real ones?

For each attribute both cohorts carry, compares the two distributions with
Jensen-Shannon divergence (0 = identical, 1 = nothing in common) and reports
1 - JSD as a similarity score.

Pass/fail is not a hand-picked cut-off. For each attribute, a bootstrap asks:
if the synthetic sample really came from the real population, how large a JSD
would chance produce at these sample sizes? The attribute passes if the
observed JSD is at or below the 95th percentile of that null. That makes the
verdict honest at small n -- 73 real people cannot pin a distribution down
tightly, and the test allows for that.

Goals are reported as not computable: the generator never wrote any, so there
is nothing on the synthetic side to compare.

    python -m scripts.synthetic_validation.fidelity
"""
from __future__ import annotations

import sys
from typing import Callable, List, Optional, Sequence

from scripts.synthetic_validation.common import (
    COMMON_BANDS,
    CheckResult,
    Person,
    distribution,
    fmt_dist,
    jsd,
    jsd_null,
    load_people,
    percentile,
    split,
)


def _feature(name: str, real_vals: Sequence, synth_vals: Sequence,
             order: Optional[List] = None, note: str = "", top: Optional[int] = None) -> dict:
    real_vals = [v for v in real_vals if v is not None]
    synth_vals = [v for v in synth_vals if v is not None]
    if not real_vals or not synth_vals:
        return {"name": name, "computable": False,
                "why": "no real values" if not real_vals else "no synthetic values"}
    pr, ps = distribution(real_vals), distribution(synth_vals)
    observed = jsd(pr, ps)
    null = jsd_null(real_vals, len(synth_vals))
    cutoff = percentile(null, 0.95)
    return {
        "name": name, "computable": True,
        "n_real": len(real_vals), "n_synth": len(synth_vals),
        "real": fmt_dist(pr, order, top), "synth": fmt_dist(ps, order, top),
        "jsd": observed, "similarity": 1 - observed,
        "null_median": percentile(null, 0.5), "null_95": cutoff,
        "passed": observed <= cutoff, "note": note,
    }


def _flatten(people: Sequence[Person], get: Callable[[Person], Sequence]) -> list:
    return [x for p in people for x in get(p)]


def run(people: Optional[List[Person]] = None) -> CheckResult:
    people = people if people is not None else load_people()
    real, synth = split(people)
    real_c = [p for p in real if p.conditions]      # real users who logged a condition
    synth_c = [p for p in synth if p.conditions]

    def count_bucket(p):
        n = len(p.conditions)
        return "1" if n == 1 else "2" if n == 2 else "3+"

    features = [
        _feature("age band", [p.age_band for p in real], [p.age_band for p in synth],
                 order=COMMON_BANDS),
        _feature("condition category (per condition)",
                 _flatten(real_c, lambda p: p.categories), _flatten(synth_c, lambda p: p.categories)),
        _feature("specific condition (per condition)",
                 _flatten(real_c, lambda p: sorted(p.conditions)),
                 _flatten(synth_c, lambda p: sorted(p.conditions)), top=9),
        _feature("conditions per person", [count_bucket(p) for p in real_c],
                 [count_bucket(p) for p in synth_c], order=["1", "2", "3+"]),
        _feature("tech-savvy", [p.tech_savvy for p in real], [p.tech_savvy for p in synth],
                 order=["not_at_all", "somewhat", "always"]),
        _feature("view preference", [p.view_preference for p in real],
                 [p.view_preference for p in synth], order=["plain", "pretty", "exciting", "fun"]),
        _feature("relationship to condition", [p.relationship for p in real_c],
                 [p.relationship for p in synth_c],
                 note="Both cohorts are almost entirely the column default 'lived', so "
                      "agreement here carries little information."),
    ]
    goals_real = sum(p.has_goals for p in real)
    goals_synth = sum(p.has_goals for p in synth)

    computed = [f for f in features if f["computable"]]
    failed = [f["name"] for f in computed if not f["passed"]]
    overall_sim = sum(f["similarity"] for f in computed) / len(computed) if computed else float("nan")

    # Vocabulary coverage: can the synthetic data even express what real
    # people report?
    synth_vocab = set().union(*(p.conditions for p in synth_c)) if synth_c else set()
    real_mentions = _flatten(real_c, lambda p: sorted(p.conditions))
    covered = sum(1 for k in real_mentions if k in synth_vocab)

    # Internal consistency of the synthetic records themselves.
    says_other = [p for p in synth if p.connection_pref and p.connection_pref != "self"]
    contradicts = [p for p in says_other if p.relationship == "lived"]

    placeholder_only = sum(1 for p in real if p.barrier_rows and not p.conditions)
    lines = [
        f"Real accounts: {len(real)}, of whom {len(real_c)} named at least one condition "
        f"({placeholder_only} more answered only \"Prefer not to share\" / \"No current "
        f"barriers\", which are not conditions). Synthetic accounts: {len(synth)} "
        f"({len(synth_c)} with a condition).",
        "",
        "| attribute | n real / synth | real | synthetic | JSD | similarity | chance 95th pct | result |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for f in features:
        if not f["computable"]:
            lines.append(f"| {f['name']} | — | — | — | — | — | — | not computable ({f['why']}) |")
            continue
        lines.append(
            f"| {f['name']} | {f['n_real']} / {f['n_synth']} | {f['real']} | {f['synth']} | "
            f"{f['jsd']:.3f} | {f['similarity']:.2f} | {f['null_95']:.3f} | "
            f"{'PASS' if f['passed'] else 'FAIL'} |")
    lines.append(f"| goal area | {goals_real} / {goals_synth} with goals | — | — | — | — | — | "
                 f"not computable (synthetic accounts have no goals) |")
    lines += [
        "",
        f"**Overall similarity (mean of 1 − JSD over {len(computed)} attributes): {overall_sim:.2f}.**",
        "",
        f"- Vocabulary: the synthetic data uses {len(synth_vocab)} distinct conditions. "
        f"{covered} of {len(real_mentions)} real condition mentions "
        f"({covered / len(real_mentions):.0%}) fall inside that vocabulary; the rest cannot "
        f"be represented at all." if real_mentions else "- Vocabulary: no real conditions to compare.",
        f"- Internal consistency: {len(says_other)} synthetic accounts have a "
        f"`preferences.connection` other than 'self' (parent, sibling, educator…), and "
        f"{len(contradicts)} of them are recorded in `user_barriers` as lived experience. "
        f"The generator wrote the two fields independently, so each synthetic record "
        f"contradicts itself about whose condition it is.",
    ]
    for f in computed:
        if f.get("note"):
            lines.append(f"- {f['name']}: {f['note']}")

    passed = not failed if computed else None
    headline = (f"{'PASS' if passed else 'FAIL'} — similarity {overall_sim:.2f}; "
                f"{len(computed) - len(failed)} of {len(computed)} attributes within chance"
                + (f"; failing: {', '.join(failed)}" if failed else ""))
    return CheckResult("Fidelity & representativeness", passed, headline, lines)


def main() -> int:
    result = run()
    print(f"# {result.name}\n\n{result.headline}\n")
    print("\n".join(result.lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
