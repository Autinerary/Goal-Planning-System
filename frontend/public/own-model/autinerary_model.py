#!/usr/bin/env python3
"""autinerary_model.py: tune a small open model on your own training set, or adopt one someone shared, on a Windows or
Linux computer with an NVIDIA graphics card, and add it to Ollama. (On a Mac, train-my-model.sh and use-shared-model.sh
are faster; this works there too, more slowly.)

  python autinerary_model.py train my-training-set-2026-10-31.jsonl [model-name] [--base llama-3b|llama-1b|qwen3-4b]
                                   [--from shared.safetensors] [--epochs N]
  python autinerary_model.py adopt calm-first-steps.safetensors [model-name]

Everything happens on this computer; nothing is uploaded. The first run makes a Python environment in
~/.autinerary-model/torch and installs PyTorch (with NVIDIA's CUDA), transformers and PEFT into it (a few GB), and the
base model is downloaded from Hugging Face once (about 6.5 GB for Llama 3.2 3B, 2.5 GB for 1B, 8 GB for Qwen3 4B).

The adapter it makes is saved the way the Mac script saves one (mlx-lm's format), so a model tuned on a PC can be shared
and adopted on a Mac, and the other way round. Needs Python 3.10 or newer and Ollama (https://ollama.com), with the model
it starts from pulled (ollama pull llama3.2:3b, llama3.2:1b or qwen3:4b).

Llama 3.2 is under Meta's Llama 3.2 Community License, and a model made from it is too; Qwen3 is under Apache 2.0.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import pathlib
import random
import re
import shutil
import subprocess
import sys

HOME = pathlib.Path.home() / ".autinerary-model"
VENV = HOME / "torch"
# name: (the model on Hugging Face, the Ollama model with its chat format)
BASES = {
    "llama-1b": ("mlx-community/Llama-3.2-1B-Instruct-bf16", "llama3.2:1b"),
    "llama-3b": ("mlx-community/Llama-3.2-3B-Instruct-bf16", "llama3.2:3b"),
    "qwen3-4b": ("Qwen/Qwen3-4B", "qwen3:4b"),
}
OLLAMA_FOR = {repo: ollama for repo, ollama in BASES.values()}
MODULES = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
# The same as the Mac script: rank 8 on the last 8 layers, scale 20, a little dropout, 2 passes, learning rate 5e-5.
RANK, SCALE, DROPOUT, NUM_LAYERS, LEARNING_RATE = 8, 20.0, 0.05, 8, 5e-5
NAME = re.compile(r"^[a-z0-9][a-z0-9._-]{0,40}$")


def fail(message: str) -> None:
    print(f"✗ {message}", file=sys.stderr)
    sys.exit(1)


# ---- Tools --------------------------------------------------------------------------------------------------------

def ensure_tools() -> None:
    """Run inside ~/.autinerary-model/torch with PyTorch, transformers and PEFT, setting it up the first time."""
    try:
        import peft, safetensors, torch, transformers  # noqa: F401
        return
    except ImportError:
        pass
    if os.environ.get("AUTINERARY_MODEL_CHILD"):
        fail("The tools didn't install. See the messages above.")
    if sys.version_info < (3, 10):
        fail("This needs Python 3.10 or newer: https://www.python.org/downloads/")
    python = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    ready = VENV / ".ready"
    if not ready.exists():
        # A set-up that stopped part way is started again.
        shutil.rmtree(VENV, ignore_errors=True)
        print(f"Setting up the tools in {VENV} (the first time only; a few GB).")
        try:
            subprocess.check_call([sys.executable, "-m", "venv", str(VENV)])
        except subprocess.CalledProcessError:
            shutil.rmtree(VENV, ignore_errors=True)
            fail("Python couldn't make a place for the tools. On Ubuntu or Debian, install it first with "
                 "sudo apt install python3-venv, then run this again.")
        torch_args = ["torch"]
        if os.name == "nt":
            # PyPI's PyTorch for Windows has no CUDA; PyTorch's own index does.
            torch_args += ["--index-url", "https://download.pytorch.org/whl/cu124"]
        try:
            subprocess.check_call([str(python), "-m", "pip", "install", "--quiet", "--upgrade", "pip"])
            subprocess.check_call([str(python), "-m", "pip", "install", "--quiet", *torch_args])
            subprocess.check_call([str(python), "-m", "pip", "install", "--quiet", "transformers>=4.51", "peft>=0.14",
                                   "safetensors", "accelerate", "huggingface_hub"])
        except subprocess.CalledProcessError:
            fail("The tools didn't install (see the messages above). Check the internet connection and run this again.")
        ready.write_text("ok\n")
    env = {**os.environ, "AUTINERARY_MODEL_CHILD": "1"}
    sys.exit(subprocess.call([str(python), os.path.abspath(__file__), *sys.argv[1:]], env=env))


def pick_device():
    import torch
    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps", torch.float32
    print("No NVIDIA graphics card found, so this runs on the processor: it will be slow.")
    return "cpu", torch.float32


# ---- Adapters: mlx-lm's format (what's shared) and PEFT's (what trains here) ----------------------------------------

def mlx_to_peft(tensors: dict) -> dict:
    """mlx-lm keeps lora_a as (in, rank) and lora_b as (rank, out); PEFT keeps them transposed, under its own names."""
    out = {}
    for name, value in tensors.items():
        match = re.match(r"^(.*)\.lora_(a|b)$", name)
        if not match:
            raise ValueError(f"not a LoRA weight: {name}")
        out[f"base_model.model.{match.group(1)}.lora_{match.group(2).upper()}.weight"] = value.T.contiguous()
    return out


def peft_to_mlx(state: dict) -> dict:
    out = {}
    for name, value in state.items():
        match = re.match(r"^base_model\.model\.(.*)\.lora_(A|B)(?:\.default)?\.weight$", name)
        if match:
            out[f"{match.group(1)}.lora_{match.group(2).lower()}"] = value.detach().float().T.contiguous().cpu()
    return out


def read_shared(weights_path: pathlib.Path) -> tuple:
    """A shared adapter's weights and settings (its .adapter_config.json beside it, as Community models names them)."""
    from safetensors.torch import load_file
    config_path = weights_path.with_name(weights_path.name[: -len(".safetensors")] + ".adapter_config.json")
    if not config_path.exists():
        config_path = weights_path.with_name("adapter_config.json")
    if not weights_path.exists() or not config_path.exists():
        fail("Download both files from Community models and keep them side by side.")
    config = json.loads(config_path.read_text())
    if config.get("fine_tune_type") != "lora" or config.get("model") not in OLLAMA_FOR:
        fail(f"This adapter starts from {config.get('model')}, which this script doesn't know.")
    return load_file(str(weights_path)), config


