"""Shared loading and statistics for the synthetic-data checks.

Loading
-------
Real and synthetic accounts are separated with the same classifiers the
Vector deck uses (scripts/vector_evaluation_pull.py), so "real" means the same
thing in every report. Both cohorts go through core.condition_taxonomy so that
spelling cannot pass for a difference: the generator wrote `low_income` and
`esl`, real onboarding wrote `Limited Income` and `English as an Additional
Language`, and without normalising those would score as a fidelity failure
that is really a vocabulary artefact.

Age bands differ between the two as well. The generator used 18-40 / 40-65 /
65+; the app now records 18-24 / 25-40 / 40-65. Both are mapped onto the
generator's coarser bands, the only common ground. Real users without a band
but with a date of birth are banded from it.

Statistics
----------
Pure Python -- the backend has no numpy. Jensen-Shannon divergence (base 2,
so it lies in [0, 1]), a bootstrap null for it, and Wilson score intervals.
"""
from __future__ import annotations

import math
import random
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional, Sequence

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import normalize_conditions  # noqa: E402

PAGE = 1000
COMMON_BANDS = ["18-40", "40-65", "65+"]
_BAND_MAP = {"18-24": "18-40", "25-40": "18-40", "18-40": "18-40",
             "40-65": "40-65", "65+": "65+"}


@dataclass
class Person:
    user_id: str
    cohort: str                      # "real" | "synthetic"
    conditions: frozenset            # canonical condition keys
    categories: tuple                # one category per condition (with repeats)
    age_band: Optional[str]          # one of COMMON_BANDS, or None
    tech_savvy: Optional[str]
    view_preference: Optional[str]
    relationship: Optional[str]      # user_barriers.relationship, most common
    connection_pref: Optional[str]   # preferences.connection (synthetic only)
    has_goals: bool
    barrier_rows: int = 0            # raw user_barriers rows, placeholders included


@dataclass
class CheckResult:
    name: str
    passed: Optional[bool]           # None = could not be determined
    headline: str
    lines: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def _fetch_all(sb, table, cols):
    rows, start = [], 0
    while True:
        b = sb.table(table).select(cols).range(start, start + PAGE - 1).execute().data or []
        rows.extend(b)
        if len(b) < PAGE:
            break
        start += PAGE
    return rows


def _band_from_dob(dob: Optional[str], today: date) -> Optional[str]:
    try:
        y, m, d = (int(x) for x in str(dob)[:10].split("-"))
    except Exception:
        return None
    age = today.year - y - ((today.month, today.day) < (m, d))
    if age < 18:
        return None
    return "18-40" if age < 40 else "40-65" if age < 65 else "65+"


def load_people(sb=None) -> List[Person]:
    from database.supabase_client import get_supabase
    from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users

    sb = sb or get_supabase()
    users = list_all_users(sb)
    cohort = {}
    for u in users:
        if is_synthetic(u):
            cohort[str(u.id)] = "synthetic"
        elif not is_team_test(u):
            cohort[str(u.id)] = "real"

    profiles = {p["id"]: p for p in _fetch_all(sb, "profiles", "id, preferences, date_of_birth")}
    barriers: Dict[str, List[dict]] = {}
    for r in _fetch_all(sb, "user_barriers", "user_id, barrier_type, relationship"):
        barriers.setdefault(r["user_id"], []).append(r)
    # Anyone with a stored goal anywhere. Synthetic accounts have none: the
    # generator never wrote goals, paths or embeddings.
    with_goals = {r["user_id"] for r in _fetch_all(sb, "pattern_user_embeddings", "user_id")}
    with_goals |= {r["user_id"] for r in _fetch_all(sb, "user_paths", "user_id")}

    today = date.today()
    people = []
    for uid, c in cohort.items():
        rows = barriers.get(uid, [])
        conds, _ = normalize_conditions([r.get("barrier_type") for r in rows])
        prefs = (profiles.get(uid) or {}).get("preferences") or {}
        band = _BAND_MAP.get(str(prefs.get("ageRange") or ""))
        if band is None and c == "real":
            band = _band_from_dob((profiles.get(uid) or {}).get("date_of_birth"), today)
        rel = Counter(r.get("relationship") for r in rows if r.get("relationship"))
        people.append(Person(
            user_id=uid,
            cohort=c,
            conditions=frozenset(x.key for x in conds),
            categories=tuple(sorted(x.category for x in conds)),
            age_band=band,
            tech_savvy=prefs.get("techSavvy") or None,
            view_preference=prefs.get("viewPreference") or None,
            relationship=rel.most_common(1)[0][0] if rel else None,
            connection_pref=prefs.get("connection") or None,
            has_goals=uid in with_goals,
            barrier_rows=len(rows),
        ))
    return people


def split(people: Sequence[Person]):
    real = [p for p in people if p.cohort == "real"]
    synth = [p for p in people if p.cohort == "synthetic"]
    return real, synth


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

def distribution(values: Sequence) -> Dict:
    c = Counter(v for v in values if v is not None)
    total = sum(c.values())
    return {k: v / total for k, v in c.items()} if total else {}


def jsd(p: Dict, q: Dict) -> float:
    """Jensen-Shannon divergence, base 2: 0 = identical, 1 = disjoint."""
    keys = set(p) | set(q)
    m = {k: 0.5 * (p.get(k, 0.0) + q.get(k, 0.0)) for k in keys}

    def kl(a):
        return sum(a[k] * math.log2(a[k] / m[k]) for k in keys if a.get(k, 0.0) > 0)

    return 0.5 * kl(p) + 0.5 * kl(q)


def jsd_null(real_values: Sequence, n_synth: int, draws: int = 1000, seed: int = 0) -> List[float]:
    """JSD values to expect by chance if real and synthetic came from the
    same population.

    Small cohorts make JSD noticeably above zero even between two samples of
    one population; this is the yardstick that says how much. Each draw takes
    TWO samples from the real empirical distribution -- one the size of the
    real cohort, one the size of the synthetic cohort -- and measures the
    divergence between them. Redrawing both matters: the real cohort is small
    and noisy too, and treating it as the exact truth would understate the
    noise and fail synthetic data for differences chance alone produces.
    """
    rng = random.Random(seed)
    pool = [v for v in real_values if v is not None]
    if not pool or n_synth <= 0:
        return []
    out = []
    for _ in range(draws):
        a = [rng.choice(pool) for _ in range(len(pool))]
        b = [rng.choice(pool) for _ in range(n_synth)]
        out.append(jsd(distribution(a), distribution(b)))
    return sorted(out)


def percentile(sorted_vals: Sequence[float], q: float) -> float:
    if not sorted_vals:
        return float("nan")
    i = min(len(sorted_vals) - 1, max(0, int(round(q * (len(sorted_vals) - 1)))))
    return sorted_vals[i]


def wilson(successes: int, n: int, z: float = 1.96):
    """95% Wilson score interval for a proportion. (nan, nan) when n is 0."""
    if n == 0:
        return float("nan"), float("nan")
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def fmt_dist(d: Dict, order: Optional[Sequence] = None, top: Optional[int] = None) -> str:
    """Readable distribution. `top` truncates long tails for display only --
    the statistics are always computed on the full distribution."""
    keys = list(order) if order else sorted(d, key=lambda k: (-d[k], str(k)))
    shown = keys[:top] if top else keys
    out = ", ".join(f"{k} {d.get(k, 0):.0%}" for k in shown)
    if top and len(keys) > top:
        rest = sum(d[k] for k in keys[top:])
        out += f", +{len(keys) - top} more ({rest:.0%})"
    return out
