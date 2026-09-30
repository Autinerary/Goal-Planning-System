# Replacing `text-embedding-ada-002` with a locally hosted model — feasibility

**Status:** research only. Nothing was built or changed. 2026-09-30.
**Decision owner:** you. This lays out what the choice involves; it does not make it.

References to items #2–#4 (the anonymiser, `pattern_experiment.py`,
`label_similar_pairs.py`) point at work on their own branches:
`feat/embedding-anonymization` → `feat/pattern-split-embeddings` →
`feat/pattern-similarity-labels`. The residency report is on
`report/data-residency`.

## The short version

- **It is feasible, and quality is not the obstacle.** Several open models with
  permissive licences score *higher* than ada-002 on the standard English
  benchmark (MTEB), and they are small enough to run on a CPU.
- **Cost is not a reason to do it.** Every LLM call Autinerary has ever logged
  cost $1.56 in total. Embeddings are a sliver of that.
- **The real reason would be data residency** — and a local embedding model
  alone does not deliver it. The path-planning agents send the raw profile to
  OpenAI's chat API (6,016 logged calls), and the database is in the US (see
  `docs/data-residency.md`). Moving only the embedding call keeps less than it
  appears to.
- **Item #2 already removed the worst part** of what the embedding call sent —
  email, user id, and all free text. What still goes out is condition
  categories and generic goal words.

So the useful question is not "local or OpenAI?" but "is the residual
anonymised text going to a US processor acceptable?" That is the counsel
question from the residency report, and it should be answered first.

## Viable open models

Figures are from each model's published card, checked 2026-09-30. MTEB here
means the classic English benchmark average over 56 datasets; newer leaderboard
versions use different task sets and are not directly comparable.

| Model | Dims | Max tokens | Size | MTEB avg | Licence |
|---|---|---|---|---|---|
| **text-embedding-ada-002** (current) | 1536 | 8192 | API only | **60.99** | Proprietary |
| bge-small-en-v1.5 | 384 | 512 | ~33M params | 62.17 | MIT |
| bge-base-en-v1.5 | 768 | 512 | ~110M params | 63.55 | MIT |
| bge-large-en-v1.5 | 1024 | 512 | ~335M params | 64.23 | MIT |
| nomic-embed-text-v1.5 | 768 (down to 64) | 8192 | ~100M params | 62.28 at 768 · 61.04 at 256 | Apache-2.0 |
| all-MiniLM-L6-v2 | 384 | 256 | 22.7M params | not listed on its card | Apache-2.0 |

Sources: the BAAI/bge-small-en-v1.5 card, which includes an ada-002 comparison
row (60.99 average; clustering 45.9, STS 80.97); the nomic-embed-text-v1.5
card; the sentence-transformers/all-MiniLM-L6-v2 card. OpenAI's own
announcement page refused automated access, so ada-002's figure comes from the
BGE comparison table, not from OpenAI directly. Parameter counts for BGE are
approximate. nomic requires a task prefix on every input (`search_query:` /
`search_document:`), which is easy to get wrong.

**Most likely candidate: `bge-small-en-v1.5`.** It is the smallest model that
still beats ada-002 on the benchmark, MIT-licensed, and at 384 dimensions it
makes the vectors four times smaller.

## Why the benchmark is not the answer

MTEB measures general English text. After item #2, what Autinerary embeds is
nothing like that: short, templated strings built from a closed vocabulary —

    conditions: ADHD; anxiety. goals: education (graduate, university). age band: 18-24.

Three things from the experiment in item #3 matter more than the leaderboard:

1. **ada-002 compresses this data into cosine 0.84–1.00.** All 1,596 pairwise
   similarities among the 57 real users clear the production threshold of 0.70,
   so the threshold never excludes anyone. A different model will spread the
   same data differently, so **no threshold carries over between models** —
   0.70 would have to be re-derived, not reused.
2. **On templated closed-vocabulary text, the engineered-feature arm is a
   serious competitor to any embedding model.** It needs no model at all, runs
   anywhere, and sends nothing anywhere.
3. **The only comparison that means anything is against human judgement on
   this cohort.** Item #4 built exactly that. A local model can be added as a
   fifth arm to `scripts/pattern_experiment.py` and scored against the labelled
   pairs alongside ada-002 — on a laptop, at no cost, with no production change.

## What switching would involve

### Schema

The vector columns are declared `VECTOR(1536)`. A 384- or 768-dimension model
cannot share them, and vectors from two models are never comparable, so this
is a migration, not a config change:

1. Add a new column (e.g. `embedding_bge VECTOR(384)`) beside the existing one
   in `pattern_user_embeddings` and `pattern_user_field_embeddings`.
2. Add a new similarity RPC for the new dimension; `find_similar_pattern_users`
   takes `query_embedding VECTOR(1536)`.
3. Write both vectors during a transition period; backfill the new column —
   fast and free when the model is local.
4. Switch reads, re-derive the threshold, then drop the old column.

While there: the existing `ivfflat` index was built with `lists = 100` over a
table of 61 rows. At this size an exact scan is instant and exact; an ANN index
buys nothing and returns approximate results. Drop it rather than rebuild it.

### Hosting

- **Inside the existing FastAPI backend.** CPU is enough: one short string
  takes milliseconds, and volume is one or two embeddings per onboarding. The
  constraint is memory. PyTorch plus sentence-transformers is several hundred
  MB before the model loads, which is likely too much for a small Render
  instance — check the current plan's RAM limit. An ONNX runtime (for example
  the `fastembed` library, which ships bge-small by default) is much lighter;
  worth evaluating, not verified here.
- **On Modal** (the repo already has `backend/scripts/modal_app.py`).
  Operationally easy, but Modal is itself a US third party, so it **does not
  help residency** — it swaps one processor for another.
- **Self-hosted in a Canadian region.** The only option that actually keeps
  the text in Canada, and only worth it if the backend and database move too.
  Render has no Canadian region (see the residency report).

The same caveat applies to the Google Cloud credits discussed earlier: Vertex
AI embedding models would be covered by the credits, but they are still an
external processor. They are a cost lever, not a residency one.

### Cost

- **OpenAI side today:** the `llm_usage` ledger holds 6,017 calls and $1.56 of
  spend over the product's lifetime (6,016 gpt-4o-mini, 1 gpt-4o). **Embedding
  calls are not in the ledger at all** — the Pattern Recognition agent calls
  the OpenAI client directly, bypassing `core/llm.py` where usage is recorded.
  Their volume is small by construction, but it is currently invisible, and
  that is worth fixing whichever way this decision goes.
- **Local side:** no per-call cost; the cost is hosting — a larger instance
  for the backend, or a separate service. At current volume that is more
  expensive than ada-002, not less.

## What would justify doing it

- Counsel concludes that even anonymised condition categories must not go to a
  US processor — **and** the chat-API calls and the database are dealt with
  too. Otherwise the embedding call is the smallest of the three transfers.
- Vendor dependence becomes a concern. ada-002 is OpenAI's previous-generation
  embedding model, and newer ones exist. Staying on it is a choice to revisit
  either way; a local model removes the dependency entirely.
- The labelled-pair evaluation shows a local model or the engineered features
  matching ada-002 on *this* data. Then the switch costs little and removes a
  third party.

## Suggested next step, if you want to explore it

Add `bge-small-en-v1.5` as arm 5 in `scripts/pattern_experiment.py`, run it
locally over the anonymised text, and compare it with ada-002 and the
engineered features once the team has labelled some pairs with
`scripts/label_similar_pairs.py`. That answers the quality question on real
data for the price of a model download, and commits you to nothing.