def peft_model(repo: str, dtype, device: str, num_layers: int, rank: int, scale: float, dropout: float):
    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(repo)
    model = AutoModelForCausalLM.from_pretrained(repo, dtype=dtype)
    layers = model.config.num_hidden_layers
    config = LoraConfig(r=rank, lora_alpha=scale * rank, lora_dropout=dropout, target_modules=MODULES, bias="none",
                        layers_to_transform=list(range(layers - num_layers, layers)), task_type="CAUSAL_LM")
    model = get_peft_model(model, config).to(device)
    if device == "cuda" and torch.cuda.get_device_properties(0).total_memory < 20 * 1024 ** 3:
        model.gradient_checkpointing_enable()
        model.enable_input_require_grads()
    return model, tokenizer


def load_into(model, mlx_tensors: dict) -> None:
    from peft import set_peft_model_state_dict
    result = set_peft_model_state_dict(model, mlx_to_peft(mlx_tensors))
    missing = [k for k in getattr(result, "unexpected_keys", []) if "lora_" in k]
    if missing:
        fail("The shared adapter doesn't fit the model it says it starts from.")


# ---- Training -----------------------------------------------------------------------------------------------------

def read_set(path: pathlib.Path) -> list:
    examples = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            messages = json.loads(line)["messages"]
            assert any(m["role"] == "assistant" for m in messages)
        except Exception:
            fail(f"Line {number} isn't a chat example. Use the file from Build my training set.")
        examples.append(messages)
    if len(examples) < 5:
        fail(f"{len(examples)} examples is too few to learn from. Approve at least 5 items; a few dozen is better.")
    return examples


