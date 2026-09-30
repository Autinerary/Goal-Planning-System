"""Pure functions for comparing ways of representing a profile for retrieval.

No I/O and no third-party dependencies (the backend has no numpy), so the
maths can be unit-tested and read in one place. At this cohort size -- tens of
users -- pure Python is fast enough: a full similarity matrix over 60 users of
1536-dim vectors is about 2.8M multiplications.

Every "arm" of the Pattern Recognition experiment reduces to the same thing: a
function giving a similarity for any two users. Everything downstream -- top-k
neighbours, agreement between arms, threshold sweeps, and scoring against
human-labelled pairs -- works on that alone, so arms are compared on equal
terms.
"""

from __future__ import annotations

import math
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from core.condition_taxonomy import normalize_conditions
from core.embedding_privacy import AGE_BANDS, MOTIVATIONS, summarize_goal

Vector = Sequence[float]
SimFn = Callable[[str, str], Optional[float]]


# ---------------------------------------------------------------------------
# Vectors
# ---------------------------------------------------------------------------

def norm(v: Vector) -> float:
    return math.sqrt(sum(x * x for x in v))


def cosine(a: Vector, b: Vector, na: Optional[float] = None, nb: Optional[float] = None) -> float:
    na = norm(a) if na is None else na
    nb = norm(b) if nb is None else nb
    if na == 0 or nb == 0:
        return 0.0
    return sum(x * y for x, y in zip(a, b)) / (na * nb)


def vector_sim(vectors: Dict[str, Vector]) -> SimFn:
    """Cosine over stored vectors, with norms cached and results memoised."""
    norms = {u: norm(v) for u, v in vectors.items()}
    cache: Dict[Tuple[str, str], float] = {}

    def sim(a: str, b: str) -> Optional[float]:
        if a not in vectors or b not in vectors:
            return None
        key = (a, b) if a < b else (b, a)
        if key not in cache:
            cache[key] = cosine(vectors[a], vectors[b], norms[a], norms[b])
        return cache[key]

    return sim


# ---------------------------------------------------------------------------
# Engineered features (arm 2)
# ---------------------------------------------------------------------------

def engineered_features(barriers: Iterable[object], goals: Iterable[object],
                        age_band: Optional[str] = None,
                        motivation: Optional[str] = None) -> Set[str]:
    """A profile as a set of named binary features. No free text, no model.

    Conditions contribute both their specific key and their category, so two
    people with different specific conditions in the same family still share
    something. Goals contribute their area and their allow-listed words.
    """
    feats: Set[str] = set()
    conditions, _ = normalize_conditions(list(barriers or []))
    for c in conditions:
        feats.add(f"cond:{c.key}")
        feats.add(f"cat:{c.category}")
    for g in goals or []:
        s = summarize_goal(str(g))
        if s:
            area, words = s
            feats.add(f"area:{area}")
            feats.update(f"word:{w}" for w in words)
    if age_band in AGE_BANDS:
        feats.add(f"age:{age_band}")
    m = str(motivation or "").casefold()
    if m in MOTIVATIONS:
        feats.add(f"motivation:{m}")
    return feats


def set_cosine(a: Set[str], b: Set[str]) -> float:
    """Cosine between binary vectors given as sets (the Ochiai coefficient)."""
    if not a or not b:
        return 0.0
    return len(a & b) / math.sqrt(len(a) * len(b))


def feature_sim(features: Dict[str, Set[str]]) -> SimFn:
    def sim(a: str, b: str) -> Optional[float]:
        if a not in features or b not in features:
            return None
        return set_cosine(features[a], features[b])
    return sim


def mean_sim(*fns: SimFn) -> SimFn:
    """Equal-weight average of several arms.

    Concatenating two L2-normalised vectors, each scaled by 1/sqrt(2), gives a
    cosine equal to the mean of the two separate cosines. So "concatenated"
    and "mean of the parts" are the same arm; this computes it directly
    instead of materialising 1536+N-dimensional vectors.
    """
    def sim(a: str, b: str) -> Optional[float]:
        vals = [f(a, b) for f in fns]
        if any(v is None for v in vals):
            return None
        return sum(vals) / len(vals)
    return sim


