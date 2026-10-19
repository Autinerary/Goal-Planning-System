"""How personality and norms meet (the team's note, October 2026: "one of the
agents should be monitoring how personality types intersect with norms
(choose supervised/unsupervised learning patterns - whichever makes more
sense here)").

Unsupervised first, on purpose. There are no labels to learn from yet: few
people have answered the optional personality statements, and plans need
weeks to show outcomes. So two unsupervised pieces watch now:

  * Pattern Recognition matches similar people on their norms and their
    personality bands together (core/embedding_privacy.py: "personality:
    extraversion low, ..."), so a plan can draw on people like them.
  * This report groups people by a norm and a personality band and
    describes each group's progress: how many have a plan, how many steps
    they finished, how many check in.

Once enough plans have outcomes (steps done, milestone ratings), the same
groups become the labelled data for a supervised model of which ways of
writing steps help whom. Until then a supervised model would only learn the
noise of a few accounts.

Privacy: a group is shown only with 10 or more people (the taste profiles'
rule), team, test and synthetic accounts are left out, and nothing is
written. Personality is optional and only ever comes from a person's own
answers; it is never inferred from a norm.

Run from backend/:  ./venv/bin/python -m scripts.personality_norm_report
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

MIN_GROUP = 10
TRAITS = ("extraversion", "agreeableness", "conscientiousness", "neuroticism", "openness")
BANDS = ("low", "middle", "high")
TRAIT_WORDS = {
    "extraversion": "energy from people",
    "agreeableness": "tuned in to others",
    "conscientiousness": "likes order",
    "neuroticism": "feelings hit hard",
    "openness": "loves new ideas",
}


def fetch_all(sb, table: str, cols: str) -> List[dict]:
    rows, start = [], 0
    while True:
        batch = sb.table(table).select(cols).range(start, start + 999).execute().data or []
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        start += 1000


def groups(people: Dict[str, dict], norms: Dict[str, set]) -> List[dict]:
    """(norm, trait, band) groups, each with its people; small ones kept out by the caller."""
    by_key: Dict[tuple, List[str]] = defaultdict(list)
    for uid, bands in people.items():
        for norm in norms.get(uid, {"(no norm shared)"}):
            for trait in TRAITS:
                if bands.get(trait) in BANDS:
                    by_key[(norm, trait, bands[trait])].append(uid)
    return [{"norm": k[0], "trait": k[1], "band": k[2], "people": v} for k, v in by_key.items()]


def main() -> int:
    from dotenv import load_dotenv
    load_dotenv()
    from database.supabase_client import get_supabase

    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    profiles = fetch_all(sb, "profiles", "id, email, personality:preferences->personality")

    def leave_out(email: str) -> bool:
        e = (email or "").lower()
        return (e.startswith("test") or "test.account" in e or e.endswith("@test.com") or "synthetic+" in e
                or e.endswith("@autinerary.dev"))

    people: Dict[str, dict] = {}
    for p in profiles:
        choice = p.get("personality") or {}
        bands = choice.get("profile") if isinstance(choice, dict) else None
        if isinstance(bands, dict) and bands and not choice.get("skipped") and not leave_out(p.get("email")):
            people[p["id"]] = {t: bands.get(t) for t in TRAITS}

    print("How personality and norms meet")
    print(f"  people who answered the personality statements: {len(people) if len(people) >= MIN_GROUP else f'<{MIN_GROUP}'}")
    if len(people) < MIN_GROUP:
        print(f"  Nothing to show yet: groups need {MIN_GROUP} or more people.")
        return 0

    norms: Dict[str, set] = defaultdict(set)
    for row in fetch_all(sb, "user_barriers_normalized", "user_id, condition_label, barrier_type"):
        if row["user_id"] in people:
            norms[row["user_id"]].add(row.get("condition_label") or "a self-described difference")
    paths = {r["user_id"] for r in fetch_all(sb, "user_paths", "user_id") if r.get("user_id") in people}
    done: Dict[str, int] = defaultdict(int)
    for r in fetch_all(sb, "race_progress", "user_id, kind"):
        if r.get("user_id") in people and r.get("kind") == "completed":
            done[r["user_id"]] += 1

    shown = [g for g in groups(people, norms) if len(g["people"]) >= MIN_GROUP]
    print(f"  groups of {MIN_GROUP}+ people (a norm and a personality band): {len(shown)}")
    print(f"\n  {'norm':<32} {'trait':<20} {'band':<7} {'people':>7} {'have a plan':>12} {'steps done (avg)':>17}")
    for g in sorted(shown, key=lambda g: (g["norm"], g["trait"], BANDS.index(g["band"]))):
        ids = g["people"]
        with_plan = sum(1 for u in ids if u in paths)
        avg_done = sum(done[u] for u in ids) / len(ids)
        print(f"  {g['norm'][:32]:<32} {TRAIT_WORDS[g['trait']]:<20} {g['band']:<7} {len(ids):>7} {with_plan:>12} {avg_done:>17.1f}")
    print("\n  Unsupervised description only: groups, not predictions. See the docstring for when to move to a supervised model.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
