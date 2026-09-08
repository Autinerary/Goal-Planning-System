"""Presentation-ready barrier distribution, computed at read time.

Deliberately does NOT modify the database. Two reasons:

  * Merging values is a judgment call, not a formatting fix. "Autism" and
    "autism" are safely the same; "AuDHD" is NOT autism, and "sensory" is a
    category while "Sensory Processing Disorder" is a diagnosis. A migration
    that guessed would destroy distinctions a clinician would care about.
  * The rows are user data. Grouping for a chart is reversible; rewriting
    them is not.

Canonical grouping is applied here, at read time, so the underlying rows stay
exactly as the users gave them.

Run:  python -m scripts.barrier_report        (from backend/)
"""
from __future__ import annotations

from collections import Counter, defaultdict

from dotenv import load_dotenv

load_dotenv()

from database.supabase_client import get_supabase  # noqa: E402

# Case/spelling variants that mean the same thing. Only unambiguous merges
# belong here — anything requiring clinical judgment is left separate and
# reported under REVIEW below.
CANONICAL = {
    "autism": "Autism",
    "adhd": "ADHD",
    "audhd": "AuDHD",                      # autism + ADHD: its own group, not either parent
    "ocd": "OCD",
    "anxiety": "Anxiety",
    "anxiety disorder": "Anxiety",
    "anxiety disorders": "Anxiety",
    "depression": "Depression",
    "mood disorders": "Mood disorders",
    "dyslexia": "Dyslexia",
    "dyscalculia": "Dyscalculia",
    "dysgraphia": "Dysgraphia",
    "esl": "English as a second language",
    "chronic_illness": "Chronic illness",
    "low_income": "Low income",
    "limited income": "Low income",
    "ptsd": "PTSD",
}

# Distinct concepts that look mergeable but are not. Kept apart on purpose.
DO_NOT_MERGE = {
    "AuDHD": "not the same as Autism or ADHD alone",
    "Sensory Processing Disorder": "a diagnosis; 'sensory' is a broad category",
    "Auditory Processing Disorder": "distinct from hearing impairment",
    "Sensory processing differences": "self-described, not a diagnosis",
}


def canonical(value: str) -> str:
    v = (value or "").strip()
    return CANONICAL.get(v.lower(), v)


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return

    users = sb.auth.admin.list_users()
    user_list = users if isinstance(users, list) else getattr(users, "users", [])

    def is_synthetic(u) -> bool:
        e = str(getattr(u, "email", "") or "")
        return "synthetic+" in e or e.endswith("@autinerary.dev")

    synthetic_ids = {str(u.id) for u in user_list if is_synthetic(u)}
    real_ids = {str(u.id) for u in user_list} - synthetic_ids
    known_ids = synthetic_ids | real_ids

    rows = sb.table("user_barriers").select("user_id, barrier_type").execute().data or []

    def bucket(uid: str) -> str:
        if uid in synthetic_ids:
            return "synthetic"
        if uid in real_ids:
            return "real"
        return "orphaned"

    counts: dict = defaultdict(lambda: Counter())
    users_seen: dict = defaultdict(set)
    for r in rows:
        b = bucket(r["user_id"])
        counts[b][canonical(r.get("barrier_type"))] += 1
        users_seen[b].add(r["user_id"])

    print("=" * 66)
    print("HOW MANY USERS?  (one defensible answer per definition)")
    print("=" * 66)
    print(f"  real signed-up accounts        : {len(real_ids)}")
    print(f"  synthetic / seeded accounts    : {len(synthetic_ids)}")
    print(f"  auth users total               : {len(user_list)}")
    print(f"  user_ids in user_barriers      : {len({r['user_id'] for r in rows})}")
    print(f"    of which have no auth user   : {len({r['user_id'] for r in rows} - known_ids)}")
    print("\n  Use 'real signed-up accounts' on stage. The larger figures are")
    print("  seed data and would not survive a follow-up question.")

    for label in ("real", "synthetic", "orphaned"):
        c = counts[label]
        if not c:
            continue
        print("\n" + "=" * 66)
        print(f"{label.upper()}  —  {sum(c.values())} records across {len(users_seen[label])} users")
        print("=" * 66)
        for k, v in c.most_common():
            print(f"  {k:<44}{v:>5}")

    print("\n" + "=" * 66)
    print("KEPT SEPARATE ON PURPOSE")
    print("=" * 66)
    for k, why in DO_NOT_MERGE.items():
        print(f"  {k:<34}{why}")

    print("\n" + "=" * 66)
    print("READ BEFORE PUTTING A CHART ON A SLIDE")
    print("=" * 66)
    print("  * Synthetic counts are near-uniform because they were generated,")
    print("    not observed. Presented as market signal they invite exactly the")
    print("    question you do not want.")
    print("  * The real sample is too small for a distribution. Report it as a")
    print("    sample, or report the focus-group segmentation instead.")


if __name__ == "__main__":
    main()
