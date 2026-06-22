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

    train_weekly()  [@modal.Cron("0 3 * * 0")]
        ├── pull reflections from Supabase via SUPABASE secret
        ├── build chat-format JSONL training corpus
        ├── train LoRA with HF transformers + peft on an A10G
        └── save adapter to Volume

    serve()  [@modal.asgi_app(), @modal.function(gpu="t4")]
        ├── load base model from HF cache
        ├── load LoRA adapter from Volume
        └── expose /v1/chat/completions via vLLM's OpenAI server

Cost estimate (low traffic, weekly retrains)
============================================
    Training:  A10G ~$2.27/hr × 0.5 hr × 4/mo = ~$5/mo
    Serving:   T4 ~$0.59/hr, billed per-second of active GPU time
               (Modal serverless scales to zero when idle)
               At 100 reqs/day × 3 sec each = ~$1.50/mo
    Storage:   2 GB on Volume × $0.16/GB-mo = ~$0.30/mo
    Total:     ~$7/mo

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
    modal run backend/scripts/modal_app.py::train_weekly

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
    to verify Supabase secrets are wired correctly."""
    examples = _fetch_corpus()
    return {
        "qualifying_examples": len(examples),
        "min_required": MIN_ENTRIES_FOR_TRAINING,
        "would_train": len(examples) >= MIN_ENTRIES_FOR_TRAINING,
    }
