"""Privacy & memorisation: is any synthetic record effectively a copy of a real one?

Two kinds of evidence, because either alone is weak:

1. Structural -- how the synthetic data was made. If the generator never read
   a real record, it cannot have copied one. This script reports every read
   the generator performs (it scans servicehub-mvp/scripts/generate-synthetic-
   profiles.ts for database selects) so the claim is checkable, not asserted.

2. Distance to closest record (DCR). Each record is its set of conditions
   plus its age band; distance is 1 - Jaccard. For every synthetic record,
   the distance to the nearest real record is compared with how far real
   records sit from EACH OTHER. Synthetic records sitting systematically
   closer to real people than real people sit to one another is the
   signature of memorisation.

Exact matches are listed with how many real people share that profile. A
synthetic record identical to a profile five real people share discloses
nothing about any of them; one identical to a profile only one real person
has would single them out, and is flagged for review whatever the cause.

The feature space is coarse -- at most two of nine conditions plus one of
three age bands on the synthetic side -- so some exact matches are expected
by chance. That is why this check does not fail on exact matches alone.

Pass criterion: the generator reads no real records, AND synthetic records are
not reliably closer to real ones than real ones are to each other -- measured
as the probability that a synthetic record's distance-to-closest-real is
smaller than a real record's distance to its nearest other real record, and
failing only if its bootstrap 5th percentile is still above 50%. Exact-copy
rates are reported alongside as context.

An earlier version compared medians. A test feeding it literal copies of
real records with mostly unique profiles passed, because both medians came
out 0. Comparing whole distributions, and exact-copy rates, catches it.

What this deliberately does NOT flag: copying a profile several real people
share. That is indistinguishable from sampling the population and discloses
nothing about any one of them. The risk this check exists for is copying
rare records -- the ones that would single a person out.

    python -m scripts.synthetic_validation.privacy_nn
"""
from __future__ import annotations

import random
import re
import sys
from collections import Counter
from pathlib import Path
from statistics import median
from typing import FrozenSet, List, Optional, Sequence

from scripts.synthetic_validation.common import CheckResult, Person, load_people, split

GENERATOR = Path(__file__).resolve().parents[3] / "servicehub-mvp/scripts/generate-synthetic-profiles.ts"
MIN_CELL = 5  # smallest group whose profile may be printed in a report


def record(p: Person) -> FrozenSet[str]:
    return frozenset(p.conditions | ({f"age:{p.age_band}"} if p.age_band else set()))


def distance(a: FrozenSet, b: FrozenSet) -> float:
    u = a | b
    return 1.0 - (len(a & b) / len(u) if u else 1.0)


def nearest(x: FrozenSet, others: Sequence[FrozenSet]) -> float:
    return min((distance(x, o) for o in others), default=float("nan"))


def prob_closer(sr: Sequence[float], rr: Sequence[float]) -> float:
    """P(a synthetic record's distance-to-closest-real < a real record's
    distance to its nearest other real record), ties counted half.

    Distances here take few distinct values, so this counts by value rather
    than comparing every pair -- fast enough to bootstrap.
    """
    if not sr or not rr:
        return float("nan")
    cr = Counter(rr)
    values = sorted(cr)
    greater, running = {}, 0
    for v in reversed(values):
        greater[v] = running
        running += cr[v]
    total = 0.0
    for s in sr:
        above = sum(cr[v] for v in values if v > s) if s not in greater else greater[s]
        total += above + 0.5 * cr.get(s, 0)
    return total / (len(sr) * len(rr))


def _exact(vals: Sequence[float]) -> float:
    return sum(1 for v in vals if v == 0.0) / len(vals) if vals else float("nan")


def closeness_test(sr: Sequence[float], rr: Sequence[float], draws: int = 500, seed: int = 0):
    """Is synthetic RELIABLY closer to real than real is to itself?

    If the synthetic data were fresh draws from the real population, the
    "closer" probability would sit at 50% and the exact-copy rates would
    match, give or take noise. A hard cut at exactly 50% would therefore
    fail honest data about half the time. Instead, both statistics are
    bootstrapped, and the check fails only if the 5th percentile is still
    past the line -- i.e. synthetic is closer beyond what chance explains.

    Returns (closer, closer_lo5, exact_s, exact_r, diff_lo5).
    """
    rng = random.Random(seed)
    closers, diffs = [], []
    for _ in range(draws):
        s = rng.choices(sr, k=len(sr))
        r = rng.choices(rr, k=len(rr))
        closers.append(prob_closer(s, r))
        diffs.append(_exact(s) - _exact(r))
    closers.sort()
    diffs.sort()
    lo = int(0.05 * (draws - 1))
    return prob_closer(sr, rr), closers[lo], _exact(sr), _exact(rr), diffs[lo]


def generator_reads() -> Optional[List[str]]:
    """Every line in the generator that reads from the database, with the
    function it sits in. None if the file is not found."""
    if not GENERATOR.exists():
        return None
    reads, fn = [], "(top level)"
    for i, line in enumerate(GENERATOR.read_text().splitlines(), 1):
        m = re.match(r"\s*(?:async\s+)?function\s+(\w+)", line)
        if m:
            fn = m.group(1)
        if ".select(" in line:
            reads.append(f"line {i} in {fn}(): {line.strip()[:90]}")
    return reads


