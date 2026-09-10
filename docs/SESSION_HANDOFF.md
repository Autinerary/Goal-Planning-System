# Autinerary — Session Handoff Brief

Paste this into a new Claude / Claude Code session as opening context. Written
8–10 September 2026. Every technical claim below was verified against the live
system or the codebase at that time — re-check anything load-bearing before
relying on it.

---

## What this is

**Autinerary** — an AI life-planning system for people with neurodivergence
(autism, ADHD, OCD, bipolar) and systemic barriers (visible minority status,
low income, immigration status). It generates personalised milestone-based
paths across four life dimensions (Education, Workplace, Relationships,
Health), with tasks, tools, and calendar scheduling.

Three codebases, **one shared Supabase project**:

| Path | What | Deploys to |
|---|---|---|
| `frontend/` | Next.js 14 — the main Autinerary app | Vercel |
| `servicehub-mvp/` | "ResourceHub" — services/products directory + "Tidbits" Q&A | Vercel |
| `backend/` | FastAPI + LangGraph, 6-agent orchestration | Render |

Also present: `mobile/` (Expo skeleton, 3 screens), `desktop/` (Electron
mascot), `chrome-extension/`.

---

## Critical operational facts

### Two git remotes — push to both

```
origin  → Autinerary/Goal-Planning-System      (public org repo)
aayush  → Aayush-Bhan123/Goal-planning-app     (personal)
```

**Vercel builds from `aayush`, not `origin`.** Push to both or a "deployed"
change never goes live.

### Live backend

```
https://goal-planning-app-mup2.onrender.com
```

URL lives in `frontend/.env.vercel`. Free tier — sleeps after ~15 min idle, so
the first request can take 60s+. Budget generous curl timeouts.

Current health (verified 10 Sep 2026):

```
capability      : full
orchestrator    : LangGraph
active_model    : gpt-4o-mini
available_models: [gpt-4o-mini, gpt-4o, o4-mini]
```

### Database migrations

`setup/all_migrations.sql` — one idempotent file, currently at **STEP 32**.
Individual files also live in `backend/database/migrations/` and
`servicehub-mvp/scripts/`. When adding schema, append it as the next STEP in
the combined file too — do not let them drift.

---

## Standing rules — do not violate

1. **No hardcoded or fabricated agent output.** Every number the agents
   produce (task duration, confidence, ratings) must derive from real data or
   be explicitly gated on sample size and hidden below threshold. Never a
   plausible-looking placeholder.
   *Exception:* resource/catalogue content (path category names, blurbs) is
   authored editorial content, not agent output.

2. **Never invent facts about real, named people.** No fabricated role-model
   bios; no attributing a diagnosis to a real person without their own account.

3. **We do not delete user data.** Deletion features (App Store / Play
   compliance) must anonymise, not erase. Still an open decision, not built.

4. **Say "Norms," never "barriers"** in user-facing text. The database column
   is still `barrier_type` — do not rename it, just never surface the word.

5. **18+ only for self-signup** — enforced server-side in
   `frontend/app/api/auth/signup/route.ts`. Minors join via a guardian's
   account (`guardianships` table).

6. Do not call subagents unless explicitly asked.

---

## What was built in this session

### The LLM harness (the main piece of work)

The six agents were locked to one model. They are now a **harness**: the user
picks the model and thinking effort, and can point individual agents at
different models (e.g. a stronger model for path planning, a cheap fast one
for scheduling).

**No orchestration rewrite was needed.** `backend/core/llm.py` was already the
single seam every agent calls, so selection resolves there.

| File | Role |
|---|---|
| `backend/core/model_registry.py` | Catalogue of models, providers, effort levels |
| `backend/core/llm.py` | Per-call resolution via a `ContextVar` |
| `backend/core/budget.py` | Rate + spend limits, backed by a usage ledger |
| `backend/api/routes/models.py` | `GET /api/models`, `GET /api/models/usage` |
| `frontend/lib/modelPrefs.ts` | Client-side preference storage |
| `frontend/app/settings/models/page.tsx` | The picker UI |

**Key conventions:**

