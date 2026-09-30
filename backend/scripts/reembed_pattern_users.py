"""Re-embed stored profiles with the anonymised text, and report what it sends.

Why this exists: every vector in pattern_user_embeddings before the
anonymisation change was built from the old text (stringified profile, email
included). New vectors are built from the anonymised summary. The two are not
comparable -- a similarity between an old vector and a new one measures the
difference in the text, not in the people -- so after deploying the change the
old rows should be rebuilt.

DRY RUN BY DEFAULT. A dry run sends nothing and writes nothing. It rebuilds
the outbound text for every stored row from what the database already holds
(barriers, goals, motivation_type, and the age band in profiles.preferences),
audits it, and reports coverage: how much of each person's profile survives
anonymisation, and whether people who differ still get different text.

  python -m scripts.reembed_pattern_users              # dry run, stats only
  python -m scripts.reembed_pattern_users --apply      # re-embed stale rows

--apply requires STEP 42 (the embedding_text_version column), sends the
anonymised text of each stale row to OpenAI, and overwrites its vector. Run it
only after the anonymisation change is deployed: rebuilding the index while the
old code is still serving searches would put stored vectors and search vectors
in different spaces.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections import Counter

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import normalize_condition  # noqa: E402
from core.embedding_privacy import (  # noqa: E402
    EMBEDDING_TEXT_VERSION,
    _goal_words,
    audit_embedding_text,
    build_embedding_text,
)
from database.supabase_client import get_supabase  # noqa: E402

PAGE = 1000


def fetch_all(sb, table, cols):
    rows, start = [], 0
    while True:
        b = sb.table(table).select(cols).range(start, start + PAGE - 1).execute().data or []
        rows.extend(b)
        if len(b) < PAGE:
            break
        start += PAGE
    return rows


def load_rows(sb):
    """Stored embedding rows, with the version column if STEP 42 has run."""
    try:
        return fetch_all(sb, "pattern_user_embeddings",
                         "user_id, barriers, goals, motivation_type, embedding_text_version"), True
    except Exception as e:
        if "embedding_text_version" not in str(e):
            raise
        return fetch_all(sb, "pattern_user_embeddings",
                         "user_id, barriers, goals, motivation_type"), False


def profile_for(row, prefs_by_user):
    """The minimum the text builder reads. Nothing else is loaded."""
    return {
        "motivationType": row.get("motivation_type") or "",
        "preferences": {"ageRange": (prefs_by_user.get(row["user_id"]) or {}).get("ageRange")},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="re-embed stale rows (sends to OpenAI)")
    args = ap.parse_args()

    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    rows, has_version = load_rows(sb)
    prefs = {p["id"]: (p.get("preferences") or {})
             for p in fetch_all(sb, "profiles", "id, preferences")}

    print(f"stored embedding rows      : {len(rows)}")
    if has_version:
        print(f"by embedding_text_version  : {dict(Counter(r.get('embedding_text_version') for r in rows))}")
        stale = [r for r in rows if r.get("embedding_text_version") != EMBEDDING_TEXT_VERSION]
    else:
        print("embedding_text_version     : column missing -- STEP 42 not applied yet")
        stale = rows
    print(f"stale (not {EMBEDDING_TEXT_VERSION})        : {len(stale)}")

    # ---- Coverage: what survives anonymisation -------------------------
    kinds = Counter()
    goal_strings = goal_strings_kept = words_total = words_kept = 0
    texts, audit_failures = {}, 0
    for r in rows:
        for b in r.get("barriers") or []:
            kinds[normalize_condition(b).kind] += 1
        for g in r.get("goals") or []:
            goal_strings += 1
            raw_words = [w for w in str(g).split() if any(ch.isalpha() for ch in w)]
            kept = _goal_words(g)
            words_total += len(raw_words)
            words_kept += len(kept)
            goal_strings_kept += bool(kept)
        text = build_embedding_text(r.get("barriers") or [], r.get("goals") or [],
                                    profile_for(r, prefs))
        texts[r["user_id"]] = text
        if audit_embedding_text(text):
            audit_failures += 1

    print("\n-- conditions --")
    print(f"labels recognised          : {kinds['known']}")
    print(f"placeholders (none/undisclosed): {kinds['none'] + kinds['undisclosed']}")
    print(f"free text (sent as 'a self-described difference'): {kinds['free_text']}")
    print("\n-- goals --")
    print(f"goal strings               : {goal_strings}")
    print(f"  keeping >=1 generic word : {goal_strings_kept}  "
          f"({goal_strings_kept / goal_strings:.0%})" if goal_strings else "")
    print(f"words kept / written       : {words_kept} / {words_total}  "
          f"(stopwords, places, names and typos are what is dropped)")
    print("\n-- outbound text --")
    print(f"audit failures             : {audit_failures}   (must be 0)")
    distinct = len(set(texts.values()))
    print(f"distinct texts / users     : {distinct} / {len(texts)}")
    collisions = sum(c for c in Counter(texts.values()).values() if c > 1)
    print(f"users sharing a text       : {collisions}  "
          f"(these people become indistinguishable to retrieval)")
    # How much of that is anonymisation, and how much was already true? Two
    # people who entered identical conditions and goals were indistinguishable
    # on those fields before any of this; only the excess is the privacy cost.
    raw_keys = Counter(
        (tuple(sorted(str(b).casefold() for b in r.get("barriers") or [])),
         tuple(sorted(str(g).casefold() for g in r.get("goals") or [])))
        for r in rows)
    raw_shared = sum(c for c in raw_keys.values() if c > 1)
    print(f"  already identical in raw : {raw_shared}  "
          f"(same conditions and goals as entered, before anonymisation)")
    print(f"  merged by anonymisation  : {collisions - raw_shared}")

    if audit_failures:
        print("\nRefusing to continue: some outbound text failed the audit.")
        return 2

    if not args.apply:
        print("\nDry run: nothing sent, nothing written. Re-run with --apply to re-embed.")
        return 0

    # ---- Apply -----------------------------------------------------------
    if not has_version:
        print("\n--apply needs STEP 42 (embedding_text_version). Apply the migration first.")
        return 3
    if not os.getenv("OPENAI_API_KEY"):
        print("\nOPENAI_API_KEY not set.")
        return 4

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def run():
        done = failed = 0
        for r in stale:
            try:
                resp = await client.embeddings.create(
                    model="text-embedding-ada-002", input=texts[r["user_id"]])
                vec = resp.data[0].embedding
                sb.table("pattern_user_embeddings").update({
                    "embedding": vec,
                    "embedding_text_version": EMBEDDING_TEXT_VERSION,
                }).eq("user_id", r["user_id"]).execute()
                done += 1
            except Exception as e:
                failed += 1
                print(f"  failed: {str(e)[:80]}")
        print(f"\nre-embedded {done}, failed {failed}")

    asyncio.run(run())
    return 0


if __name__ == "__main__":
    sys.exit(main())
