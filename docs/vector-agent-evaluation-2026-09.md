# Per-agent evaluation brief — for Vector (Malikeh)

Prepared from live production data (`backend/scripts/vector_evaluation_pull.py`, run 2026-09-17) and the
actual confidence-scoring code for each agent. Every number below is either a direct query result or a
formula read out of the source file cited — nothing here is estimated or reconstructed from memory.

**Do not distribute externally.** Per Odosa (2026-09-16): this may become IP; not for public release.

---

## 0. Housekeeping — a data fact that changed since the last deck

The "3 real users / 47 synthetic" figure used in the last presentation is **stale**. As of 2026-09-17:

| | count |
|---|---|
| Total auth accounts | 50 |
| Real, organic-looking signups | 41 |
| Team/QA test accounts (`test*`, `child*.test.account`, `superautism@...`) | 9 |
| Synthetic/seeded accounts (old `synthetic+...` pattern) | **0** |

The old synthetic seed cohort is gone and 41 real-looking accounts signed up between 2026-09-12 and
2026-09-17 — a real growth event in the last week, not something we generated. This needs re-verifying
before it's presented (it could be a marketing push, a bug that let test signups through, or genuine
organic growth — we haven't traced the source yet), but the "3 real users" framing from last time should
not be repeated as-is.

One integrity gap surfaced by this pull: **all 88 rows in `race_progress` (completed milestones) belong
to user_ids that don't match any current account.** Dates run 2026-06-21 to 2026-09-15, so this isn't
ancient — something (an account reset, a migration, or duplicate ids) disconnected completion history
from the live user table. This should be root-caused before completion-based metrics (Focus, Commitment)
are presented as reflecting current users.

---

## 1. Path Planning Agent

**What it does:** Given a user's goals, barriers/norms, and support context, generates a personalized path
of races → milestones → tasks, using a template library plus LLM-generated milestone names/content per user.

**Ground truth:** There is no external "correct path" label — a generated path is not compared against a
gold-standard path. The measurable ground truth is internal: *did the agent write this milestone for this
user, or copy it from the template library verbatim?* `nameSource` is recorded per milestone at generation
time (`'generated'` vs. templated), which is a hard fact, not an estimate.