def standardized_mean_sim(pool: Sequence[str], *fns: SimFn) -> SimFn:
    """Average of arms after putting each on the same scale.

    mean_sim weights arms equally in value but not in influence. ada-002
    cosines on this data sit between roughly 0.84 and 1.0, while engineered-
    feature cosines span 0 to 1; averaged raw, the wider arm decides almost
    every ranking. Z-scoring each arm over all pairs in the pool first gives
    each arm an equal say, which is what "combine the two" should mean.
    """
    stats = []
    for f in fns:
        vals = [f(a, b) for i, a in enumerate(pool) for b in pool[i + 1:]]
        vals = [v for v in vals if v is not None]
        if len(vals) < 2:
            stats.append((0.0, 1.0))
            continue
        mu = sum(vals) / len(vals)
        sd = math.sqrt(sum((v - mu) ** 2 for v in vals) / (len(vals) - 1)) or 1.0
        stats.append((mu, sd))

    def sim(a: str, b: str) -> Optional[float]:
        vals = [f(a, b) for f in fns]
        if any(v is None for v in vals):
            return None
        return sum((v - mu) / sd for v, (mu, sd) in zip(vals, stats)) / len(vals)

    return sim


# ---------------------------------------------------------------------------
# Neighbours and agreement
# ---------------------------------------------------------------------------

def ranked_neighbours(user: str, pool: Sequence[str], sim: SimFn) -> List[Tuple[str, float]]:
    """Every other user in the pool, most similar first. Ties break on id so
    results are reproducible."""
    scored = []
    for other in pool:
        if other == user:
            continue
        s = sim(user, other)
        if s is not None:
            scored.append((other, s))
    scored.sort(key=lambda t: (-t[1], t[0]))
    return scored


def top_k(user: str, pool: Sequence[str], sim: SimFn, k: int) -> List[str]:
    return [u for u, _ in ranked_neighbours(user, pool, sim)[:k]]


def jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    a, b = set(a), set(b)
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def arm_agreement(pool: Sequence[str], sim_a: SimFn, sim_b: SimFn, k: int) -> float:
    """Mean Jaccard overlap of the two arms' top-k neighbour sets.

    1.0 = the arms retrieve the same people; around k/(n-1) is what two
    unrelated random rankings would share by chance.
    """
    if not pool:
        return float("nan")
    vals = [jaccard(top_k(u, pool, sim_a, k), top_k(u, pool, sim_b, k)) for u in pool]
    return sum(vals) / len(vals)


def chance_jaccard(n: int, k: int) -> float:
    """Expected Jaccard of two independent random k-subsets of n-1 others."""
    m = n - 1
    if m <= 0 or k <= 0:
        return float("nan")
    k = min(k, m)
    # E[|A∩B|] = k^2/m; approximate E[J] by E[|A∩B|] / E[|A∪B|].
    inter = k * k / m
    return inter / (2 * k - inter)


# ---------------------------------------------------------------------------
# Human-labelled pairs (item 4)
# ---------------------------------------------------------------------------

def canonical_pair(a: str, b: str) -> Tuple[str, str]:
    """(x, y) and (y, x) are the same pair; stored smallest id first."""
    return (a, b) if a < b else (b, a)


def _percentiles(pairs: List[Tuple[str, str]], sim: SimFn) -> Dict[Tuple[str, str], float]:
    """Each pair's position within one arm, 0.0 = least similar, 1.0 = most."""
    scored = sorted(pairs, key=lambda p: (sim(*p) if sim(*p) is not None else -1e9, p))
    last = max(len(scored) - 1, 1)
    return {p: i / last for i, p in enumerate(scored)}


