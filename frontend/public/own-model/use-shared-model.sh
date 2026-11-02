#!/usr/bin/env bash
# use-shared-model.sh: add a starter model someone shared (Autinerary, Settings, Models, Community models) to Ollama on
# your own Mac.
#
#   bash use-shared-model.sh ~/Downloads/calm-first-steps.safetensors [model-name]
#
# Community models gives you two files; keep them side by side: <name>.safetensors (the adapter) and
# <name>.adapter_config.json (its settings). This puts the adapter together with the model it starts from (downloaded
# once from Hugging Face) and adds the result to Ollama under the model name (default: the file's name). Nothing is
# uploaded. To tune it a little with your own writing afterwards, see train-my-model.sh (FROM_ADAPTER).
#
# Needs: a Mac with Apple silicon (M1 or newer), Python 3.11 or newer, Ollama (https://ollama.com) with the model it
# starts from pulled (Community models says which: ollama pull llama3.2:3b or llama3.2:1b), and about 15 GB of free
# disk space.
#
# Llama 3.2 is under Meta's Llama 3.2 Community License, and a model made from it is too.
set -euo pipefail

WEIGHTS="${1:-}"
if [[ -z "$WEIGHTS" || ! -f "$WEIGHTS" || "$WEIGHTS" != *.safetensors ]]; then
  echo "Usage: bash use-shared-model.sh <the .safetensors file from Community models> [model-name]" >&2
  exit 1
fi
CONFIG="${WEIGHTS%.safetensors}.adapter_config.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "✗ $CONFIG isn't there. Download both files from Community models and keep them side by side." >&2
  exit 1
fi
NAME="${2:-$(basename "${WEIGHTS%.safetensors}")}"
if [[ ! "$NAME" =~ ^[a-z0-9][a-z0-9._-]{0,40}$ ]]; then
  echo "✗ Use lower-case letters, numbers, dots, dashes and underscores for the model name." >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "✗ This script needs a Mac with Apple silicon (M1 or newer). On Windows or Linux, use autinerary_model.py serve (from the same page)." >&2
  exit 1
fi
if ! command -v ollama >/dev/null 2>&1; then
  echo "✗ Install Ollama from https://ollama.com first, and open it." >&2
  exit 1
fi

PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3; do
  if command -v "$candidate" >/dev/null 2>&1 &&
     "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    PYTHON="$(command -v "$candidate")"
    break
  fi
done
if [[ -z "$PYTHON" ]]; then
  echo "✗ This needs Python 3.11 or newer: install it from https://www.python.org/downloads/ (or: brew install python@3.12)." >&2
  exit 1
fi

BASE_MODEL="$("$PYTHON" -c 'import json, sys; print(json.load(open(sys.argv[1]))["model"])' "$CONFIG")"
case "$BASE_MODEL" in
  mlx-community/Llama-3.2-1B-Instruct-bf16) OLLAMA_BASE=llama3.2:1b ;;
  mlx-community/Llama-3.2-3B-Instruct-bf16) OLLAMA_BASE=llama3.2:3b ;;
  Qwen/Qwen3-4B) echo "✗ Ollama can't switch a tuned Qwen3's thinking off, so this script can't add one. Use one tuned from Llama 3.2." >&2; exit 1 ;;
  *) echo "✗ This adapter starts from $BASE_MODEL, which this script doesn't know." >&2; exit 1 ;;
esac
if ! ollama show "$OLLAMA_BASE" >/dev/null 2>&1; then
  echo "✗ Ollama doesn't have $OLLAMA_BASE yet, and it's needed for the chat format. Run: ollama pull $OLLAMA_BASE" >&2
  exit 1
fi

HOME_DIR="$HOME/.autinerary-model"
WORK="$HOME_DIR/shared/$NAME"
echo "Adding $(basename "$WEIGHTS") (it starts from $BASE_MODEL) to Ollama as $NAME."

# ---- Tools ---------------------------------------------------------------------------------------------------------
if [[ ! -x "$HOME_DIR/venv/bin/python" ]]; then
  mkdir -p "$HOME_DIR"
  "$PYTHON" -m venv "$HOME_DIR/venv"
fi
PY="$HOME_DIR/venv/bin/python"
"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet "mlx-lm==0.32.2"

# ---- The adapter, as mlx-lm expects it, then merged into the model and added to Ollama -------------------------------
rm -rf "$WORK"
mkdir -p "$WORK/adapter"
cp "$WEIGHTS" "$WORK/adapter/adapters.safetensors"
cp "$CONFIG" "$WORK/adapter/adapter_config.json"
"$PY" -m mlx_lm fuse --model "$BASE_MODEL" --adapter-path "$WORK/adapter" --save-path "$WORK/merged"
# Ollama reads the model's own config and tokenizer files: the copies mlx-lm writes back can differ (a Qwen3 merged this
# way came out of Ollama as nonsense until the originals were put back), so the originals go beside the merged weights.
"$PY" - "$BASE_MODEL" "$WORK/merged" <<'ORIGINALS'
import os, shutil, sys
from huggingface_hub import snapshot_download
folder = snapshot_download(sys.argv[1], allow_patterns=["*.json", "*.txt", "tokenizer*", "vocab.json", "merges.txt"])
for name in os.listdir(folder):
    if not name.endswith(".safetensors") and name != "model.safetensors.index.json":
        shutil.copyfile(os.path.join(folder, name), os.path.join(sys.argv[2], name))
for extra in ("chat_template.jinja",):
    if os.path.exists(os.path.join(sys.argv[2], extra)) and not os.path.exists(os.path.join(folder, extra)):
        os.remove(os.path.join(sys.argv[2], extra))
ORIGINALS
ollama show --modelfile "$OLLAMA_BASE" |
  awk -v from="FROM $WORK/merged" '!done && /^FROM / { print from; done = 1; next } { print }' > "$WORK/Modelfile"
# Compressed to 4 bits so it runs fast: older Ollama calls that q4_K_M, newer Ollama int4. Uncompressed if neither works.
ollama create "$NAME" --quantize q4_K_M -f "$WORK/Modelfile" 2>/dev/null ||
  ollama create "$NAME" --quantize int4 -f "$WORK/Modelfile" ||
  ollama create "$NAME" -f "$WORK/Modelfile"
rm -rf "$WORK/merged"

echo ""
echo "✓ Done: Ollama has $NAME."
echo "  Try it:  ollama run $NAME \"What's one small first step toward swimming once a week?\""
echo "  Use it:  in Autinerary, Settings, Models, Use my own model, set the model name to $NAME."
echo "  Tune it a little with your own writing:"
echo "           FROM_ADAPTER=$WEIGHTS bash train-my-model.sh <your training set .jsonl> my-$NAME"
