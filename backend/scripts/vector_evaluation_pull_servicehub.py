"""Real-data pull for ServiceHub's four agents (Recommendation, Pattern,
Validation, Synthesis) — same posture as vector_evaluation_pull.py: report,
don't fabricate, and say "not enough data" where that's the honest answer.

Run:  python -m scripts.vector_evaluation_pull_servicehub    (from backend/)
"""
from __future__ import annotations

from collections import Counter, defaultdict

from dotenv import load_dotenv

load_dotenv()

from database.supabase_client import get_supabase  # noqa: E402


def list_all_users(sb):
    """Fully paginated user list — see vector_evaluation_pull.py for why this
    matters. Unpaginated list_users() silently returns only page 1."""
    all_users = []
    page = 1
    while True:
        resp = sb.auth.admin.list_users(page=page, per_page=200)
        batch = resp if isinstance(resp, list) else getattr(resp, "users", [])
        if not batch:
            break
        all_users.extend(batch)
        if len(batch) < 200:
            break
        page += 1
    return all_users


def section(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return

    user_list = list_all_users(sb)

    def is_synthetic(u) -> bool:
        e = str(getattr(u, "email", "") or "")
        return "synthetic+" in e or e.endswith("@autinerary.dev")

    def is_team_test(u) -> bool:
        e = str(getattr(u, "email", "") or "").lower()
        return (
            e.startswith("test") or e.startswith("child") or "test.account" in e
            or e.endswith("@test.com")
            or e in ("superautism@gmail.com", "noreply.psapon@gmail.com",
                      "aayush_bhan@hotmail.com", "bhanaayush@gmail.com")
        )

    real_ids = {str(u.id) for u in user_list if not is_synthetic(u) and not is_team_test(u)}

    # ---- Ratings (Validation Agent / Recommendation Agent ground truth) ---
    section("RATINGS")
    ratings = sb.table("ratings").select(
        "id, user_id, resource_id, overall_score, helpful_count"
    ).execute().data or []
    print(f"  total ratings          : {len(ratings)}")
    real_ratings = [r for r in ratings if r["user_id"] in real_ids]
    print(f"  from real users        : {len(real_ratings)}")
    if ratings:
        dist = Counter(r.get("overall_score") for r in ratings)
        print("  score distribution (1-5):")
        for k in sorted(dist, key=lambda x: (x is None, x)):
            print(f"     {k}: {dist[k]}")
    rated_resource_ids = {r["resource_id"] for r in ratings if r.get("resource_id")}
    print(f"  distinct resources with >=1 rating: {len(rated_resource_ids)}")

    # ---- Resources reviewed vs total (ceiling on Recommendation Agent) -----
    res_rows = sb.table("resources").select("id, status").execute().data or []
    approved = [r for r in res_rows if r.get("status") == "approved"]
    reviewed_approved = [r for r in approved if r["id"] in rated_resource_ids]
    print(f"\n  approved resources     : {len(approved)}")
    print(f"  of which have >=1 rating: {len(reviewed_approved)} "
          f"({(len(reviewed_approved)/len(approved)*100 if approved else 0):.0f}%)")

    # ---- Moderation queue (Validation Agent ground truth) ------------------
    section("MODERATION QUEUE")
    try:
        mod_rows = sb.table("moderation_queue").select("id, item_type, status").execute().data or []
        status_counts = Counter(r.get("status") or "unknown" for r in mod_rows)
        type_counts = Counter(r.get("item_type") or "unknown" for r in mod_rows)
        print(f"  total rows             : {len(mod_rows)}")
        for k, v in status_counts.most_common():
            print(f"     status={k:<12}{v:>5}")
        for k, v in type_counts.most_common():
            print(f"     item_type={k:<10}{v:>5}")
    except Exception as e:
        print(f"  could not read moderation_queue: {e}")

    # ---- User barriers -> pattern-agent combination pool -------------------
    section("USER BARRIERS (pattern-agent input pool)")
    ub_rows = sb.table("user_barriers").select(
        "user_id, barrier_category, barrier_type"
    ).execute().data or []
    real_ub = [r for r in ub_rows if r["user_id"] in real_ids]
    print(f"  total rows             : {len(ub_rows)}  (from real users: {len(real_ub)})")
    per_user = defaultdict(set)
    for r in real_ub:
        per_user[r["user_id"]].add(r.get("barrier_type"))
    multi = [u for u, s in per_user.items() if len(s) >= 2]
    print(f"  real users with >=2 distinct barrier_types: {len(multi)} of {len(per_user)}")
    print("  pattern-agent default minimumSupport=5 co-occurring users per combination —")
    print(f"  current real pool ({len(per_user)} users) is below that for most combinations.")

    # ---- Trust score inputs sample -----------------------------------------
    section("TRUST SCORE INPUTS (sample of up to 5 real users)")
    sample_ids = list(real_ids)[:5]
    for uid in sample_ids:
        prof = sb.table("profiles").select("created_at").eq("id", uid).limit(1).execute().data
        n_ratings = sb.table("ratings").select("id", count="exact").eq("user_id", uid).execute().count
        n_resources = sb.table("resources").select("id", count="exact").eq("submitted_by", uid).execute().count
        print(f"  {uid[:8]}...  ratings={n_ratings}  resources_submitted={n_resources}")

    print("\n" + "=" * 72)
    print("READ BEFORE PUTTING A NUMBER ON A SLIDE")
    print("=" * 72)
    print("  * Ratings volume is the ceiling on Recommendation Agent quality AND")
    print("    Validation Agent trust scores. Both ultimately wait on the same gap.")
    print("  * Pattern Agent's minimumSupport=5 means most barrier combinations")
    print("    cannot surface yet at n=", len(per_user), "real users with barriers.")


if __name__ == "__main__":
    main()