def encode(tokenizer, messages: list, qwen: bool) -> tuple:
    """The prompt (everything before the answer) and the answer, as token ids; only the answer is learnt."""
    extra = {"enable_thinking": False} if qwen else {}
    prompt = tokenizer.apply_chat_template(messages[:-1], add_generation_prompt=True, tokenize=False, **extra)
    end = "<|im_end|>" if qwen else "<|eot_id|>"
    prompt_ids = tokenizer(prompt, add_special_tokens=False)["input_ids"]
    answer_ids = tokenizer(messages[-1]["content"].strip() + end, add_special_tokens=False)["input_ids"]
    ids = (prompt_ids + answer_ids)[:1024]
    labels = ([-100] * len(prompt_ids) + answer_ids)[:1024]
    return ids, labels


def batches(rows: list, size: int, pad_id: int, device: str):
    import torch
    longest = max(len(ids) for ids, _ in rows)
    ids = torch.full((len(rows), longest), pad_id)
    labels = torch.full((len(rows), longest), -100)
    mask = torch.zeros((len(rows), longest), dtype=torch.long)
    for i, (row_ids, row_labels) in enumerate(rows):
        ids[i, : len(row_ids)] = torch.tensor(row_ids)
        labels[i, : len(row_labels)] = torch.tensor(row_labels)
        mask[i, : len(row_ids)] = 1
    return ids.to(device), mask.to(device), labels.to(device)


def mean_loss(model, rows: list, size: int, pad_id: int, device: str) -> float:
    import torch
    model.eval()
    total = 0.0
    with torch.no_grad():
        for start in range(0, len(rows), size):
            ids, mask, labels = batches(rows[start:start + size], size, pad_id, device)
            total += float(model(input_ids=ids, attention_mask=mask, labels=labels).loss) * len(rows[start:start + size])
    model.train()
    return total / len(rows)


def train(args) -> None:
    import torch
    data = pathlib.Path(args.set).expanduser()
    if not data.exists():
        fail(f"No file at {data}")
    device, dtype = pick_device()
    built_on = None
    shared = None
    if args.source:
        shared, shared_config = read_shared(pathlib.Path(args.source).expanduser())
        repo = shared_config["model"]
        num_layers = int(shared_config["num_layers"])
        rank = int(shared_config["lora_parameters"]["rank"])
        scale = float(shared_config["lora_parameters"]["scale"])
        built_on = shared_config.get("shared_id")
        epochs = args.epochs or 1
    else:
        repo = BASES[args.base][0]
        num_layers, rank, scale = NUM_LAYERS, RANK, SCALE
        epochs = args.epochs or 2
    qwen = repo.startswith("Qwen/")
    if qwen:
        fail("Tuning Qwen3 is coming soon: tuned, it doesn't keep its thinking yet. Start from a Llama 3.2 model instead.")
    examples = read_set(data)
    batch = 4 if len(examples) >= 16 else 2 if len(examples) >= 6 else 1
    held = max(batch, len(examples) // 10)
    random.Random(0).shuffle(examples)
    print(f"Tuning {repo} on {data.name}: {len(examples) - held} examples to learn from, {held} to check against "
          f"({device}).{' Starting from ' + pathlib.Path(args.source).name + '.' if args.source else ''}")
    model, tokenizer = peft_model(repo, dtype, device, num_layers, rank, scale, DROPOUT)
    if shared is not None:
        load_into(model, shared)
    pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id
    rows = [encode(tokenizer, m, qwen) for m in examples]
    valid, learn = rows[:held], rows[held:]
    iters = max(10, math.ceil(epochs * len(learn) / batch))
    optimizer = torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=LEARNING_RATE)
    print(f"  check against: loss {mean_loss(model, valid, batch, pad_id, device):.3f}")
    order, model_iter = [], 0
    model.train()
    for step in range(1, iters + 1):
        if len(order) < batch:
            order += random.Random(step).sample(range(len(learn)), len(learn))
        picked, order = [learn[i] for i in order[:batch]], order[batch:]
        ids, mask, labels = batches(picked, batch, pad_id, device)
        loss = model(input_ids=ids, attention_mask=mask, labels=labels).loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        if step % 5 == 0 or step == iters:
            print(f"  step {step}/{iters}: loss {float(loss):.3f}")
    print(f"  check against: loss {mean_loss(model, valid, batch, pad_id, device):.3f}")
    work = HOME / args.name
    save_adapter(model, work / "adapter", repo, num_layers, rank, scale, built_on)
    to_ollama(model, tokenizer, work, args.name, OLLAMA_FOR[repo], repo)


