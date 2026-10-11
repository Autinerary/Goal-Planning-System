"""How many stored paths are legacy, and which fixed values each rule finds.

Read-only. Counts only, no identifiers.

Before STEP 53 it applies the rule itself (core/path_provenance.py). After
STEP 53 it also reads user_paths.is_legacy and says whether the column and
the rule agree, which is the check that the migration flagged what it should.

  python -m scripts.legacy_paths_report      (from backend/)
"""
from __future__ import annotations

from collections import Counter

from dotenv import load_dotenv

load_dotenv()

from core.path_provenance import fixed_values, is_legacy_payload  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402

PAGE = 1000


def fetch_paths(sb):
    """All rows, with is_legacy when the column exists."""
    for cols, has_flag in (("path_id, payload, is_legacy", True), ("path_id, payload", False)):
        rows, start = [], 0
        try:
            while True:
                batch = sb.table("user_paths").select(cols).range(start, start + PAGE - 1).execute().data or []
                rows.extend(batch)
                if len(batch) < PAGE:
                    return rows, has_flag
                start += PAGE
        except Exception as e:
            if "is_legacy" not in str(e):
                raise
    return [], False


def main() -> int:
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1
    rows, has_flag = fetch_paths(sb)
    legacy = [r for r in rows if is_legacy_payload(r.get("payload"))]
    print(f"paths                         : {len(rows)}")
    print(f"legacy by the rule            : {len(legacy)}   (no milestone carries nameSource)")
    by_value = Counter(v for r in legacy for v in fixed_values(r.get("payload")))
    for value, n in by_value.most_common():
        print(f"  carrying {value:<44} {n}")
    later = Counter(v for r in rows if not is_legacy_payload(r.get("payload")) for v in fixed_values(r.get("payload")))
    for value, n in later.most_common():
        print(f"  not legacy, but equal to {value:<28} {n}   (computed; not flagged)")
    if has_flag:
        flagged = {r["path_id"] for r in rows if r.get("is_legacy")}
        ruled = {r["path_id"] for r in legacy}
        print(f"is_legacy = true in the table : {len(flagged)}")
        print(f"column and rule agree         : {flagged == ruled}"
              + ("" if flagged == ruled else f"  (only column {len(flagged - ruled)}, only rule {len(ruled - flagged)})"))
    else:
        print("is_legacy column               : not there yet (apply STEP 53)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
