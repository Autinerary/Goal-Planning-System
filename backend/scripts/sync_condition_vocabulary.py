"""Store the condition map's answer for every stored condition value (STEP 57).

user_barriers.barrier_type keeps what people chose or typed, as they wrote it.
This writes one row per distinct value into condition_vocabulary: its kind
(condition, placeholder or unmapped), canonical key, label and category, all
from core/condition_taxonomy.py, the map the Pattern Recognition filter
already uses at query time. The table is that map's output, stored, not a
second map. The user_barriers_normalized view joins it on.

Never writes to user_barriers. Without --apply it only reads and reports:
distinct values before and after, which values map to which, and the ones
that don't map, for a person to decide on. Values from
pattern_user_embeddings.barriers are included so the vocabulary covers the
copies stored with the vectors too.

  python -m scripts.sync_condition_vocabulary              (from backend/)
  python -m scripts.sync_condition_vocabulary --out FILE   also write the report
  python -m scripts.sync_condition_vocabulary --apply      write the vocabulary
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import TAXONOMY_VERSION, vocabulary_entry  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402

CLASSES = ("real", "team", "synthetic", "no account")


def build_vocabulary(values: Iterable[Optional[str]]) -> List[Dict[str, Optional[str]]]:
    """One vocabulary row per distinct non-null value, from the map."""
    rows = {}
    for v in values:
        if v is None or v in rows:
            continue
        rows[v] = {"raw_value": v, **vocabulary_entry(v), "taxonomy_version": TAXONOMY_VERSION}
    return sorted(rows.values(), key=lambda r: r["raw_value"])


def meaning(row: Dict[str, Optional[str]]) -> str:
    """What a value counts as after normalising: its canonical key, or the
    unmapped text itself (case and spacing ignored)."""
    if row["kind"] == "unmapped":
        return "unmapped:" + " ".join(str(row["raw_value"]).lower().split())
    return f'{row["kind"]}:{row["canonical"]}'


def distinct_counts(values: Iterable[Optional[str]]) -> Dict[str, int]:
    vocab = build_vocabulary(values)
    after = {meaning(r) for r in vocab}
    return {
        "raw": len(vocab),
        "after": len(after),
        "conditions": len({m for m in after if m.startswith("condition:")}),
        "placeholders": len({m for m in after if m.startswith("placeholder:")}),
        "unmapped": len({m for m in after if m.startswith("unmapped:")}),
    }


def account_classes(sb) -> Dict[str, str]:
    """Same definitions as the Vector deck: synthetic, team/QA, or real."""
    from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users
    return {
        str(u.id): "synthetic" if is_synthetic(u) else "team" if is_team_test(u) else "real"
        for u in list_all_users(sb)
    }


def report(barrier_rows: List[Dict], embedding_values: List[str], classes: Dict[str, str]) -> List[str]:
    by_class = defaultdict(list)
    for r in barrier_rows:
        by_class[classes.get(str(r["user_id"]), "no account")].append(r)

    out = ["# Condition vocabulary", "",
           f"Map: core/condition_taxonomy.py, version `{TAXONOMY_VERSION}`.", "",
           "## Distinct values, before and after", "",
           "Before: distinct `user_barriers.barrier_type` strings as stored. After: what they mean "
           "once normalised, counting each condition once, each placeholder once, and each unmapped "
           "value once.", "",
           "| accounts | rows | people | before | after | conditions | placeholders | unmapped |",
           "|---|---|---|---|---|---|---|---|"]

    def line(name, rows):
        c = distinct_counts(r["barrier_type"] for r in rows)
        people = len({r["user_id"] for r in rows})
        out.append(f"| {name} | {len(rows)} | {people} | {c['raw']} | {c['after']} | "
                   f"{c['conditions']} | {c['placeholders']} | {c['unmapped']} |")

    for name in CLASSES:
        if by_class.get(name):
            line(name, by_class[name])
    line("all", barrier_rows)
    e = distinct_counts(embedding_values)
    out += ["", f"`pattern_user_embeddings.barriers` (the copies stored with the vectors): "
                f"{e['raw']} distinct before, {e['after']} after.", ""]

    vocab = build_vocabulary([r["barrier_type"] for r in barrier_rows] + list(embedding_values))
    groups = defaultdict(list)
    for r in vocab:
        groups[(r["kind"], r["canonical"], r["label"], r["category"])].append(r["raw_value"])

    out += ["## Which values map to which", ""]
    for kind, title in (("condition", "Conditions"), ("placeholder", "Placeholders (their own kind, not conditions)")):
        out += [f"### {title}", "", "| canonical | label | category | stored values |", "|---|---|---|---|"]
        for (k, canonical, label, category), raws in sorted(groups.items(), key=lambda g: (g[0][3] or "", g[0][1] or "")):
            if k == kind:
                out.append(f"| `{canonical}` | {label} | {category} | " + ", ".join(f"`{v}`" for v in sorted(raws)) + " |")
        out.append("")

    unmapped = [r["raw_value"] for r in vocab if r["kind"] == "unmapped"]
    owners = defaultdict(set)
    for r in barrier_rows:
        owners[r["barrier_type"]].add(classes.get(str(r["user_id"]), "no account"))
    out += ["## Not mapped: for a person to decide", "",
            f"{len(unmapped)} value(s). Nothing is guessed: each stays 'unmapped' until an alias is "
            "added to core/condition_taxonomy.py, or it is left as it is.", ""]
    for v in unmapped:
        who = ", ".join(sorted(owners.get(v, {"embeddings only"})))
        out.append(f"- `{v}` ({who} account)")
    return out


def apply(sb, vocab: List[Dict[str, Optional[str]]]) -> int:
    try:
        for i in range(0, len(vocab), 200):
            sb.table("condition_vocabulary").upsert(vocab[i:i + 200], on_conflict="raw_value").execute()
    except Exception as e:
        if "condition_vocabulary" in str(e):
            print("condition_vocabulary does not exist yet: apply STEP 57 first.")
            return 1
        raise
    print(f"wrote {len(vocab)} vocabulary rows (taxonomy {TAXONOMY_VERSION}); user_barriers untouched")
    return 0


def main() -> int:
    from scripts.reembed_pattern_users import fetch_all

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="write condition_vocabulary")
    ap.add_argument("--out", help="also write the report to this markdown file")
    args = ap.parse_args()

    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return 1
    barrier_rows = fetch_all(sb, "user_barriers", "user_id, barrier_type")
    embedding_values = [b for r in fetch_all(sb, "pattern_user_embeddings", "barriers")
                        for b in (r.get("barriers") or [])]
    lines = report(barrier_rows, embedding_values, account_classes(sb))
    print("\n".join(lines))
    if args.out:
        with open(args.out, "w") as f:
            f.write("\n".join(lines) + "\n")
    if args.apply:
        return apply(sb, build_vocabulary([r["barrier_type"] for r in barrier_rows] + embedding_values))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