def save_adapter(model, folder: pathlib.Path, repo: str, num_layers: int, rank: int, scale: float, built_on) -> None:
    """In mlx-lm's format, with only the settings the tools need (and what it was built on), ready to share."""
    from peft import get_peft_model_state_dict
    from safetensors.torch import save_file
    folder.mkdir(parents=True, exist_ok=True)
    save_file(peft_to_mlx(get_peft_model_state_dict(model)), str(folder / "adapters.safetensors"))
    config = {"fine_tune_type": "lora", "num_layers": num_layers,
              "lora_parameters": {"rank": rank, "scale": scale, "dropout": DROPOUT}, "model": repo}
    if built_on:
        config["built_on"] = built_on
    (folder / "adapter_config.json").write_text(json.dumps(config, indent=2))
    print(f"  the adapter (the part that's yours, a few MB): {folder}")


# ---- Into Ollama --------------------------------------------------------------------------------------------------

def to_ollama(model, tokenizer, work: pathlib.Path, name: str, ollama_base: str, repo: str) -> None:
    import torch
    if shutil.which("ollama") is None:
        fail("Install Ollama from https://ollama.com first, and open it.")
    shown = subprocess.run(["ollama", "show", "--modelfile", ollama_base], capture_output=True, text=True)
    if shown.returncode != 0:
        fail(f"Ollama doesn't have {ollama_base} yet, and it's needed for the chat format. Run: ollama pull {ollama_base}")
    merged = work / "merged"
    shutil.rmtree(merged, ignore_errors=True)
    print("  merging the adapter into the model")
    model.merge_and_unload().to(torch.bfloat16).save_pretrained(str(merged), safe_serialization=True)
    # Ollama reads the model's own config and tokenizer files; copies written back can differ (a merged Qwen3 came out
    # of Ollama as nonsense until the originals were put back), so the originals go beside the merged weights.
    from huggingface_hub import snapshot_download
    originals = snapshot_download(repo, allow_patterns=["*.json", "*.txt", "tokenizer*", "vocab.json", "merges.txt"])
    for item in pathlib.Path(originals).iterdir():
        if item.suffix != ".safetensors" and item.name != "model.safetensors.index.json":
            shutil.copyfile(item, merged / item.name)
    lines, done = [], False
    for line in shown.stdout.splitlines():
        if not done and line.startswith("FROM "):
            lines.append(f"FROM {merged}")
            done = True
        else:
            lines.append(line)
    modelfile = work / "Modelfile"
    modelfile.write_text("\n".join(lines) + "\n")
    # Compressed to 4 bits so it runs fast: older Ollama calls that q4_K_M, newer Ollama int4. Uncompressed if neither.
    said = ""
    for quantize in (["--quantize", "q4_K_M"], ["--quantize", "int4"], []):
        result = subprocess.run(["ollama", "create", name, *quantize, "-f", str(modelfile)], stderr=subprocess.PIPE, text=True)
        said += result.stderr or ""
        if result.returncode == 0:
            break
    else:
        if "MLX runtime is not available" in said:
            # Ollama 0.40 on Linux (and Windows) adds a model like this only through its MLX runtime, which its
            # Linux build doesn't include (31 October 2026, on an NVIDIA L4). It does take a GGUF file.
            gguf_modelfile = work / "Modelfile.gguf"
            gguf_modelfile.write_text("\n".join(f"FROM {work / 'model.gguf'}" if l.startswith("FROM ") else l for l in lines) + "\n")
            print("\nOllama on this computer can't add this kind of model yet: it needs it as a GGUF file first.")
            print(f"  Your adapter is ready to share: {work / 'adapter'}")
            print(f"  The tuned model is kept in {merged}. To use it here, convert it with llama.cpp's converter")
            print(f"  (https://github.com/ggml-org/llama.cpp, convert_hf_to_gguf.py --outfile {work / 'model.gguf'}),")
            print(f"  then run: ollama create {name} -f {gguf_modelfile}")
            sys.exit(2)
        print(said, file=sys.stderr)
        fail("Ollama couldn't add the model.")
    shutil.rmtree(merged, ignore_errors=True)
    print(f"\n✓ Done: Ollama has {name}.")
    print(f'  Try it:  ollama run {name} "What\'s one small first step toward swimming once a week?"')
    print(f"  Use it:  in Autinerary, Settings, Models, Use my own model, set the model name to {name}.")