- Agents pass `agent="<agent_id>"` to `complete_text` / `complete_json` /
  `complete_chat` so per-agent overrides take effect.
- Routes scope a run with
  `llm.use_selection(llm.parse_selection(cfg), actor=uid, verified=True)`.
- The wire field is **`llm_config`** (backend) / **`llmConfig`** (onboarding).
  It is *not* `model_config` — that name is reserved by pydantic v2 and will
  fail at import.
- Selection precedence: per-agent choice → request default → server default
  (the local fine-tune first when running, because it is free).

### Spend limits (`backend/core/budget.py`)

Three limits per account, checked in order: requests/minute (default 30),
tokens/day (default 300,000), dollars/day (off unless configured).

Enforced inside the three `llm.py` helpers, so **every** path is covered
including agent calls — not just the routes.

**Pricing is never hardcoded.** Provider prices change without notice, and a
stale table produces confident wrong figures. Operators opt in:

```
MODEL_PRICING={"gpt-4o-mini":{"in":0.15,"out":0.60},"gpt-4o":{"in":2.50,"out":10.00},"o4-mini":{"in":1.10,"out":4.40}}
```

Without it, token limits still apply and the UI says cost is not tracked
rather than inventing a number. **Verify these numbers against current
provider pricing — they were not looked up.**

### Usage ledger (STEP 32)

`public.llm_usage` — one row per LLM call. The daily total is a **SUM over the
last 24h**, not a running counter, so a dropped write costs one call's worth of
accounting rather than corrupting an unrecoverable total. In-memory counters
sit in front as a 60s cache.

`user_id` has a foreign key to `auth.users`, so **only session-verified ids are
written**; everything else goes to the NULL/anonymous bucket.

---

## Bugs found and fixed this session (context for why the code looks as it does)

1. **Reasoning models were completely broken.** `o4-mini` rejects `max_tokens`
   and needs `max_completion_tokens`. Every call returned `None` and silently
   fell back to rule-based output — selectable in the UI, could never answer.
   Reasoning tokens also bill against the same cap, hence
   `REASONING_MIN_TOKENS`.

2. **Import-order bug.** `core.llm` and `core.model_registry` are imported
   *before* `main.py` calls `load_dotenv()`, so module-level `os.getenv` saw
   empty strings. Provider env is now read **at call time**. This would have
   silently dropped the free local fine-tune's precedence.

3. **Spoofable identity.** Budget was keyed off a client-set `X-User-Id`
   header — anyone could mint a fresh id to reset their own limit. Now derived
   from the verified session via `auth_guard.optional_user_id`.

4. **A failed ledger read erased the limit.** "Read failed" and "genuinely
   zero" both returned `(0, 0.0)`, so an unreachable database removed the cap
   entirely. They are now distinct.

5. **Sub-cent spend showed as `$0.00`**, which reads as *free* rather than
   *very cheap*. Now 6dp server-side, "under $0.01" in the UI.

---

## Verified measurements (useful for decks / applications)

One full six-agent generation, measured:

| Metric | Value |
|---|---|
| Milestones | 16 |
| Wall clock | 23 s |
| LLM calls | 14 |
| Tokens | 10,158 |
| Cost | $0.0027 |

Per agent: path_planning 10 calls / 5,552 tokens; tool_recommendation 3 /
4,504; calendar_optimization 1 / 102.

Agent confidence: path_planning 0.95, tool_recommendation 0.76,
calendar_optimization 0.75, **pattern_recognition 0.20** (correct — cold start,
little corpus to match against).

Real data in Supabase:

| Signal | Count |
|---|---|
| Real signups | 3 |
| Synthetic accounts | 47 |
| Orphaned barrier rows | 218 |
| Resources | 132 (95 approved) |
| Reflections / connections / messages | 0 |

Run `python -m scripts.barrier_report` from `backend/` for the real/synthetic
split — it is read-only and does not mutate rows.

---

## Repo gotchas learned the hard way

- The backend venv is at the **repo root** (`.venv`), not in `backend/`.
- Starlette's `TestClient` is incompatible with the installed httpx — drive the
  ASGI app directly in smoke tests.
