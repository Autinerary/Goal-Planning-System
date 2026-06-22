"""
Modal app — cloud-deployed automated LoRA fine-tuning + serverless serving.

The no-Mac fallback for path A (local mlx-lm + Cloudflare Tunnel). Runs
entirely in Modal's cloud: weekly cron does the training, web endpoint
serves OpenAI-compatible inference. Your deployed backend points
LOCAL_LLM_BASE_URL at the Modal endpoint and that's it.

Architecture
============
    Modal Volume "goal-planning-adapter"
        ├── adapter/   (LoRA weights, written by train, read by serve)
        └── (base model cached by HuggingFace inside the image)

    train_weekly()  [@modal.Cron("0 3 * * 0")]   Sunday  — SFT pass
        ├── pull HIGH-REWARD reflections from Supabase via SUPABASE secret
        ├── build chat-format JSONL training corpus
        ├── train LoRA with HF transformers + peft on an A10G (SFTTrainer)
        └── save adapter to Volume

    train_dpo_weekly()  [@modal.Cron("0 3 * * 3")]   Wednesday — RLHF pass
        ├── pull ALL reflections with reward_signal (positive AND negative)
        ├── group by (sentiment, adaptation_types, completion_bucket) so
        │     paired explanations really share a prompt
        ├── build {prompt, chosen, rejected} preference pairs using the
        │     bandit reward signal as the gradient direction
        ├── refine the SFT adapter with DPOTrainer on the same A10G
        └── overwrite adapter in Volume (atomic swap)

    serve()  [@modal.asgi_app(), @modal.function(gpu="t4")]
        ├── load base model from HF cache
        ├── load LoRA adapter from Volume (either SFT or DPO-refined)
        └── expose /v1/chat/completions via vLLM's OpenAI server

This is the bridge from the LIVE bandit-RL loop (re-ranks OpenAI output
in SQL aggregates) to actual MODEL WEIGHT updates. SFT teaches the model
what good explanations look like; DPO uses the reward signal to push the
model AWAY from low-reward explanations and TOWARD high-reward ones —
true RLHF, no preference-model needed.

Cost estimate (low traffic, weekly retrains)
============================================
    SFT training:   A10G ~$2.27/hr × 0.5 hr × 4/mo = ~$5/mo
    DPO training:   A10G ~$2.27/hr × 0.5 hr × 4/mo = ~$5/mo
    Serving:        T4 ~$0.59/hr, billed per-second of active GPU time
                    (Modal serverless scales to zero when idle)
                    At 100 reqs/day × 3 sec each = ~$1.50/mo
    Storage:        2 GB on Volume × $0.16/GB-mo = ~$0.30/mo
    Total:          ~$12/mo with both SFT + DPO; ~$7/mo if you disable DPO

Deploy
======
    pip install modal
    modal token new           (one-time browser auth)

    # Create the secrets Modal will inject at runtime:
    modal secret create supabase \\
        NEXT_PUBLIC_SUPABASE_URL=https://<...>.supabase.co \\
        SUPABASE_SERVICE_ROLE_KEY=<svc-role-key>

    # Optional, only needed for gated HF models (Llama, Mistral, etc.):
    modal secret create huggingface HF_TOKEN=hf_xxx

    modal deploy backend/scripts/modal_app.py

    # Then in your DEPLOYED backend's env:
    LOCAL_LLM_BASE_URL=https://<your-modal-username>--goal-planning-llm-serve.modal.run/v1
    LOCAL_LLM_MODEL=goal-coach-lora

Manually trigger a training run (test)
======================================
    modal run backend/scripts/modal_app.py::train_weekly      # SFT
    modal run backend/scripts/modal_app.py::train_dpo_weekly  # DPO (needs SFT adapter first)

Tail logs
=========
    modal app logs goal-planning-llm
"""

from __future__ import annotations

import os
from pathlib import Path

import modal

# ---------------------------------------------------------------------------
# Configuration. Override via Modal secrets or env vars at deploy time.
# ---------------------------------------------------------------------------

APP_NAME = "goal-planning-llm"

# Default base model. NOT gated (no HF auth needed). Override with
# BASE_MODEL env var if you have a gated Llama/Mistral key set up.
BASE_MODEL = os.getenv("MODAL_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")

# Where the LoRA adapter lives inside the running container.
VOLUME_NAME = "goal-planning-adapter"
ADAPTER_DIR_IN_CONTAINER = "/adapter"
ADAPTER_NAME = "goal-coach-lora"

