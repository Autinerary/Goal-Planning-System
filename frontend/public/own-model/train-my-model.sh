#!/usr/bin/env bash
# train-my-model.sh: tune a small open model on your own training set, on your own Mac, and add it to Ollama.
#
#   bash train-my-model.sh my-training-set-2026-10-31.jsonl [model-name]
#
# Everything happens on this computer; nothing is uploaded. It:
#   1. makes a Python environment in ~/.autinerary-model and installs mlx-lm (tools for running and tuning models on
#      a Mac) into it;
#   2. splits your file into a part to learn from and a small part to check against;
#   3. trains a LoRA adapter (a small add-on to the model, a few MB) on Llama 3.2: 3B with 16 GB of memory or more,
#      1B below that. The first time, the base model is downloaded from Hugging Face (about 6.5 GB for 3B, 2.5 GB for
#      1B);
#   4. merges the adapter into the model and adds it to Ollama under the name you chose (default my-model).
#
# Needs: a Mac with Apple silicon (M1 or newer), Python 3.11 or newer, Ollama (https://ollama.com) with the base model
# pulled (ollama pull llama3.2:3b, or llama3.2:1b on a Mac with less than 16 GB), and about 20 GB of free disk space.
#
# You can change, with environment variables:
#   MODEL        llama-3b or llama-1b (default llama-3b, or llama-1b with less than 16 GB of memory); tuning qwen3-4b,
#                which thinks first, is coming soon
#   BASE_MODEL   the model to tune, from Hugging Face (default mlx-community/Llama-3.2-3B-Instruct-bf16, or -1B-)
#   OLLAMA_BASE  the Ollama model with the same chat format (default llama3.2:3b, or llama3.2:1b)
#   EPOCHS       times through your set (default 2; more makes it start repeating your words back)
#   WORK_DIR     where the adapter and the merged model go (default ~/.autinerary-model/<model-name>)
#   FROM_ADAPTER start from a model someone shared (Community models): the .safetensors file, with its
#                .adapter_config.json beside it. Your set tunes it a little further, once through unless EPOCHS says
#                otherwise; the base model and the adapter's shape come from its settings.
#
# Llama 3.2 is under Meta's Llama 3.2 Community License, and a model made from it is too; Qwen3 is under Apache 2.0.
set -euo pipefail

DATA="${1:-}"
NAME="${2:-my-model}"
if [[ -z "$DATA" || ! -f "$DATA" ]]; then
  echo "Usage: bash train-my-model.sh <your training set .jsonl> [model-name]" >&2
  exit 1
fi
if [[ ! "$NAME" =~ ^[a-z0-9][a-z0-9._-]{0,40}$ ]]; then
  echo "✗ Use lower-case letters, numbers, dots, dashes and underscores for the model name." >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "✗ This script needs a Mac with Apple silicon (M1 or newer). Windows and Linux: coming soon." >&2
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

MEMORY_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if (( MEMORY_GB >= 16 )); then SIZE=3B; else SIZE=1B; fi
NUM_LAYERS=8 RANK=8 SCALE=20.0
FROM_ADAPTER="${FROM_ADAPTER:-}"
if [[ -n "$FROM_ADAPTER" ]]; then
  SHARED_CONFIG="${FROM_ADAPTER%.safetensors}.adapter_config.json"
  if [[ "$FROM_ADAPTER" != *.safetensors || ! -f "$FROM_ADAPTER" || ! -f "$SHARED_CONFIG" ]]; then
    echo "✗ FROM_ADAPTER needs the .safetensors file from Community models, with its .adapter_config.json beside it." >&2
    exit 1
  fi
  # The shared adapter's base model and shape, so training picks up where it left off.
  read -r BASE_MODEL NUM_LAYERS RANK SCALE < <("$PYTHON" -c 'import json, sys; c = json.load(open(sys.argv[1])); p = c["lora_parameters"]
print(c["model"], int(c["num_layers"]), int(p["rank"]), float(p["scale"]))' "$SHARED_CONFIG")
  case "$BASE_MODEL" in
    mlx-community/Llama-3.2-1B-Instruct-bf16) OLLAMA_BASE=llama3.2:1b ;;
    mlx-community/Llama-3.2-3B-Instruct-bf16) OLLAMA_BASE=llama3.2:3b ;;
    Qwen/Qwen3-4B) OLLAMA_BASE=qwen3:4b ;;
    *) echo "✗ That adapter starts from $BASE_MODEL, which this script doesn't know." >&2; exit 1 ;;
  esac
  EPOCHS="${EPOCHS:-1}"
