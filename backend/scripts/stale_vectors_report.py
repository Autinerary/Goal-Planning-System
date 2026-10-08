"""Are stored profile vectors up to date with people's conditions?

Compares each vector's stored conditions with the person's current ones
(user_barriers), by meaning (condition_taxonomy.match_keys), and counts
orphans (vectors whose account no longer exists). After STEP 56 it also shows
how many vectors are waiting to be rebuilt (reindex_requested_at).

The deck's check compared timestamps instead (newest condition vs the
vector's updated_at), which said 11 on 8 Oct 2026; by content it was 5, with
only 2 in common, because re-embedding did not refresh updated_at.

Read-only. Counts only, no identifiers.

  python -m scripts.stale_vectors_report      (from backend/)
"""
from __future__ import annotations

from collections import defaultdict

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import match_keys  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402


def live_user_ids(sb) -> set:
    ids, page = set(), 1
    while True:
        resp = sb.auth.admin.list_users(page=page, per_page=200)
        batch = resp if isinstance(resp, list) else getattr(resp, "users", [])
        ids |= {str(u.id) for u in batch}
        if len(batch) < 200:
            return ids
        page += 1


def main() -> int:
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1
    try:
        emb = fetch_all(sb, "pattern_user_embeddings", "user_id, barriers, reindex_requested_at")
        has_mark = True
    except Exception:
        emb = fetch_all(sb, "pattern_user_embeddings", "user_id, barriers")
        has_mark = False
    current = defaultdict(list)
    for r in fetch_all(sb, "user_barriers", "user_id, barrier_type"):
        current[r["user_id"]].append(r.get("barrier_type"))
    keys = lambda xs: set(match_keys(xs or []))  # noqa: E731
    stale = [e for e in emb if keys(e.get("barriers")) != keys(current.get(e["user_id"]))]
    live = live_user_ids(sb)
    print(f"vectors                                  : {len(emb)}")
    print(f"orphaned (account no longer exists)      : {sum(1 for e in emb if e['user_id'] not in live)}")
    print(f"conditions differ from today's profile   : {len(stale)}")
    print(f"  profile has a condition the vector lacks: {sum(1 for e in stale if keys(current.get(e['user_id'])) - keys(e.get('barriers')))}")
    print(f"  vector has one the profile no longer has: {sum(1 for e in stale if keys(e.get('barriers')) - keys(current.get(e['user_id'])))}")
    if has_mark:
        print(f"waiting to be rebuilt (STEP 56 mark)     : {sum(1 for e in emb if e.get('reindex_requested_at'))}")
    else:
        print("waiting to be rebuilt                    : STEP 56 not applied yet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
