#!/usr/bin/env bash
# ============================================================================
# local_finetune.sh — LoRA-fine-tune Llama 3.2 3B on your own reflections.
#
# This is the ONLY script in the repo that updates real model weights. It
# does so on your Mac, against a model you own, at $0 marginal cost. The
# LoRA adapter that comes out is yours; nothing leaves the machine.
#
# PREREQS
#   * macOS on Apple Silicon (M1/M2/M3/M4)
#   * Python 3.10+ inside the project venv
#   * ~16 GB unified memory (use BASE_MODEL=mlx-community/Llama-3.2-1B-Instruct-4bit on 8 GB)
#   * ~3 GB free disk for the base model + adapter
#   * backend/data/lora/train.jsonl + valid.jsonl already produced by
#     scripts/export_reflections_for_lora.py
#
# USAGE
#   bash backend/scripts/local_finetune.sh
#
# TUNING (env vars)
#   BASE_MODEL    HuggingFace repo for the base. Default: Llama-3.2-3B-Instruct-4bit
#   ITERS         Training iterations. Default 1000. Below 500 → underfit.
#   BATCH_SIZE    Default 4. Drop to 2 or 1 on 8 GB Macs.
#   LORA_LAYERS   Number of transformer layers that get a LoRA adapter. Default 16.
#   LEARNING_RATE Default 1e-5. Don't touch unless you know why.
#
# OUTPUT
#   backend/data/adapters/adapters.safetensors   the trained LoRA adapter
#
# NEXT
#   bash backend/scripts/local_fuse.sh
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# ---- 1. Platform check ----------------------------------------------------
if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "✗ This script requires macOS on Apple Silicon (got $(uname -s)/$(uname -m))." >&2
  echo "  mlx-lm only runs on Apple Silicon. On Linux/x86 use a different toolchain (Together.ai, etc)." >&2
  exit 1
fi

# ---- 2. Venv check --------------------------------------------------------
if [[ -d "$REPO_ROOT/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

# ---- 3. mlx-lm check ------------------------------------------------------
if ! python -c "import mlx_lm" >/dev/null 2>&1; then
  echo "Installing mlx-lm into the active environment..."
  pip install -q -r "$REPO_ROOT/backend/requirements-local-finetune.txt"
fi

# ---- 4. Dataset check -----------------------------------------------------
DATA_DIR="$REPO_ROOT/backend/data/lora"
if [[ ! -f "$DATA_DIR/train.jsonl" ]]; then
  echo "✗ $DATA_DIR/train.jsonl not found." >&2
  echo "  Run:  python backend/scripts/export_reflections_for_lora.py" >&2
  exit 1
fi
TRAIN_LINES=$(wc -l < "$DATA_DIR/train.jsonl" | tr -d ' ')
echo "Training on $TRAIN_LINES examples from $DATA_DIR/"

# ---- 5. Hyperparameters ---------------------------------------------------
BASE_MODEL="${BASE_MODEL:-mlx-community/Llama-3.2-3B-Instruct-4bit}"
ITERS="${ITERS:-1000}"
BATCH_SIZE="${BATCH_SIZE:-4}"
LORA_LAYERS="${LORA_LAYERS:-16}"
LEARNING_RATE="${LEARNING_RATE:-1e-5}"
ADAPTER_DIR="$REPO_ROOT/backend/data/adapters"
mkdir -p "$ADAPTER_DIR"

cat <<INFO
Base model    : $BASE_MODEL
Iterations    : $ITERS
Batch size    : $BATCH_SIZE
LoRA layers   : $LORA_LAYERS
Learning rate : $LEARNING_RATE
Adapter out   : $ADAPTER_DIR
INFO

# ---- 6. Train -------------------------------------------------------------
# mlx_lm.lora downloads the base model from HuggingFace on first use.
python -m mlx_lm lora \
  --model "$BASE_MODEL" \
  --train \
  --data "$DATA_DIR" \
  --iters "$ITERS" \
  --batch-size "$BATCH_SIZE" \
  --num-layers "$LORA_LAYERS" \
  --learning-rate "$LEARNING_RATE" \
  --adapter-path "$ADAPTER_DIR"

echo ""
echo "✓ LoRA adapter saved to $ADAPTER_DIR/"
echo "  Next: bash backend/scripts/local_fuse.sh"