# How many qualifying high-reward reflections we need before retraining.
# Below this, a LoRA on a 7B will overfit. Keep this in sync with the
# value in export_reflections_for_lora.py.
MIN_ENTRIES_FOR_TRAINING = 200
MIN_REWARD_TO_INCLUDE = 0.3

# ---------------------------------------------------------------------------
# DPO (Direct Preference Optimization) thresholds.
#
# DPO is sample-efficient — 50 well-formed preference pairs is enough to
# nudge a 7B LoRA in a measurable direction. Below this, the update is
# pure noise. The thresholds carve up reflections into a "chosen" pool
# (high reward, what we want more of) and a "rejected" pool (low reward,
# what we want less of). The gap between them is the learning signal.
# ---------------------------------------------------------------------------
MIN_DPO_PAIRS = 50
MIN_REWARD_FOR_CHOSEN = 0.5     # Reflections >= this are candidates for "chosen"
MAX_REWARD_FOR_REJECTED = 0.0   # Reflections <= this are candidates for "rejected"
# A LoRA-on-LoRA DPO needs the SFT adapter as the starting point. Without
# it, DPO has nothing to refine and tends to collapse the base model.
DPO_REQUIRES_SFT_ADAPTER = True

# Persistent volume shared by train + serve.
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# ---------------------------------------------------------------------------
# Container images.
# Training and serving have different dep sets — keep them separate so we
# don't ship vLLM to the training box or PEFT/trl to the inference box.
# ---------------------------------------------------------------------------

train_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install(
        "torch==2.4.0",
        "transformers>=4.44.0",
        "peft>=0.12.0",
        "accelerate>=0.33.0",
        "datasets>=2.20.0",
        "bitsandbytes>=0.43.0",  # 4-bit quantized base for cheaper training
        "trl>=0.9.0",            # SFTTrainer convenience wrapper
        "supabase>=2.6.0",
    )
)

serve_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install(
        "vllm>=0.6.0",
        "fastapi>=0.115.0",
    )
)

app = modal.App(APP_NAME)

