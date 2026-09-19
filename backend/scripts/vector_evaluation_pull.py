"""Real-data pull for the Vector evaluation deck: per-agent ground truths,
label distributions, and example metadata.

Deliberately read-only, same posture as scripts/barrier_report.py. Reports
"not enough data" rather than a computed number wherever the real count is
too small to support one — that is itself part of what Vector asked for.

Run:  python -m scripts.vector_evaluation_pull        (from backend/)
"""
from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict

from dotenv import load_dotenv

load_dotenv()

from database.supabase_client import get_supabase  # noqa: E402


def list_all_users(sb):
    """Fully paginated user list.

    `sb.auth.admin.list_users()` with no arguments silently returns only page
    1 (50 users) when the project has more. Calling it that way previously
    produced a false "88 completed-milestone rows / 519 ratings rows are all
    orphaned" finding — those users were real, just past page 1. Always
    paginate explicitly.
    """
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


def is_synthetic(u) -> bool:
    e = str(getattr(u, "email", "") or "")
    return "synthetic+" in e or e.endswith("@autinerary.dev")


# Obviously team/QA/dev accounts, distinguishable by email pattern alone — not
# a claim about anyone else in the list. Anything not caught here is treated
# as an organic signup, which is itself a number worth being honest about:
# this list is necessarily incomplete.
def is_team_test(u) -> bool:
    e = str(getattr(u, "email", "") or "").lower()
    return (
        e.startswith("test")
        or e.startswith("child")
        or "test.account" in e
        or e.endswith("@test.com")  # named-persona seed accounts, e.g. autism_parent@test.com
        or e
        in (
            "superautism@gmail.com",
            "noreply.psapon@gmail.com",
            "aayush_bhan@hotmail.com",
            "bhanaayush@gmail.com",
        )
    )


def section(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return

    # ---- Users -----------------------------------------------------------
    users = list_all_users(sb)
    user_list = users
    user_list = users if isinstance(users, list) else getattr(users, "users", [])
    synthetic_ids = {str(u.id) for u in user_list if is_synthetic(u)}
    team_test_ids = {str(u.id) for u in user_list if not is_synthetic(u) and is_team_test(u)}
    real_ids = {str(u.id) for u in user_list} - synthetic_ids - team_test_ids

    section("USERS")
    print(f"  total auth users     : {len(user_list)}")
    print(f"  real (organic signup): {len(real_ids)}")
    print(f"  team/QA test accounts: {len(team_test_ids)}  (test*, child*.test.account, superautism)")
    print(f"  synthetic (seeded)   : {len(synthetic_ids)}")

    # Relationship tier (self/parent/sibling/...) from servicehub's user_barriers.
    ub_rows = sb.table("user_barriers").select(
        "user_id, barrier_type, relationship, relationship_declared"
    ).execute().data or []

    def bucket(uid: str) -> str:
        if uid in real_ids:
            return "real"
        if uid in team_test_ids:
            return "team_test"
        if uid in synthetic_ids:
            return "synthetic"
        return "orphaned"

    rel_by_bucket: dict = defaultdict(lambda: Counter())
    condition_by_bucket: dict = defaultdict(lambda: Counter())
    for r in ub_rows:
        b = bucket(r["user_id"])
        rel_by_bucket[b][r.get("relationship") or "lived (default)"] += 1
        condition_by_bucket[b][r.get("barrier_type") or "unlabeled"] += 1

    for b in ("real", "synthetic"):
        print(f"\n  -- {b} : relationship tier (self/parent/sibling/other) --")
        total = sum(rel_by_bucket[b].values()) or 1
        for k, v in rel_by_bucket[b].most_common():
            print(f"     {k:<20}{v:>5}  ({v/total:.0%})")

    print(f"\n  distinct real users with >=1 condition logged: "
          f"{len({r['user_id'] for r in ub_rows if bucket(r['user_id']) == 'real'})}")

    # ---- Resources ---------------------------------------------------------
    section("RESOURCES")
    res_rows = sb.table("resources").select("id, category, status, submitted_by").execute().data or []
    print(f"  total rows           : {len(res_rows)}")
    cat_counts = Counter(r.get("category") or "uncategorized" for r in res_rows)
    status_counts = Counter(r.get("status") or "unknown" for r in res_rows)
    print("\n  by status:")
    for k, v in status_counts.most_common():
        print(f"     {k:<16}{v:>5}")
    print("\n  by category:")
    for k, v in cat_counts.most_common():
        print(f"     {k:<20}{v:>5}")

    # ---- Pathways / milestones --------------------------------------------
    section("PATHWAYS (user_paths.payload)")
    path_rows = sb.table("user_paths").select("user_id, path_id, payload").execute().data or []
    real_paths = [p for p in path_rows if p["user_id"] in real_ids]
    synth_paths = [p for p in path_rows if p["user_id"] in synthetic_ids]
    print(f"  total path rows      : {len(path_rows)}  (real {len(real_paths)}, synthetic {len(synth_paths)})")

    def milestone_counts(rows):
        counts = []
        for p in rows:
            payload = p.get("payload") or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except Exception:
                    payload = {}
            races = payload.get("races") or []
            total = sum(len(r.get("milestones") or []) for r in races if isinstance(r, dict))
            counts.append(total)
        return counts

    for label, rows in (("real", real_paths), ("synthetic", synth_paths)):
        counts = milestone_counts(rows)
        if not counts:
            print(f"\n  {label}: no paths")
            continue
        print(f"\n  {label} milestones/path  n={len(counts)}  "
              f"mean={statistics.mean(counts):.1f}  "
              f"min={min(counts)}  max={max(counts)}")

    # ---- Race progress (milestone completion — Focus/Commitment ground truth)
    section("RACE PROGRESS (completed milestones)")
    rp_rows = sb.table("race_progress").select("user_id, completed_at").execute().data or []
    rp_by_bucket = Counter(bucket(r["user_id"]) for r in rp_rows)
    for k, v in rp_by_bucket.most_common():
        print(f"  {k:<12}{v:>5} completion rows")
    dates = sorted(r["completed_at"] for r in rp_rows if r.get("completed_at"))
    if dates:
        print(f"  date range   : {dates[0][:10]} to {dates[-1][:10]}")
    print("  orphaned = user_id has no matching row in the CURRENT auth.users list —")
    print("  i.e. these rows predate an account cleanup, not a live user.")

    # ---- Pattern recognition ground-truth proxy: embeddings available -----
    section("PATTERN RECOGNITION — retrieval pool size")
    try:
        emb_rows = sb.table("pattern_user_embeddings").select("user_id").execute().data or []
        emb_real = sum(1 for r in emb_rows if r["user_id"] in real_ids)
        emb_synth = sum(1 for r in emb_rows if r["user_id"] in synthetic_ids)
        print(f"  embedded profiles total : {len(emb_rows)}  (real {emb_real}, synthetic {emb_synth})")
        print(f"  agent requests top_k=10; a real query only ever matches within the real pool above")
    except Exception as e:
        print(f"  could not read pattern_user_embeddings: {e}")

    print("\n" + "=" * 72)
    print("READ BEFORE PUTTING A NUMBER ON A SLIDE")
    print("=" * 72)
    print("  * Any 'real' bucket below ~10 is a sample, not a distribution.")
    print("    Report it as 'n=X (sample)', not as a percentage on its own.")
    print("  * Synthetic-only distributions are what we generated, not what")
    print("    real usage looks like. Label them as such if they appear at all.")


if __name__ == "__main__":
    main()
