"""Fill pattern_user_field_embeddings: goals and conditions embedded separately.

Experiment arm 4. For every user already in pattern_user_embeddings this builds
two texts with the same anonymiser production uses -- build_goals_text and
build_barriers_text from core/embedding_privacy.py -- and embeds each one on
its own. Using the same anonymised pieces as the concatenated text is what
makes split-versus-concatenated a fair comparison: the only difference
between the arms is whether the fields are embedded together or apart.

DRY RUN BY DEFAULT: builds and audits the texts, reports what would be sent,
sends nothing, writes nothing.

  python -m scripts.embed_pattern_fields            # dry run
  python -m scripts.embed_pattern_fields --apply    # embed new or changed fields

--apply needs STEP 43 (the table). It skips any field whose text hash has not
changed since it was last embedded, so re-running it costs nothing for
unchanged profiles and rebuilds exactly the stale ones.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import sys
from collections import Counter
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from core.embedding_privacy import (  # noqa: E402
    EMBEDDING_TEXT_VERSION,
    audit_embedding_text,
    build_barriers_text,
    build_goals_text,
)
from database.supabase_client import get_supabase  # noqa: E402

PAGE = 1000
MODEL = "text-embedding-ada-002"
FIELDS = {"goals": build_goals_text, "barriers": build_barriers_text}


def fetch_all(sb, table, cols):
    rows, start = [], 0
    while True:
        b = sb.table(table).select(cols).range(start, start + PAGE - 1).execute().data or []
        rows.extend(b)
        if len(b) < PAGE:
            break
        start += PAGE
    return rows


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="embed and write (sends to OpenAI)")
    args = ap.parse_args()

    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    users = fetch_all(sb, "pattern_user_embeddings", "user_id, barriers, goals")
    print(f"users with a stored profile vector: {len(users)}")

    try:
        existing = {(r["user_id"], r["field"]): r["text_sha256"]
                    for r in fetch_all(sb, "pattern_user_field_embeddings",
                                       "user_id, field, text_sha256")}
        table_ok = True
    except Exception as e:
        existing, table_ok = {}, False
        print(f"pattern_user_field_embeddings: not available ({str(e)[:70]}) -- STEP 43 not applied")

    work, audit_failures, per_field_texts = [], 0, {f: Counter() for f in FIELDS}
    for u in users:
        for field, build in FIELDS.items():
            text = build(u.get(field) or [])
            per_field_texts[field][text] += 1
            if audit_embedding_text(text):
                audit_failures += 1
            if existing.get((u["user_id"], field)) != sha(text):
                work.append((u["user_id"], field, text))

    for field in FIELDS:
        c = per_field_texts[field]
        print(f"{field:<9} distinct texts: {len(c)} / {len(users)}")
    print(f"audit failures: {audit_failures}   (must be 0)")
    print(f"fields to embed (new or changed): {len(work)}"
          f"   already current: {len(users) * len(FIELDS) - len(work)}")

    if audit_failures:
        print("Refusing to continue: some text failed the audit.")
        return 2
    if not args.apply:
        print("\nDry run: nothing sent, nothing written. Re-run with --apply.")
        return 0
    if not table_ok:
        print("\n--apply needs STEP 43. Apply the migration first.")
        return 3
    if not os.getenv("OPENAI_API_KEY"):
        print("\nOPENAI_API_KEY not set.")
        return 4

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def run():
        done = failed = 0
        for user_id, field, text in work:
            try:
                resp = await client.embeddings.create(model=MODEL, input=text)
                sb.table("pattern_user_field_embeddings").upsert({
                    "user_id": user_id,
                    "field": field,
                    "embedding": resp.data[0].embedding,
                    "embedding_text_version": EMBEDDING_TEXT_VERSION,
                    "text_sha256": sha(text),
                    "model": MODEL,
                    # The column default only fires on insert.
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }, on_conflict="user_id,field").execute()
                done += 1
            except Exception as e:
                failed += 1
                print(f"  failed ({field}): {str(e)[:80]}")
        print(f"\nembedded {done}, failed {failed}")

    asyncio.run(run())
    return 0


if __name__ == "__main__":
    sys.exit(main())