# Secrets must exist BEFORE deploy. See module docstring for `modal secret create`.
SUPABASE_SECRET = modal.Secret.from_name(
    "supabase", required_keys=["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
)
HF_SECRET = modal.Secret.from_name(
    "huggingface", required_keys=["HF_TOKEN"]
)


# ===========================================================================
# Helper: pull reflections from Supabase and build the chat-format training
# corpus. The transformation rules are the same as
# backend/scripts/export_reflections_for_lora.py — kept inline here so this
# Modal app is self-contained (Modal containers don't have your local repo).
# ===========================================================================

def _build_user_prompt(row: dict) -> str | None:
    adaptation_response = row.get("adaptation_response") or {}
    adaptations = adaptation_response.get("adaptations") or []
    if not adaptations:
        return None
    types = ", ".join(a.get("type", "") for a in adaptations if a.get("type"))
    if not types:
        return None
    completion = row.get("completion_rate")
    completion_str = f"{completion:.0%}" if isinstance(completion, (int, float)) else "unknown"
    sentiment = row.get("sentiment_label") or "neutral"
    return (
        f"Suggested adaptations: {types}. Completion rate: {completion_str}. "
        f"Sentiment: {sentiment}. Explain in 2-3 sentences why this is the "
        f"right adaptation."
    )


def _extract_assistant(row: dict) -> str | None:
    adaptation_response = row.get("adaptation_response") or {}
    explanation = (adaptation_response.get("explanation") or "").strip()
    if not explanation:
        return None
    if explanation.startswith("Applied "):
        # Deterministic no-LLM fallback string — useless as training signal.
        return None
    if len(explanation) < 25:
        return None
    return explanation


SYSTEM_PROMPT = (
    "You are an adaptive goal-planning coach. Given an adaptation type and "
    "the user's recent completion rate and sentiment, briefly explain why "
    "this adaptation will help them, in 2-3 sentences. Be specific and "
    "encouraging."
)


def _to_messages(row: dict) -> dict | None:
    user = _build_user_prompt(row)
    assistant = _extract_assistant(row)
    if not user or not assistant:
        return None
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


def _fetch_corpus() -> list[dict]:
    """Pull qualifying reflections from Supabase. Runs INSIDE the Modal container."""
    from supabase import create_client  # imported here so it lives in train_image only

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sb = create_client(url, key)

    rows: list[dict] = []
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
            .gte("reward_signal", MIN_REWARD_TO_INCLUDE)
            .order("created_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    messages = [m for m in (_to_messages(r) for r in rows) if m is not None]
    print(f"  fetched {len(rows)} rows, {len(messages)} usable training examples.")
    return messages


# ===========================================================================
# DPO preference-pair builder.
#
# This is where the bandit-reward signal (used live for re-ranking) crosses
# over into the foundation-model weight space (RLHF). For each "situation"
# (sentiment + adaptation_types + completion bucket) we collect every
# explanation the LLM has produced, then pair the highest-reward ones
# against the lowest-reward ones. DPO uses those pairs as gradient signal:
# "given the same prompt, push the model toward `chosen`, away from
# `rejected`."
# ===========================================================================

def _completion_bucket(rate: float | int | None) -> str:
    """Coarse bucketing so we group situations, not exact rates. Three
    buckets give us enough resolution without splintering the sample."""
    if rate is None or not isinstance(rate, (int, float)):
        return "unknown"
    if rate < 0.3:
        return "low"
    if rate < 0.7:
        return "med"
    return "high"


def _situation_key(row: dict) -> tuple | None:
    """The DPO "prompt is the same" key. Two reflections share a situation
    if they have the same sentiment, the same set of adaptation types, and
    the same completion bucket. Returns None for rows we can't compare."""
    adaptation = row.get("adaptation_response") or {}
    adaptations = adaptation.get("adaptations") or []
    if not adaptations:
        return None
    types = tuple(
        sorted(a.get("type", "") for a in adaptations if isinstance(a, dict) and a.get("type"))
    )
    if not types:
        return None
    sentiment = (row.get("sentiment_label") or "neutral").lower()
    bucket = _completion_bucket(row.get("completion_rate"))
    return (sentiment, types, bucket)


def _build_dpo_pairs() -> list[dict]:
    """Pull reflections from Supabase and build DPO-format preference pairs.

    Returns a list of `{"prompt": ..., "chosen": ..., "rejected": ...}`
    dicts ready for `DPOTrainer`. Reads INSIDE the Modal container —
    requires SUPABASE secrets in the function env.

    Strategy:
      1. Fetch every reflection that has a non-empty adaptation explanation
         AND a non-null reward_signal (regardless of sign — we need both
         positives and negatives).
      2. Group rows by `_situation_key` so paired rows really do share a
         prompt structure.
      3. Inside each group, build the cartesian product of (chosen pool,
         rejected pool), capped per-group so one common situation doesn't
         dominate the corpus.
    """
    from supabase import create_client

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sb = create_client(url, key)

    rows: list[dict] = []
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
            .not_.is_("reward_signal", "null")
            .order("created_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    # Bucket every row by (situation, polarity).
    from collections import defaultdict
    chosen_by_situation: dict[tuple, list[dict]] = defaultdict(list)
    rejected_by_situation: dict[tuple, list[dict]] = defaultdict(list)

    for row in rows:
        prompt = _build_user_prompt(row)
        explanation = _extract_assistant(row)
        if not prompt or not explanation:
            continue
        sit = _situation_key(row)
        if sit is None:
            continue
        reward = row.get("reward_signal")
        if not isinstance(reward, (int, float)):
            continue
        entry = {"prompt": prompt, "response": explanation, "reward": float(reward)}
        if reward >= MIN_REWARD_FOR_CHOSEN:
            chosen_by_situation[sit].append(entry)
        elif reward <= MAX_REWARD_FOR_REJECTED:
            rejected_by_situation[sit].append(entry)

    # For each situation, pair the strongest chosen with the weakest rejected.
    # Cap at PER_SITUATION_CAP pairs so a single very common situation can't
    # bias the whole training run.
    PER_SITUATION_CAP = 8
    pairs: list[dict] = []
    for sit, chosens in chosen_by_situation.items():
        rejects = rejected_by_situation.get(sit, [])
        if not rejects:
            continue
        # Sort chosens descending by reward, rejects ascending. Highest signal
        # first — the largest reward gap is the cleanest gradient.
        chosens_sorted = sorted(chosens, key=lambda x: x["reward"], reverse=True)
        rejects_sorted = sorted(rejects, key=lambda x: x["reward"])
        n = min(len(chosens_sorted), len(rejects_sorted), PER_SITUATION_CAP)
        for i in range(n):
            c = chosens_sorted[i]
            r = rejects_sorted[i]
            pairs.append({
                "prompt": (
                    f"<|system|>\n{SYSTEM_PROMPT}\n<|user|>\n{c['prompt']}\n<|assistant|>\n"
                ),
                "chosen":   c["response"],
                "rejected": r["response"],
            })

    print(
        f"  built {len(pairs)} DPO pairs across {len(chosen_by_situation)} situations "
        f"(reward gap: chosen >= {MIN_REWARD_FOR_CHOSEN}, rejected <= {MAX_REWARD_FOR_REJECTED})."
    )
    return pairs


# ===========================================================================
# Training. Triggered weekly by Modal cron, or manually via `modal run`.
# ===========================================================================

@app.function(
    image=train_image,
    gpu="A10G",
    volumes={ADAPTER_DIR_IN_CONTAINER: volume},
    secrets=[SUPABASE_SECRET, HF_SECRET],
    timeout=60 * 60 * 3,  # 3 hours max; LoRA on 7B usually finishes in <1 hr
    schedule=modal.Cron("0 3 * * 0"),  # Sunday 03:00 UTC
)
def train_weekly() -> dict:
    """Pull latest reflections → fine-tune LoRA → save adapter to Volume.

    Idempotent and safe to skip-if-not-enough-data: if the corpus is too
    small, returns early without overwriting the previous good adapter.
    """
    import json
    import shutil
    import tempfile
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import SFTConfig, SFTTrainer
    import torch

    examples = _fetch_corpus()

    if len(examples) < MIN_ENTRIES_FOR_TRAINING:
        msg = (
            f"Only {len(examples)} qualifying examples "
            f"(need >= {MIN_ENTRIES_FOR_TRAINING}). Skipping retrain. "
            f"Previous adapter (if any) continues to serve."
        )
        print(msg)
        return {"status": "skipped", "examples": len(examples), "message": msg}

    ds = Dataset.from_list(examples)

    print(f"Loading base model {BASE_MODEL} (this may take a few minutes on first run)...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    base = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
    )

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        # Standard target modules for Llama-family architectures.
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )

    # Train into a tempdir, then atomically swap into the Volume so we
    # never have a half-written adapter visible to the serve function.
    with tempfile.TemporaryDirectory() as tmp:
        sft_config = SFTConfig(
            output_dir=tmp,
            num_train_epochs=3,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            learning_rate=2e-4,  # standard for LoRA SFT
            warmup_ratio=0.03,
            logging_steps=10,
            save_strategy="no",
            bf16=True,
            optim="paged_adamw_8bit",
            max_seq_length=2048,
            packing=False,
            report_to="none",
        )

        trainer = SFTTrainer(
            model=base,
            args=sft_config,
            train_dataset=ds,
            peft_config=lora_config,
            tokenizer=tokenizer,
        )

        print(f"Starting training on {len(examples)} examples...")
        trainer.train()
        print("Training complete. Saving adapter...")

        # Save into Volume via tempdir → atomic move.
        save_dir = Path(tmp) / "adapter"
        trainer.model.save_pretrained(str(save_dir))
        tokenizer.save_pretrained(str(save_dir))

        # Atomic swap: write to a sibling dir then rename. This avoids the
        # serve function reading a half-written adapter during the move.
        target = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter"
        staging = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter.new"
        if staging.exists():
            shutil.rmtree(staging)
        shutil.copytree(save_dir, staging)
        if target.exists():
            backup = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter.prev"
            if backup.exists():
                shutil.rmtree(backup)
            shutil.move(str(target), str(backup))
        shutil.move(str(staging), str(target))

        # Write a metadata sidecar so /v1/models can report training info.
        metadata = {
            "trained_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "base_model": BASE_MODEL,
            "examples": len(examples),
            "adapter_name": ADAPTER_NAME,
        }
        (Path(ADAPTER_DIR_IN_CONTAINER) / "metadata.json").write_text(
            json.dumps(metadata, indent=2)
        )

    # Required for Modal Volumes — make the writes visible to future containers.
    volume.commit()

    print(f"✓ Adapter saved. {len(examples)} examples trained.")
    return {"status": "trained", "examples": len(examples), **metadata}


# ===========================================================================
# DPO refinement. Runs Wednesdays (3 days after the Sunday SFT run), so
# every adapter shipped by the serve function has been:
#   1. Pre-trained by SFT on high-reward examples (Sunday), then
#   2. Refined by DPO on chosen-vs-rejected pairs (Wednesday).
#
# DPO turns the bandit reward signal into actual weight updates — this is
# the RLHF step. Compared to SFT it:
#   * uses BOTH good and bad explanations (SFT only saw the good ones)
#   * compares pairs directly, no preference-model needed
#   * is more sample-efficient (50 pairs is enough to move the needle)
#
# Cost: same A10G as SFT, runs in ~30 min on 200-500 pairs → ~$1/run.
# ===========================================================================

@app.function(
    image=train_image,
    gpu="A10G",
    volumes={ADAPTER_DIR_IN_CONTAINER: volume},
    secrets=[SUPABASE_SECRET, HF_SECRET],
    timeout=60 * 60 * 3,
    schedule=modal.Cron("0 3 * * 3"),  # Wednesday 03:00 UTC (SFT runs Sundays)
)
def train_dpo_weekly() -> dict:
    """Refine the SFT LoRA adapter with DPO using bandit-reward preference pairs.

    Idempotent and conservative: if there's no existing SFT adapter, or
    too few preference pairs, it returns early without touching the live
    adapter. Writes through a staging dir so partial writes can never be
    served.
    """
    import json
    import shutil
    import tempfile
    from datasets import Dataset
    from peft import LoraConfig, PeftModel
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import DPOConfig, DPOTrainer
    import torch

    pairs = _build_dpo_pairs()

    if len(pairs) < MIN_DPO_PAIRS:
        msg = (
            f"Only {len(pairs)} DPO pairs "
            f"(need >= {MIN_DPO_PAIRS}). Skipping DPO refinement. "
            f"Previous adapter (if any) continues to serve."
        )
        print(msg)
        return {"status": "skipped", "pairs": len(pairs), "message": msg}

    adapter_path = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter"
    if DPO_REQUIRES_SFT_ADAPTER and not adapter_path.exists():
        msg = (
            "No SFT adapter found in Volume. DPO needs an SFT-pretrained "
            "starting point to avoid collapsing the base model. Run "
            "train_weekly first, then re-run DPO."
        )
        print(msg)
        return {"status": "skipped", "reason": "no_sft_adapter", "message": msg}

    ds = Dataset.from_list(pairs)
    # DPO needs a holdout for the eval loss curve. 10% is fine.
    splits = ds.train_test_split(test_size=0.1, seed=42)
    train_ds, eval_ds = splits["train"], splits["test"]

    print(f"Loading base model {BASE_MODEL} with 4-bit quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    base = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
    )

    # Load the SFT LoRA adapter as the trainable starting point.
    print(f"Loading SFT adapter from {adapter_path} as DPO starting point...")
    model = PeftModel.from_pretrained(base, str(adapter_path), is_trainable=True)
    # The reference model is the same architecture WITHOUT the adapter active.
    # DPOTrainer with ref_model=None uses the disabled-adapter path, which
    # is the standard pattern for LoRA-DPO and avoids loading a second 7B
    # into GPU memory.

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )

    with tempfile.TemporaryDirectory() as tmp:
        dpo_config = DPOConfig(
            output_dir=tmp,
            num_train_epochs=1,                # DPO over-trains fast; 1 epoch is plenty
            per_device_train_batch_size=1,     # DPO doubles memory (chosen + rejected)
            gradient_accumulation_steps=8,
            learning_rate=5e-6,                # 40x lower than SFT — DPO needs gentle updates
            warmup_ratio=0.1,
            logging_steps=10,
            eval_strategy="steps",
            eval_steps=50,
            save_strategy="no",
            bf16=True,
            optim="paged_adamw_8bit",
            beta=0.1,                          # DPO temperature: how strongly to prefer chosen
            max_prompt_length=1024,
            max_length=2048,
            remove_unused_columns=False,
            report_to="none",
        )

        trainer = DPOTrainer(
            model=model,
            ref_model=None,                    # Use disabled-adapter path (LoRA-DPO standard)
            args=dpo_config,
            train_dataset=train_ds,
            eval_dataset=eval_ds,
            tokenizer=tokenizer,
            peft_config=lora_config,
        )

        print(f"Starting DPO training on {len(train_ds)} pairs ({len(eval_ds)} eval)...")
        trainer.train()
        print("DPO complete. Saving refined adapter...")

        save_dir = Path(tmp) / "adapter"
        trainer.model.save_pretrained(str(save_dir))
        tokenizer.save_pretrained(str(save_dir))

        # Atomic swap — same pattern as SFT.
        target = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter"
        staging = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter.new"
        if staging.exists():
            shutil.rmtree(staging)
        shutil.copytree(save_dir, staging)
        if target.exists():
            backup = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter.prev"
            if backup.exists():
                shutil.rmtree(backup)
            shutil.move(str(target), str(backup))
        shutil.move(str(staging), str(target))

        metadata = {
            "trained_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "base_model": BASE_MODEL,
            "trainer": "DPOTrainer",
            "pairs": len(pairs),
            "train_pairs": len(train_ds),
            "eval_pairs": len(eval_ds),
            "min_reward_chosen": MIN_REWARD_FOR_CHOSEN,
            "max_reward_rejected": MAX_REWARD_FOR_REJECTED,
            "adapter_name": ADAPTER_NAME,
        }
        (Path(ADAPTER_DIR_IN_CONTAINER) / "metadata.json").write_text(
            json.dumps(metadata, indent=2)
        )

    volume.commit()

    print(f"✓ DPO-refined adapter saved. {len(pairs)} preference pairs trained.")
    return {"status": "trained", "pairs": len(pairs), **metadata}


# ===========================================================================
# Serving. OpenAI-compatible web endpoint that loads base model + LoRA
# from the Volume and exposes /v1/chat/completions.
#
# Runs on a T4 (cheapest GPU on Modal). For lower latency on production
# loads, upgrade to gpu="A10G" or gpu="L4".
# ===========================================================================

@app.function(
    image=serve_image,
    gpu="T4",
    volumes={ADAPTER_DIR_IN_CONTAINER: volume},
    secrets=[HF_SECRET],
    timeout=60 * 60,  # 1 hour idle keep-alive
    # min_containers=0 by default → scales to zero when idle (cold starts).
    # For zero cold starts at low traffic, set min_containers=1 (costs ~$14/mo for T4).
)
@modal.asgi_app()
def serve():
    """OpenAI-compatible web endpoint. Routes /v1/chat/completions to vLLM."""
    from fastapi import FastAPI
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.entrypoints.openai.api_server import (
        build_app as build_vllm_app,
        init_app_state,
    )
    from vllm.engine.async_llm_engine import AsyncLLMEngine

    adapter_path = Path(ADAPTER_DIR_IN_CONTAINER) / "adapter"
    if not adapter_path.exists():
        # No adapter yet — serve the base model only. The /v1/models route
        # will report "no adapter loaded" so the backend can fall back.
        print("No adapter found in Volume yet — serving base model only.")
        lora_modules = None
    else:
        lora_modules = [f"{ADAPTER_NAME}={adapter_path}"]
        print(f"Loading LoRA adapter: {ADAPTER_NAME} from {adapter_path}")

    engine_args = AsyncEngineArgs(
        model=BASE_MODEL,
        dtype="bfloat16",
        max_model_len=4096,
        enable_lora=lora_modules is not None,
        max_lora_rank=16,
        max_loras=1,
    )
    engine = AsyncLLMEngine.from_engine_args(engine_args)

    fastapi_app: FastAPI = build_vllm_app(args=None)
    init_app_state(
        engine=engine,
        model_config=engine.engine.model_config,
        state=fastapi_app.state,
        args=engine_args,
        lora_modules=lora_modules,
    )
    return fastapi_app


# ===========================================================================
# Local entrypoint for one-off testing without deploying.
#   modal run backend/scripts/modal_app.py::train_weekly
# ===========================================================================

@app.local_entrypoint()
def main() -> None:
    """`modal run modal_app.py` — quick smoke: fetch corpus, don't train."""
    result = _smoke_fetch_only.remote()
    print(result)


@app.function(
    image=train_image,
    secrets=[SUPABASE_SECRET],
    timeout=60,
)
def _smoke_fetch_only() -> dict:
    """Pull the corpus once and report counts — no training. Useful pre-deploy
    to verify Supabase secrets are wired correctly. Reports both the SFT
    example count AND the DPO preference pair count so you can tell at a
    glance which trainer has enough data to run."""
    examples = _fetch_corpus()
    pairs = _build_dpo_pairs()
    return {
        "sft_qualifying_examples": len(examples),
        "sft_min_required": MIN_ENTRIES_FOR_TRAINING,
        "sft_would_train": len(examples) >= MIN_ENTRIES_FOR_TRAINING,
        "dpo_preference_pairs": len(pairs),
        "dpo_min_required": MIN_DPO_PAIRS,
        "dpo_would_train": len(pairs) >= MIN_DPO_PAIRS,
    }
