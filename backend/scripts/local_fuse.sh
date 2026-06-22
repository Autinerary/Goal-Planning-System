#!/usr/bin/env bash
# ============================================================================
# local_fuse.sh — Merge the LoRA adapter back into the base model weights.
#
# After this runs, you have a single self-contained model directory you can
# serve with mlx_lm.server. The original base model and the adapter are no
# longer needed at inference time.
#
# USAGE
#   bash backend/scripts/local_fuse.sh
#
# OUTPUT
#   backend/data/models/fused/    self-contained MLX model directory
#
# NEXT
#   bash backend/scripts/local_serve.sh
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ -d "$REPO_ROOT/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

ADAPTER_DIR="$REPO_ROOT/backend/data/adapters"
if [[ ! -d "$ADAPTER_DIR" ]]; then
  echo "✗ $ADAPTER_DIR not found. Run local_finetune.sh first." >&2
  exit 1
fi

BASE_MODEL="${BASE_MODEL:-mlx-community/Llama-3.2-3B-Instruct-4bit}"
FUSED_DIR="$REPO_ROOT/backend/data/models/fused"
mkdir -p "$(dirname "$FUSED_DIR")"

echo "Fusing $ADAPTER_DIR into $BASE_MODEL → $FUSED_DIR"

python -m mlx_lm fuse \
  --model "$BASE_MODEL" \
  --adapter-path "$ADAPTER_DIR" \
  --save-path "$FUSED_DIR"

echo ""
echo "✓ Fused model written to $FUSED_DIR/"
echo "  Next: bash backend/scripts/local_serve.sh"
