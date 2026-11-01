# Tune a small open model on your own writing

This turns the training set you downloaded from Autinerary (Settings, Models, **Build my training set**) into a small
open model on your own Mac, and adds it to Ollama so Autinerary can use it (Settings, Models, **Use my own model**).

Everything happens on your computer. Nothing is uploaded: not your training set, not the model.

## What you need

- A Mac with Apple silicon (M1 or newer). 16 GB of memory or more tunes the 3B model; with less, the script uses the
  1B model. A Windows or Linux computer with an NVIDIA graphics card can tune and share too (see below).
- Python 3.11 or newer (`python3 --version`). If yours is older, install one from
  [python.org](https://www.python.org/downloads/) or with `brew install python@3.12`.
- [Ollama](https://ollama.com), open, with the base model: `ollama pull llama3.2:3b` (or `llama3.2:1b` on a Mac with
  less than 16 GB).
- About 20 GB of free disk space, and an internet connection the first time (the base model is downloaded once from
  Hugging Face: about 6.5 GB for 3B, 2.5 GB for 1B).

## Run it

```bash
bash train-my-model.sh ~/Downloads/my-training-set-2026-10-31.jsonl
```

Give a second name to call the model something else: `bash train-my-model.sh my-set.jsonl my-calm-planner`.

It takes about 10 to 30 minutes, most of it the first download. It:

1. makes a Python environment in `~/.autinerary-model` and installs [mlx-lm](https://github.com/ml-explore/mlx-lm)
   into it;
2. keeps a few of your examples aside to check against, and learns from the rest;
3. trains a LoRA adapter: a small add-on (a few MB) that nudges Llama 3.2 toward your examples. It learns from your
   answers, not our questions, and goes through your set twice, so it picks up how you write without learning it
   word for word;
4. merges the adapter into the model and adds it to Ollama as `my-model` (or the name you gave).

Then in Autinerary, under **Use my own model**, set the model name to `my-model` and press **Send a test prompt**.

While it makes a plan, Autinerary asks Ollama to keep room for 16,384 tokens, because some of the plan's questions are
long; Ollama would otherwise keep 4,096 and quietly cut them short. That takes more memory than a chat: about 3.2 GB
with a 3B model, 1.8 GB with 1B (Ollama 0.40, measured).

## What to expect

- A few dozen examples change the model only a little. It may pick up your tone and the things you find helpful; it
  won't learn new facts.
- With a small set it can also say your answers back word for word, especially when asked one of the same questions.
  That's why you read every item before approving it, and why the model stays on your computer.
- A tuned model can get worse as well as better. Compare it with the model you had (`ollama run llama3.2:3b` and
  `ollama run my-model` with the same question) and keep the one you prefer. To go back, set the model name back.
- To remove it: `ollama rm my-model`, and delete `~/.autinerary-model`.

## Start from a model someone shared

**Community models** (Settings, Models) lists starter models people tuned from their own scrubbed writing and shared.
Each has two files; download both and keep them side by side.

```bash
ollama pull llama3.2:3b                      # the model it starts from (Community models says which)
bash use-shared-model.sh ~/Downloads/calm-first-steps.safetensors
```

That adds it to Ollama as `calm-first-steps`. To tune it a little with your own approved items, start from it:

```bash
FROM_ADAPTER=~/Downloads/calm-first-steps.safetensors bash train-my-model.sh ~/Downloads/my-training-set-2026-10-31.jsonl my-calm-first-steps
```

It goes through your set once (unless you set `EPOCHS`), starting where the shared one left off.

## Share yours

**Share my model** (Settings, Models) shares your adapter (`~/.autinerary-model/my-model/adapter`), never your
training set. Before it's listed, it's checked: the training set it came from was scrubbed and approved by you; a
memory check, run in your browser against the model on your computer, finds it doesn't say your training answers back;
its title and description name no one; and only the adapter and four of its settings go up (the settings file the
tools write has folders from your computer in it, so the rest is left out). If the memory check fails, train again
with `EPOCHS=1` or with more items.

## Windows and Linux, with an NVIDIA graphics card

`autinerary_model.py` does the same as the Mac scripts with PyTorch, and saves the adapter the Mac's way, so a model
tuned on a PC can be shared and adopted on a Mac, and the other way round (tested on an NVIDIA L4 under Linux on 1
November 2026: the same answers back through either, to within rounding).

```bash
python autinerary_model.py train my-training-set-2026-10-31.jsonl my-model        # --base llama-1b for less memory
python autinerary_model.py train my-set.jsonl my-calm-first-steps --from calm-first-steps.safetensors
```

The first run sets up its tools in `~/.autinerary-model/torch` (a few GB). On Ubuntu or Debian, install
`python3-venv` first. Using the tuned model in Ollama on Windows or Linux is **coming soon**: Ollama 0.40 there can't
add a tuned model without converting it to GGUF first. The script says so, keeps the tuned model, and writes the
Modelfile for that last step.

## Thinking models

Qwen3 4B thinks before it answers (`ollama pull qwen3:4b`, then set it as your model). In Autinerary it thinks only on
the plan itself, if you allow it (Settings, Use my own model); on a laptop that takes about 1 to 3 minutes more for
each goal. Tuning Qwen3 is **coming soon**: tuned on answers that don't think, it stopped thinking or couldn't stop
in our tests, and Ollama can't switch a tuned one's thinking off yet.

## In the browser instead

No install: Settings, Use my own model, "In this browser". A small model (Llama 3.2 1B for phones and tablets) is
downloaded once into your browser and runs on your device's graphics chip. Models you tuned yourself run in Ollama, not
in the browser.

## Settings

Set these before the command, for example `EPOCHS=3 bash train-my-model.sh my-set.jsonl`:

| Setting | Default | What it does |
|---|---|---|
| `BASE_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-bf16` (1B under 16 GB) | The model to tune, from Hugging Face |
| `OLLAMA_BASE` | `llama3.2:3b` (or `llama3.2:1b`) | The Ollama model with the same chat format |
| `EPOCHS` | `2` | Times through your set. More makes it start repeating your words back |
| `WORK_DIR` | `~/.autinerary-model/<model name>` | Where the adapter and the merged model go |
| `FROM_ADAPTER` | none | A shared adapter's `.safetensors` file to start from (its `.adapter_config.json` beside it) |

## Licence

Llama 3.2 is under Meta's [Llama 3.2 Community License](https://www.llama.com/llama3_2/license/), and a model made from
it is too.