**Confidence formula** (`backend/core/agents/path_planning_agent.py`):
```
confidence = 0.35 + 0.6 * (generated_milestones / total_milestones)
```
A fully templated plan scores 0.35 (not zero — it's still a valid plan, just not personalized). A fully
generated plan approaches 0.95.

**Real label distribution (n=19 real path rows with parseable races):**
- Milestones per path: mean 21.1, min 16, max 32
- We do not currently log the generated-vs-templated split in a queryable form outside the payload itself —
  **this is a real gap**: to report today's actual average confidence we'd need to re-parse all 19 payloads
  for `nameSource`, which we have not done for this brief. That's a concrete, cheap next step.

**Example metadata (from a real payload):** `path.races[0]` = `{id, goal, name, models, progress,
milestones}`; each milestone carries `nameSource`, estimated duration (task-derived, not guessed), and
linked tools/tasks.

---

## 2. Pattern Recognition Agent

**What it does:** Embeds a user's profile + barriers (1536-dim, `text-embedding-ada-002`), searches
`pattern_user_embeddings` via a Supabase pgvector RPC for similar users, and surfaces which "models" (path
strategies) worked for them.

**This is the one Vector specifically flagged as low (0.2).** Here is exactly why, in the agent's own
comment (`pattern_recognition_agent.py`):

> The RPC's "similarity" field cannot be used for confidence — it blends a ranking score with a
> success-rate bias and a personalization term, so every row measures ~1.016 regardless of match quality.
> Averaging it would report near-certainty even when matches are poor.

**Ground truth:** the only trustworthy signal is *how many genuinely comparable users the RPC returned past
its match threshold* — not how "similar" they claim to be.

**Confidence formula:**
```
confidence = min(similar_users_returned / 10, 1.0)   # 10 requested per call
```
A real user who currently matches only 2 of the 10 requested peers scores 0.2 — **this is the 20% Vector
saw, and it is a faithful, literal small-denominator problem, not a bug.**

**Real label distribution:** `pattern_user_embeddings` has 39 rows total, only **16 tied to a currently
real user** (the rest are orphaned, same pattern as race_progress above). A real query today draws from a
pool of 16 people spread across ~50 distinct condition combinations (see the diagnostic taxonomy) — the
agent returning "2 of 10" is not a defect, it's an accurate read of a genuinely thin pool.

**What would move this number:** more real users with embeddings (the actual gap), NOT a change to the
formula. This is the clearest "we know exactly what more data would do" agent in the set.

---

## 3. Tool Recommendation Agent

**What it does:** Matches tools/resources to a milestone's barriers, ranks by relevance + community rating
evidence.

**Ground truth:** community ratings/reviews on the recommended resource (`reviews > 0` is the operational
proxy for "this recommendation has been validated by someone").

**Confidence formula** (`tool_recommendation_agent.py`):
```
evidence    = 0.6 + 0.4 * (rated_tools / total_tools)
confidence  = mean_relevance_score * evidence
```
No catalogue match → 0.0 (not a flat default). This means confidence is capped by **how many of the
132 resources have any reviews at all** — which is a directly measurable gap:

**Real label distribution (resources table, n=132):**
| status | count |
|---|---|
| approved | 95 |
| pending | 37 |

| category | count |
|---|---|
| School | 24 |
| Park | 22 |
| Therapist | 21 |
| Store | 14 |
| Community Center | 13 |
| Recreation | 10 |
| Doctor | 9 |
| Support Group | 9 |
| Employment | 5 |
| Housing | 4 |
| uncategorized/org | 1 |

**Gap to flag to Vector:** Employment (5) and Housing (4) — two of the highest-stakes categories for adult
independence — are the thinnest, and we don't yet have a query for how many of the 95 approved resources
carry any reviews. That review-coverage number is the direct driver of this agent's confidence ceiling and
should be pulled before the next meeting.

---

## 4. Calendar Optimization Agent

**What it does:** Places a week's worth of tasks into a barrier-aware daily schedule.

**Ground truth:** not "did it schedule everything" — deliberately not that. The agent comment is explicit:
a real run scheduled 30 of 80 backlog tasks in one week (16 milestones = several weeks of real work), and
rewarding backlog exhaustion would push the agent to cram, which is the opposite of the product's intent.

**Confidence formula** (`calendar_optimization_agent.py`):
```
fill        = days_with_any_task / total_days_in_week
personalised = 1.0 if user_has_preferred_time_buckets else 0.75
confidence  = fill * personalised
```

**Real label distribution:** not yet pulled per-user (would require iterating each real user's current
week). This is a second concrete "cheap to get, not yet gotten" number for the next pass.

---

## 5. Reflection Analysis Agent

**What it does:** Sentiment + pattern + concern extraction from a user's journal/reflection entry.

**Ground truth:** the length and pattern-density of what the user actually wrote — a one-word entry cannot
support the same confidence as a paragraph, and the formula treats that as a hard floor rather than
inferring from a short entry anyway.

**Confidence formula** (`reflection_analysis_agent.py`):
```
depth      = min(word_count / 60, 1.0)
signal     = min(detected_patterns / 3, 1.0)
confidence = 0.3 + 0.5*depth + 0.2*signal      # 0.0 if the entry is empty
```

**Real label distribution:** not pulled — reflections table wasn't included in this run's query. Next step.

---

## 6. Adaptation Agent

**What it does:** Adjusts a user's plan (milestones, tasks, barrier accommodations) based on reflection
insights and completion trends.

**Ground truth:** whether the agent found something to actually adapt. No adaptations fired is a real,
different answer from a low-confidence guess — the old flat 0.78 conflated the two.

**Confidence formula** (`adaptation_agent.py`):
```
confidence = min(0.4 + 0.15 * num_adaptations_fired, 1.0)     # 0.0 if none fired
```
Explicitly does **not** learn from other agents' past adaptations as "success examples" — only direct user
outcomes may influence future behavior (see code comment on why).

**Real label distribution:** not pulled — would need an adaptation-events log, which doesn't currently
exist as a queryable table. This is the agent with the least existing instrumentation.

---

## What this brief tells us about the "gap analysis" Vector asked for

1. **Pattern Recognition's low score is fully explained and expected**, not a bug — the fix is more real
   users with embeddings (16 today), which is the same "onboard real users" priority Malikeh already named
   as the top roadmap item.
2. **Three agents (Path Planning, Calendar Optimization, Reflection Analysis) have a derived, honest
   confidence formula but no queryable label-distribution log yet** — the data exists in the payload, we
   just haven't extracted it into a reportable form. That's real, bounded work, not a research problem.
3. **Adaptation Agent has no event log at all.** If we want to evaluate it the way Vector is asking, that's
   a new table, not a new query.
4. **The resource catalogue's review coverage** (not yet measured) is the actual ceiling on Tool
   Recommendation's confidence — worth pulling before positioning that agent as "needs more resources"
   generically.
5. **The `race_progress` orphaning issue** should be root-caused before any completion-based stat
   (Focus/Commitment, and by extension any agent that reads them) is presented as reflecting current users.

None of the above requires new experiments — items 2-4 are queries against data we already have, which is
exactly what Malikeh said would be an acceptable answer for this round.