fi
case "${MODEL:-}" in
  "") ;;
  llama-3b) BASE_MODEL="${BASE_MODEL:-mlx-community/Llama-3.2-3B-Instruct-bf16}" ;;
  llama-1b) BASE_MODEL="${BASE_MODEL:-mlx-community/Llama-3.2-1B-Instruct-bf16}" ;;
  qwen3-4b)
    # Tested 1 November 2026: tuned on answers without thinking, Qwen3 stopped thinking or couldn't stop; and Ollama
    # 0.40 brings a tuned Qwen3 in through its newer engine, where thinking can't be switched off and 4-bit
    # compression gave nonsense. The untuned qwen3:4b runs fine in Ollama.
    echo "✗ Tuning Qwen3 is coming soon: tuned, it doesn't keep its thinking yet. You can use the untuned qwen3:4b in Ollama, or tune MODEL=llama-3b." >&2
    exit 1 ;;
  *) echo "✗ MODEL is llama-3b or llama-1b." >&2; exit 1 ;;
esac
BASE_MODEL="${BASE_MODEL:-mlx-community/Llama-3.2-$SIZE-Instruct-bf16}"
case "$BASE_MODEL" in
  Qwen/Qwen3-4B) OLLAMA_BASE="${OLLAMA_BASE:-qwen3:4b}" ;;
  *-1B-*) OLLAMA_BASE="${OLLAMA_BASE:-llama3.2:1b}" ;;
  *) OLLAMA_BASE="${OLLAMA_BASE:-llama3.2:$(echo "$SIZE" | tr 'B' 'b')}" ;;
esac
EPOCHS="${EPOCHS:-2}"
HOME_DIR="$HOME/.autinerary-model"
WORK="${WORK_DIR:-$HOME_DIR/$NAME}"

if ! ollama show "$OLLAMA_BASE" >/dev/null 2>&1; then
  echo "✗ Ollama doesn't have $OLLAMA_BASE yet, and it's needed for the chat format. Run: ollama pull $OLLAMA_BASE" >&2
  exit 1
fi

echo "Tuning $BASE_MODEL on $DATA for Ollama as $NAME ($MEMORY_GB GB of memory)."
if [[ -n "$FROM_ADAPTER" ]]; then echo "Starting from $(basename "$FROM_ADAPTER")."; fi
echo "Working in $WORK"

# ---- 1. Tools ----------------------------------------------------------------------------------------------------
if [[ ! -x "$HOME_DIR/venv/bin/python" ]]; then
  mkdir -p "$HOME_DIR"
  "$PYTHON" -m venv "$HOME_DIR/venv"
fi
PY="$HOME_DIR/venv/bin/python"
"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet "mlx-lm==0.32.2"

# ---- 2. Your set: a part to learn from, and at least one batch to check against ------------------------------------
mkdir -p "$WORK/data"
"$PY" - "$DATA" "$WORK/data" <<'SPLIT'
import json, random, sys
source, out = sys.argv[1], sys.argv[2]
examples = []
for number, line in enumerate(open(source, encoding="utf-8"), 1):
    if not line.strip():
        continue
    try:
        roles = [m["role"] for m in json.loads(line)["messages"]]
    except (ValueError, KeyError, TypeError):
        sys.exit(f"✗ Line {number} isn't a chat example. Use the file from Build my training set.")
    if "assistant" not in roles:
        sys.exit(f"✗ Line {number} has no answer to learn from.")
    examples.append(line.strip())
if len(examples) < 5:
    sys.exit(f"✗ {len(examples)} examples is too few to learn from. Approve at least 5 items; a few dozen is better.")