def adopt(args) -> None:
    weights = pathlib.Path(args.adapter).expanduser()
    if weights.suffix != ".safetensors":
        fail("Give the .safetensors file from Community models.")
    device, dtype = pick_device()
    shared, config = read_shared(weights)
    if config["model"].startswith("Qwen/"):
        fail("Using a tuned Qwen3 in Ollama is coming soon: Ollama can't switch its thinking off yet.")
    name = args.name or weights.stem
    if not NAME.match(name):
        fail("Use lower-case letters, numbers, dots, dashes and underscores for the model name.")
    print(f"Adding {weights.name} (it starts from {config['model']}) to Ollama as {name}.")
    model, tokenizer = peft_model(config["model"], dtype, device, int(config["num_layers"]),
                                  int(config["lora_parameters"]["rank"]), float(config["lora_parameters"]["scale"]), 0.0)
    load_into(model, shared)
    to_ollama(model, tokenizer, HOME / "shared" / name, name, OLLAMA_FOR[config["model"]], config["model"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Tune or adopt a small open model on this computer, and add it to Ollama.")
    sub = parser.add_subparsers(dest="command", required=True)
    t = sub.add_parser("train", help="tune a model on your own training set")
    t.add_argument("set", help="the training set file from Build my training set (.jsonl)")
    t.add_argument("name", nargs="?", default="my-model", help="the model's name in Ollama (default my-model)")
    # Tuning Qwen3 (qwen3-4b), which thinks first, is coming soon: tuned, it doesn't keep its thinking yet.
    t.add_argument("--base", choices=["llama-1b", "llama-3b"], default="llama-3b", help="the model to tune (default llama-3b)")
    t.add_argument("--from", dest="source", help="start from a shared model: its .safetensors file from Community models")
    t.add_argument("--epochs", type=int, help="times through your set (default 2, or 1 from a shared model)")
    a = sub.add_parser("adopt", help="add a model someone shared to Ollama")
    a.add_argument("adapter", help="the .safetensors file from Community models (its .adapter_config.json beside it)")
    a.add_argument("name", nargs="?", help="the model's name in Ollama (default: the file's name)")
    args = parser.parse_args()
    if args.command == "train" and not NAME.match(args.name):
        fail("Use lower-case letters, numbers, dots, dashes and underscores for the model name.")
    ensure_tools()
    train(args) if args.command == "train" else adopt(args)


if __name__ == "__main__":
    main()