- `load_dotenv()` fails from a stdin heredoc (`python - <<'PY'`). Write a real
  file for any script that needs env.
- zsh: `status` is read-only, and bare `==` triggers equals-expansion. Quote it.
- Result keys from `orchestrator.generate_path` are `path`, `races`,
  `recommendations`, `schedule` — **not** `pathPlanning`. Recommendations is a
  dict keyed by milestone id, not a list. Schedule days use `dayName` and
  `type`.

---

## Open work, roughly in priority order

1. **Task completion is not persisted.** `PATCH /api/me/calendar/[id]` exists
   and is complete — accepts `completed`, writes `completed_at` — but **nothing
   ever calls it**. Every calendar/task fetch is a `POST` to the collection.
   The read path already maps `completed` off the server row, so only the write
   is missing. Consequence: `lib/life-stats/loader.ts` computes life stats from
   `calendar_tasks.completed`, a column nothing writes.

2. **Verify `MODEL_PRICING` numbers** against current provider pricing.

3. **Infrastructure.** Render and Supabase are both free tier. Supabase pauses
   after 7 days of low activity; Render sleeps after 15 min. Neither is
   production-safe. Roughly $30–40/mo combined (not confirmed) — a bigger
   blocker to scale than LLM cost.

4. **Signed-out onboarding spend** lands in the shared anonymous bucket. Correct
   for security, but pre-session usage is not attributed to the person.

5. **Resource repetition.** The same top resource appeared first across several
   education milestones. Ranking *is* per-milestone, but barrier-fit scores are
   cached across the batch, so a strong match can dominate. Unconfirmed — only
   the first item of each set was sampled.

---

## Reverted work — do not redo

- Ready Player Me 3D avatars (service shut down Jan 2026)
- Procedural three.js 3D avatar (did not render acceptably)

Avatar picker is back to the original DiceBear vector system.

---

## Documents produced this session

| File | Purpose |
|---|---|
| `docs/vector-presentation.md` | Vector/Darmond program review + speaking script |
| `docs/yc-application-review.md` | YC application corrections and rewrite |
| `backend/scripts/build_deck.py` | Generates `docs/autinerary-vector-deck.pptx` |
| `backend/scripts/barrier_report.py` | Read-only real/synthetic data split |

Generated artefacts (`.pptx`, `.pdf`, `.docx`, `.html`) are gitignored — they
are rebuilt from source, and a committed binary quoting live figures goes stale
silently.

Rebuild commands:

```bash
# deck
cd backend && python scripts/build_deck.py

# documents
cd docs
pandoc vector-presentation.md -o vector-presentation.docx
pandoc vector-presentation.md -o vector-presentation.html \
  --standalone --toc --toc-depth=2 --css=presentation.css --embed-resources
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --no-pdf-header-footer --print-to-pdf=vector-presentation.pdf \
  vector-presentation.html
```

---

## Known factual errors in the draft YC application

Flagged because they are checkable by a partner in under a minute, and the
application's credibility rests on the founder being the system's architect:

| Draft says | Reality |
|---|---|
| "AutoGen for multi-agent orchestration" (×2) | **LangGraph** — `autogen` is not installed |
| "agents run on OpenAI GPT-4" | **gpt-4o-mini** |
| "Python 3.11" | 3.9.6 locally |
| `⅕ × 485 × $10 = $582M` ARR | Same assumptions give **$116M** |
| Video script says "Hurtle" | Company field says "Autinerary" |

An `AutoGenOrchestrator` class does exist behind a `USE_AUTOGEN` flag that
defaults to false and has never been enabled in production — which is how the
claim got written.

Full detail and rewritten answers in `docs/yc-application-review.md`.

---

## Uncommitted working-tree changes (pre-existing, not mine)

```
 M backend/core/autogen_orchestrator.py   (docstring removed)
 D backend/database/direct_db.py          (deleted; nothing imports it)
 M frontend/tsconfig.tsbuildinfo          (build artefact)
```

These predate this session and were deliberately left alone — they look like
in-progress work. Confirm intent before committing or reverting them.