def propose_pairs(pool: Sequence[str], sim_a: SimFn, sim_b: SimFn, combined: SimFn,
                  n: int, seed: int = 0,
                  exclude: Optional[Set[Tuple[str, str]]] = None,
                  names: Tuple[str, str] = ("a", "b")) -> List[Tuple[str, str, str]]:
    """Choose which pairs to ask a human about.

    With 5-10 labels, which pairs are asked about matters more than how many.
    Only showing pairs one arm already rates highly would make the "ground
    truth" inherit that arm's notion of similar. So half the budget goes to
    pairs where the two arms DISAGREE most -- the only pairs that can tell the
    arms apart -- split between each direction of disagreement. The rest is
    spread across the high, middle and low thirds of the combined similarity,
    so labels also cover clearly-similar and clearly-not pairs.

    Each person appears in at most one proposed pair, so a handful of labels
    covers as many different people as possible. Deterministic for a seed.

    Returns (user_a, user_b, source) with the pair in canonical order.
    """
    import random

    exclude = exclude or set()
    rng = random.Random(seed)
    pairs = [canonical_pair(a, b) for i, a in enumerate(pool) for b in pool[i + 1:]]
    pairs = [p for p in pairs if p not in exclude]
    if not pairs or n <= 0:
        return []

    pa, pb = _percentiles(pairs, sim_a), _percentiles(pairs, sim_b)
    pc = _percentiles(pairs, combined)
    used: Set[str] = set()
    out: List[Tuple[str, str, str]] = []

    def take(candidates: List[Tuple[str, str]], source: str, k: int) -> None:
        for p in candidates:
            if k <= 0:
                return
            if p[0] in used or p[1] in used:
                continue
            used.update(p)
            out.append((p[0], p[1], source))
            k -= 1

    n_disagree = n // 2
    a_over_b = sorted(pairs, key=lambda p: (-(pa[p] - pb[p]), p))
    b_over_a = sorted(pairs, key=lambda p: (-(pb[p] - pa[p]), p))
    take(a_over_b, f"disagree:{names[0]}>{names[1]}", (n_disagree + 1) // 2)
    take(b_over_a, f"disagree:{names[1]}>{names[0]}", n_disagree // 2)

    thirds = {"high": [], "mid": [], "low": []}
    for p in pairs:
        band = "high" if pc[p] >= 2 / 3 else "mid" if pc[p] >= 1 / 3 else "low"
        thirds[band].append(p)
    for band in thirds.values():
        rng.shuffle(band)
    remaining = n - len(out)
    for i, band in enumerate(["high", "mid", "low"]):
        share = remaining // 3 + (1 if i < remaining % 3 else 0)
        take(thirds[band], f"spread:{band}", share)

    # A band can run out of pairs whose people are both still unused, which
    # would silently return fewer pairs than asked for. Fill from anything
    # left, still one appearance per person.
    if len(out) < n:
        rest = [p for band in ("high", "mid", "low") for p in thirds[band]]
        take(rest, "spread:fill", n - len(out))
    return out


def partner_rank(a: str, b: str, pool: Sequence[str], sim: SimFn) -> Optional[float]:
    """Where each person of a pair ranks the other among everyone, averaged.

    1.0 means they are each other's single nearest neighbour; (len(pool)-1)
    means each is the other's least similar. Lower is better for a pair a
    human called similar.
    """
    ranks = []
    for x, y in ((a, b), (b, a)):
        order = [u for u, _ in ranked_neighbours(x, pool, sim)]
        if y not in order:
            return None
        ranks.append(order.index(y) + 1)
    return sum(ranks) / 2


def auc(positive: Sequence[float], negative: Sequence[float]) -> Optional[float]:
    """Probability a pair labelled similar scores above one labelled not.

    Mann-Whitney form, ties counted as half. 0.5 = no better than chance.
    Needs at least one of each; returns None otherwise.
    """
    if not positive or not negative:
        return None
    wins = 0.0
    for p in positive:
        for q in negative:
            wins += 1.0 if p > q else 0.5 if p == q else 0.0
    return wins / (len(positive) * len(negative))


# ---------------------------------------------------------------------------
# Threshold sweep
# ---------------------------------------------------------------------------

def matches_at(user: str, pool: Sequence[str], sim: SimFn, threshold: float,
               cap: int = 10, gate: Optional[Callable[[str, str], bool]] = None) -> int:
    """How many others clear the threshold, capped the way the RPC caps it
    (match_count=10). `gate` models the RPC's extra WHERE clause."""
    n = 0
    for other in pool:
        if other == user:
            continue
        s = sim(user, other)
        if s is None or s <= threshold:
            continue
        if gate is not None and not gate(user, other):
            continue
        n += 1
    return min(n, cap)