batch = 4 if len(examples) >= 16 else 2 if len(examples) >= 6 else 1
held = max(batch, len(examples) // 10)
random.Random(0).shuffle(examples)
open(f"{out}/valid.jsonl", "w", encoding="utf-8").write("\n".join(examples[:held]) + "\n")
open(f"{out}/train.jsonl", "w", encoding="utf-8").write("\n".join(examples[held:]) + "\n")
open(f"{out}/batch_size", "w").write(str(batch))
print(f"{len(examples) - held} examples to learn from, {held} to check against.")
SPLIT

BATCH=$(cat "$WORK/data/batch_size")
N_TRAIN=$(grep -c . "$WORK/data/train.jsonl")
ITERS=$(( (EPOCHS * N_TRAIN + BATCH - 1) / BATCH ))
(( ITERS >= 10 )) || ITERS=10

# ---- Qwen3 thinks before it answers; your answers don't. So they're learnt without the empty <think></think> that
# comes before them (it's made part of the question, which isn't learnt), and the tuned model still thinks when asked.
TRAIN_MODEL="$BASE_MODEL"
if [[ "$BASE_MODEL" == Qwen/Qwen3* ]]; then
  TRAIN_MODEL="$WORK/base"
  "$PY" - "$BASE_MODEL" "$TRAIN_MODEL" <<'QWEN'
import json, os, sys
from huggingface_hub import snapshot_download
source, target = sys.argv[1], sys.argv[2]
folder = snapshot_download(source, allow_patterns=["*.json", "*.safetensors", "*.txt", "tokenizer*", "merges.txt", "vocab.json"])
os.makedirs(target, exist_ok=True)
for name in os.listdir(folder):
    link = os.path.join(target, name)
    if name != "tokenizer_config.json" and not os.path.lexists(link):
        os.symlink(os.path.join(folder, name), link)
config = json.load(open(os.path.join(folder, "tokenizer_config.json")))
switch = "{%- if enable_thinking is defined and enable_thinking is false %}\n        {{- '<think>\\n\\n</think>\\n\\n' }}\n    {%- endif %}"
if switch not in config["chat_template"]:
    sys.exit("✗ Qwen3's chat template isn't the one this script knows.")
config["chat_template"] = config["chat_template"].replace(switch, "{{- '<think>\\n\\n</think>\\n\\n' }}")
json.dump(config, open(os.path.join(target, "tokenizer_config.json"), "w"))
QWEN
fi

# ---- 3. Train a LoRA adapter, on your answers only (mask_prompt), a little at a time --------------------------------
rm -rf "$WORK/adapter"
cat > "$WORK/lora.yaml" <<YAML
model: "$TRAIN_MODEL"
train: true
fine_tune_type: lora
data: "$WORK/data"
adapter_path: "$WORK/adapter"
batch_size: $BATCH
iters: $ITERS
learning_rate: 5.0e-5
num_layers: $NUM_LAYERS
max_seq_length: 1024
mask_prompt: true
val_batches: -1
steps_per_report: 5
steps_per_eval: $ITERS
save_every: $(( ITERS + 1 ))
seed: 0
lora_parameters:
  rank: $RANK
  scale: $SCALE
  dropout: 0.05
YAML
if [[ -n "$FROM_ADAPTER" ]]; then echo "resume_adapter_file: \"$FROM_ADAPTER\"" >> "$WORK/lora.yaml"; fi
"$PY" -m mlx_lm lora --config "$WORK/lora.yaml"
# The adapter's settings name the model it starts from as people find it (not the folder it was trained from), and,
# started from a shared model, that model, so sharing this one says what it was built on.
"$PY" - "$WORK/adapter/adapter_config.json" "$BASE_MODEL" "${SHARED_CONFIG:-}" <<'SETTINGS'
import json, sys
path, model, shared = sys.argv[1], sys.argv[2], sys.argv[3]
config = json.load(open(path))
config["model"] = model
if shared:
    shared_id = json.load(open(shared)).get("shared_id")
    if shared_id:
        config["built_on"] = shared_id
json.dump(config, open(path, "w"), indent=4)
SETTINGS

# ---- 4. Merge it into the model, and add that to Ollama with the base model's chat format ---------------------------
rm -rf "$WORK/merged"
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
# Ollama keeps its own copy; the merged one here is several GB.
rm -rf "$WORK/merged"

echo ""
echo "✓ Done: Ollama has $NAME."
echo "  Try it:  ollama run $NAME \"What's one small first step toward swimming once a week?\""
echo "  Use it:  in Autinerary, Settings, Models, Use my own model, set the model name to $NAME."
echo "  The adapter (the part that's yours, a few MB) is in $WORK/adapter."
