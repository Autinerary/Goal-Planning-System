#!/usr/bin/env bash
# ============================================================================
# local_serve.sh — Start an OpenAI-compatible server backed by your fine-tune.
#
# mlx_lm.server exposes a /v1/chat/completions endpoint that speaks the exact
# OpenAI wire protocol, so backend/core/llm.py only needs LOCAL_LLM_BASE_URL
# pointed at it — no SDK swap, no agent changes.
#
# USAGE
#   bash backend/scripts/local_serve.sh                    # foreground
#   nohup bash backend/scripts/local_serve.sh &> /tmp/mlx.log &   # background
#
# Then in the backend's shell, before starting uvicorn:
#   export LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
#   export LOCAL_LLM_MODEL=fused
#   unset  OPENAI_API_KEY      # (optional) force ALL chat completions onto the local model
#
# ENV OVERRIDES
#   HOST   Default 127.0.0.1. Don't expose to 0.0.0.0 unless you mean to.
#   PORT   Default 8080.
#   MODEL_DIR  Default backend/data/models/fused (output of local_fuse.sh).
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ -d "$REPO_ROOT/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
MODEL_DIR="${MODEL_DIR:-$REPO_ROOT/backend/data/models/fused}"

if [[ ! -d "$MODEL_DIR" ]]; then
  echo "✗ $MODEL_DIR not found. Run local_finetune.sh and local_fuse.sh first." >&2
  exit 1
fi

cat <<INFO
Serving $MODEL_DIR
  Host : $HOST
  Port : $PORT
  URL  : http://$HOST:$PORT/v1

In another terminal:
  export LOCAL_LLM_BASE_URL=http://$HOST:$PORT/v1
  export LOCAL_LLM_MODEL=fused
  # (optional) unset OPENAI_API_KEY to force the local model

Ctrl-C to stop.
INFO

exec python -m mlx_lm.server \
  --model "$MODEL_DIR" \
  --host "$HOST" \
  --port "$PORT"
