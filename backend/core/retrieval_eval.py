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
