# Tune a small open model on your own writing

This turns the training set you downloaded from Autinerary (Settings, Models, **Build my training set**) into a small
open model on your own Mac, and adds it to Ollama so Autinerary can use it (Settings, Models, **Use my own model**).

Everything happens on your computer. Nothing is uploaded: not your training set, not the model.

## What you need

- A Mac with Apple silicon (M1 or newer). 16 GB of memory or more tunes the 3B model; with less, the script uses the
  1B model. Windows and Linux: coming soon.
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

## What to expect

- A few dozen examples change the model only a little. It may pick up your tone and the things you find helpful; it
  won't learn new facts.
- With a small set it can also say your answers back word for word, especially when asked one of the same questions.
  That's why you read every item before approving it, and why the model stays on your computer.
- A tuned model can get worse as well as better. Compare it with the model you had (`ollama run llama3.2:3b` and
  `ollama run my-model` with the same question) and keep the one you prefer. To go back, set the model name back.
- To remove it: `ollama rm my-model`, and delete `~/.autinerary-model`.

## Settings

Set these before the command, for example `EPOCHS=3 bash train-my-model.sh my-set.jsonl`:

| Setting | Default | What it does |
|---|---|---|
| `BASE_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-bf16` (1B under 16 GB) | The model to tune, from Hugging Face |
| `OLLAMA_BASE` | `llama3.2:3b` (or `llama3.2:1b`) | The Ollama model with the same chat format |
| `EPOCHS` | `2` | Times through your set. More makes it start repeating your words back |
| `WORK_DIR` | `~/.autinerary-model/<model name>` | Where the adapter and the merged model go |

## Licence

Llama 3.2 is under Meta's [Llama 3.2 Community License](https://www.llama.com/llama3_2/license/), and a model made from
it is too.
