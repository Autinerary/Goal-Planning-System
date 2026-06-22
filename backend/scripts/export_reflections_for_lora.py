"""
Export the Supabase `reflections` table to an mlx-lm-compatible JSONL
dataset for LoRA fine-tuning of the adaptation_agent's explanation behavior.

WHAT THIS IS
------------
The first place in the codebase where a real model weight ever changes.
Everything else in the learning loop (correlations, bandit, retrieval re-rank,
few-shot) modifies state AROUND the foundation model. This script + the
sibling shell scripts modify the foundation model itself — but only the small
LoRA adapter, only on your Mac, and only at $0.

WHY THIS MATCHES THE INFERENCE FORMAT
-------------------------------------
The training prompts here are byte-for-byte identical to what
backend/core/agents/adaptation_agent.py::adapt_path() sends to llm.complete_text()
at line 191. The assistant content is the explanation the LLM produced at
INFERENCE time, kept ONLY when reward_signal >= --min-reward (default 0.3).
So the fine-tuned model learns: "for THIS kind of (sentiment, completion,
adaptation list) input, produce explanations that have historically led to
high-reward next reflections." This is the cheapest, most honest form of
RLHF available to a solo developer.

WHEN TO RUN
-----------
NOT before you have ~200 high-reward reflections. Below that, LoRA on a 3B
model will overfit catastrophically — the model will memorize a handful of
explanations and forget how to speak English. The script refuses to write
the dataset under --min-entries (default 200).

USAGE
-----
    python backend/scripts/export_reflections_for_lora.py \\
        --out backend/data/lora \\
        --min-reward 0.3 \\
        --min-entries 200

REQUIRES
--------
    NEXT_PUBLIC_SUPABASE_URL  or SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

OUTPUT
------
    backend/data/lora/train.jsonl    90% of qualifying reflections
    backend/data/lora/valid.jsonl    10% of qualifying reflections

FORMAT
------
mlx-lm "chat" dataset format:
    {"messages": [
        {"role": "system",    "content": "..."},
        {"role": "user",      "content": "..."},
        {"role": "assistant", "content": "..."}
    ]}

NEXT STEP
---------
    bash backend/scripts/local_finetune.sh
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Allow `from database.supabase_client import get_supabase` when invoked
# directly from the repo root.
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from database.supabase_client import get_supabase  # noqa: E402


# Must stay byte-identical to adaptation_agent.py::adapt_path() at line ~190.
# If you ever change the agent's system prompt, regenerate the dataset.
SYSTEM_PROMPT = (
    "You are a coach explaining plan adaptations to a neurodivergent user. "
    "Be supportive, concise (max 50 words), and reference specific reasons."
)


def _build_user_prompt(row: Dict[str, Any]) -> Optional[str]:
    """Reconstruct the exact user message the agent sent at inference time."""
    adaptation = row.get("adaptation_response") or {}
    reflection = row.get("reflection_response") or {}

    adaptations = adaptation.get("adaptations") or []
    if not adaptations:
        return None  # Nothing to explain — not a useful training row.

    types = [a.get("type") for a in adaptations if isinstance(a, dict) and a.get("type")]
    if not types:
        return None

    completion_rate = row.get("completion_rate")
    if completion_rate is None:
        completion_rate = reflection.get("progress", {}).get("completion_rate", 1.0)

    sentiment_label = (
        row.get("sentiment_label")
        or (reflection.get("sentiment") or {}).get("label")
        or "neutral"
    )

    try:
        completion_pct = f"{float(completion_rate):.0%}"
    except (TypeError, ValueError):
        completion_pct = "100%"

    return (
        f"Adaptations: {types}\n"
        f"Completion rate: {completion_pct}\n"
        f"Sentiment: {sentiment_label}\n"
        "Explain why you're making these changes."
    )


def _extract_assistant(row: Dict[str, Any]) -> Optional[str]:
    """Get the (high-reward) explanation the agent produced for this row."""
    adaptation = row.get("adaptation_response") or {}
    text = (adaptation.get("explanation") or "").strip()
    # Filter out the deterministic fallback ("Applied N adaptations based on
    # reflection analysis") that gets stamped when the LLM was disabled.
    if not text or text.lower().startswith("applied "):
        return None
    if len(text) < 25:
        return None
    return text


def _to_messages(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    user = _build_user_prompt(row)
    if user is None:
        return None
    assistant = _extract_assistant(row)
    if assistant is None:
        return None
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


def fetch_rows(min_reward: float) -> List[Dict[str, Any]]:
    sb = get_supabase()
    if sb is None:
        print(
            "ERROR: Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL "
            "and SUPABASE_SERVICE_ROLE_KEY then re-run.",
            file=sys.stderr,
        )
        sys.exit(2)

    print(f"Fetching reflections with reward_signal >= {min_reward}...")
    # Paginate to avoid Supabase's 1000-row default cap.
    rows: List[Dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table("reflections")
            .select(
                "id, user_id, context_type, "
                "sentiment_label, completion_rate, reward_signal, "
                "reflection_response, adaptation_response, created_at"
            )
            .gte("reward_signal", min_reward)
            .order("created_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    print(f"  fetched {len(rows)} rows.")
    return rows


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    p.add_argument("--out", default="backend/data/lora",
                   help="Output directory (will be created).")
    p.add_argument("--min-reward", type=float, default=0.3,
                   help="Minimum reward_signal to include a row.")
    p.add_argument("--min-entries", type=int, default=200,
                   help="Refuse to write the dataset under this many qualifying rows.")
    p.add_argument("--valid-fraction", type=float, default=0.1,
                   help="Fraction of rows to hold out for validation.")
    p.add_argument("--seed", type=int, default=20260621,
                   help="Random seed for the train/valid split.")
    args = p.parse_args()

    rows = fetch_rows(min_reward=args.min_reward)
    examples = [m for m in (_to_messages(r) for r in rows) if m is not None]
    print(f"  {len(examples)} rows produced usable (user, assistant) pairs.")

    if len(examples) < args.min_entries:
        print(
            f"\nABORT: only {len(examples)} qualifying examples (need >= "
            f"{args.min_entries}). LoRA on a 3B model with this little data "
            "will overfit and degrade fluency. Either lower --min-entries (not "
            "recommended) or wait for more reflections.",
            file=sys.stderr,
        )
        return 1

    random.seed(args.seed)
    random.shuffle(examples)
    cut = max(1, int(len(examples) * args.valid_fraction))
    valid, train = examples[:cut], examples[cut:]

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    train_path = out / "train.jsonl"
    valid_path = out / "valid.jsonl"
    with train_path.open("w") as f:
        for ex in train:
            f.write(json.dumps(ex) + "\n")
    with valid_path.open("w") as f:
        for ex in valid:
            f.write(json.dumps(ex) + "\n")

    print(f"\nWrote {len(train)} examples -> {train_path}")
    print(f"Wrote {len(valid)} examples -> {valid_path}")
    print("\nNext: bash backend/scripts/local_finetune.sh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