def run(people: Optional[List[Person]] = None, show_profiles: bool = False) -> CheckResult:
    people = people if people is not None else load_people()
    real, synth = split(people)
    real_recs = [record(p) for p in real if p.conditions]
    synth_recs = [record(p) for p in synth if p.conditions]

    # Real-to-real: each record's nearest OTHER real record.
    rr = [nearest(r, real_recs[:i] + real_recs[i + 1:]) for i, r in enumerate(real_recs)]
    sr = [nearest(s, real_recs) for s in synth_recs]
    real_profile_counts = Counter(real_recs)

    exact = [s for s, d in zip(synth_recs, sr) if d == 0.0]
    exact_profiles = Counter(exact)
    singling_out = {prof: n for prof, n in exact_profiles.items() if real_profile_counts[prof] == 1}

    reads = generator_reads()
    only_purge = reads is not None and all("purge()" in r for r in reads)
    med_sr, med_rr = median(sr) if sr else float("nan"), median(rr) if rr else float("nan")

    # Is a synthetic record closer to real people than real people are to each
    # other -- reliably, not by noise? See closeness_test.
    if sr and rr:
        closer, closer_lo, exact_s, exact_r, diff_lo = closeness_test(sr, rr)
        # Decided on `closer` alone. Exact copies are distance 0 and already
        # count there. The exact-copy RATES are reported but do not decide:
        # at tens of real records the real duplicate count is a handful of
        # pairs, and comparing rates failed data that was freshly drawn from
        # the real population.
        distance_ok = not (closer_lo > 0.5)
    else:
        closer = closer_lo = exact_s = exact_r = diff_lo = float("nan")
        distance_ok = False
    passed = bool(only_purge and distance_ok)

    lines = [
        f"Real records: {len(real_recs)} (people with at least one named condition). "
        f"Synthetic records: {len(synth_recs)}. A record is its conditions plus its age band.",
        "",
        "| | median | 10th pct | share at distance 0 |",
        "|---|---|---|---|",
    ]

    def pct(vals, q):
        s = sorted(vals)
        return s[min(len(s) - 1, int(q * len(s)))] if s else float("nan")

    for label, vals in (("synthetic → nearest real", sr), ("real → nearest other real", rr)):
        zero = sum(1 for v in vals if v == 0.0)
        lines.append(f"| {label} | {median(vals):.2f} | {pct(vals, 0.1):.2f} | "
                     f"{zero}/{len(vals)} ({zero / len(vals):.0%}) |" if vals else f"| {label} | — | — | — |")
    lines += [
        "",
        f"**Synthetic records are {'no closer' if distance_ok else 'CLOSER'} to real people than "
        f"real people are to each other.** A synthetic record is nearer its closest real record "
        f"than a real record is to its closest other real record in {closer:.0%} of comparisons "
        f"(ties count half; bootstrap 5th percentile {closer_lo:.0%} — fails only if that is "
        f"still above 50%). Exact copies of a real profile: {exact_s:.0%} of synthetic records, "
        f"against {exact_r:.0%} of real records that duplicate another real person's profile.",
        "",
        f"Exact matches: {len(exact)} synthetic records reproduce a real profile exactly, "
        f"covering {len(exact_profiles)} distinct profiles.",
    ]
    # Small-cell suppression. A privacy report must not itself publish a
    # profile only a handful of real people hold -- "the one person aged 18-40
    # whose only condition is X" is a disclosure however it got there. Contents
    # are shown only for profiles held by at least MIN_CELL real people, or
    # locally with --show-profiles.
    for prof, n in sorted(exact_profiles.items(), key=lambda t: (-t[1], -real_profile_counts[t[0]])):
        shared_by = real_profile_counts[prof]
        flag = "  ← held by one real person; review" if shared_by == 1 else ""
        label = (f"{{{', '.join(sorted(prof))}}}" if show_profiles or shared_by >= MIN_CELL
                 else f"(profile withheld: held by fewer than {MIN_CELL} real people)")
        lines.append(f"- {label}: {n} synthetic record(s); held by {shared_by} real "
                     f"{'person' if shared_by == 1 else 'people'}{flag}")

    lines.append("")
    if reads is None:
        lines.append(f"Structural check: generator not found at {GENERATOR} — NOT VERIFIED.")
    else:
        lines.append(f"Structural check — database reads in `{GENERATOR.name}`: {len(reads)}.")
        lines += [f"- {r}" for r in reads]
        lines.append(
            "Every read is inside `purge()`, which only selects synthetic accounts by their "
            "`synthetic+…@autinerary.dev` address in order to delete them. Profiles are built "
            "from hard-coded option lists with `Math.random()`; no real record is ever read, so "
            "none can have been copied." if only_purge else
            "**At least one read is outside `purge()` — the generator may read real data. Review.**")
    if singling_out:
        lines.append(
            f"\n{len(singling_out)} exact match(es) are to a profile only one real person has. "
            "Given the generator reads no real data these are coincidences in a coarse feature "
            "space, but a coincidence still points at one person; they are listed for review.")

    headline = (f"{'PASS' if passed else 'FAIL'} — generator reads "
                f"{'no real records' if only_purge else 'real data or could not be checked'}; "
                f"synthetic closer than real-to-real in {closer:.0%} of comparisons "
                f"(fails only if reliably above 50%); exact copies {exact_s:.0%} vs real "
                f"duplicates {exact_r:.0%}; "
                f"{len(singling_out)} exact match(es) to a unique real profile")
    return CheckResult("Privacy & memorisation", passed, headline, lines)


def main() -> int:
    # --show-profiles prints every matched profile in full. Local review only;
    # never paste that output into a committed report.
    result = run(show_profiles="--show-profiles" in sys.argv[1:])
    print(f"# {result.name}\n\n{result.headline}\n")
    print("\n".join(result.lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
