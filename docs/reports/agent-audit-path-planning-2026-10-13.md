# Path Planning: evaluation audit (13 October 2026)

Report only: no behaviour was changed. It follows the shape of the other
agent audits ([Tool Recommendation and Calendar
Optimization](agent-audit-tool-calendar-2026-10-08.md)): mechanics, the
measured result, quality checks, what an evaluation would need, and one open
question.

Every number comes from `python -m scripts.agent_audit_path_planning` (from
backend/), run on 13 October against the production database, unless it says
otherwise.
- **Read-only.** The script only selects and prints counts, never ids or
  anything people typed.
- **Run log.** It calls the run log (`core/evaluation_runs.py`) at the start
  and the end, but never through the Supabase client.
  - The final run, `fc82e0bb-34ae-479f-85fd-47f2cd31534b` at commit e7d90b0,
    is logged in a local Postgres named by `EVALUATION_RUNS_DSN`.
  - Production's `evaluation_runs` (0 rows) was not written.
  - Without that variable the script logs nothing, and says so.

Paths are split as in the other audits:
- **legacy:** the 16 paths flagged `user_paths.is_legacy` (STEP 53),
  generated from 31 May, before 064801c (26 August). Their confidence is the
  old fixed 0.85.
- **current:** the other 80, generated from 27 August to 9 October.

The column agrees with the payload rule on all 96.

**No stored path was made by the code running now.** The newest is from
9 October. Three changes to the planner came after it:
- the 64-milestone cap (2549bed), merged 11 October;
- fenced typed text in prompts (5438574), merged 11 October;
- plans for someone the user supports (b9d41e3), 12 October.

The production backend runs b9d41e3, which is the code described under
Mechanics. The measurements describe what the earlier code produced.

## Figures in the request, checked

| Figure | What the data says |
| --- | --- |
| `generation_jobs` has 284 rows | **296 now.** 284 is the total of jobs created up to 25 September. 12 more were created from 4 to 9 October, and all succeeded. |
| `path_planning_outcomes` has 4 rows | **Correct.** The 4 rows hold 6 rewards in all, the last from 13 September. |
| Milestone ratings exist | **The table does, with 0 rows.** The rating has been on every milestone's page since 11 October, and its route answers on production. No visit to a milestone page has been recorded since then. |

---

## Mechanics

### What it reads

**From the request, through the orchestrator:**
- the goals, as typed (up to 10, `core/guardrails.py`);
- the norms and conditions chosen;
- since 12 October, who the plan is for (`audience`);
- the support context: notes, strategies that worked, accommodations and
  recent challenges, up to 5,000 characters.

**From elsewhere:**
- Agent memory (`agent_memory`): the goals and milestone names of the
  person's last three planning sessions.
- Pattern Recognition's similar patterns: **passed in, never used.**
  `_generate_milestones_for_goal` takes them and doesn't read them.
- `path_planning_outcomes`, through `get_best_path_shape`, once per plan.
- The usage ledger (`llm_usage`), through the budget check, before every
  model call.

### What it writes

Nothing to the database itself. The onboarding route stores what it returns
in `user_paths.payload`, in three copies:
- `races[].milestones`, each with its tasks, which the app reads;
- `path.milestones`;
- `agentResponses[path_planning].result`, with the flat task list, the
  confidence and the quality report.

Around it:
- every model call adds a row to `llm_usage`;
- the orchestrator saves the plan's milestone count and mean estimate to
  `user_latest_context`;
- `path_planning_outcomes` is written by the reflections route, not the
  agent: +1 or −1 from "Was the path helpful?".

### Model, template, fixed or computed

| Part | Written by the model | When the model fails | Fixed or computed |
| --- | --- | --- | --- |
| Shape | — | — | **Fixed.** Every goal gets four life areas (education, workplace, relationships, health) with 4 milestones each: 16 per goal. Fewer per area only above the cap |
| Milestone names | One call per goal, for all four areas. Up to 8 words each; temperature 0.7, 900 tokens | The area's first 4 fixed template names, marked `nameSource: 'template'` | |
| Descriptions | Calls of 10 names, one sentence of up to 35 words each; 0.6 | `"<name> - tailored for <goal>"` | |
| Tasks | Calls of 3 milestones, 5 tasks each (up to 9 words, 10–30 minutes); 0.6. Then one call for each milestone left out | Five fixed phases: "Research and gather information: <name>", "Create action plan: …", and so on | Lengths kept to 5–45 minutes, at most 20 when a label reads `adhd` in any case |
| Helper tricks | One call per plan, 3 tricks | Fixed lists for the labels `adhd`, `autism` and `ocd`, or four generic lines | |
| Strategies, strengths, accommodations | One call, for the labels with no curated model | Empty | Curated models for 5 labels: `autism`, `adhd`, `ocd`, `race_visible_minority`, `bipolar`. A label matches only when, lowercased with spaces as underscores, it is one of these |
| `recommendedChoices` | — | — | **The same three choices on every milestone, with invented numbers:** success 87.5%, 84.2% and 91.3%, "attempts" 1,247, 983 and 567 |
| `estimatedDays` | — | — | **Computed** from the milestone's task minutes, at 45 a day, kept to 1–60. 7 until tasks exist |
| Difficulty, priority, status | — | — | **Fixed.** Easy, medium, medium, easy, easy; the first task high; the first milestone in progress |
| Confidence | — | — | **Computed:** 0.35 + 0.6 × the share of milestone names the model wrote |
| Explanation | — | — | **A fixed sentence:** "Generated personalized path with N milestones for G goals, considering B barrier types" |
| Learned shape | — | — | Would keep only the first N milestones, N being the best-rewarded count, and move each estimate halfway to the learned mean. Only when the profile has ≥ 20 rewards with a mean ≥ 0.25 |

**Model:**
- **How it's chosen (`core/llm.py`).** In order:
  1. the request's choice for this agent;
  2. the request's default;
  3. the local fine-tune, if `LOCAL_LLM_BASE_URL` is set;
  4. `OPENAI_MODEL`, if it is a listed model;
  5. gpt-4o-mini, then the first other model with a key.

  The effort is "medium" unless chosen: token budgets as written,
  temperature unchanged.
- **What production used.** Every Path Planning call in the usage ledger was
  gpt-4o-mini: 5,858 calls from 9 September to 12 October.
  - The ledger starts on 8 September, and 2 current paths are older. **The
    model for those 2 is NOT YET VERIFIED.**
  - Render's environment was not read.

**Prompts.** All are in `core/agents/path_planning_agent.py`:

| Prompt | Line |
| --- | --- |
| Names | 443 |
| Descriptions | 639 |
| Tasks, in batches | 774 |
| Tasks, one milestone | 860 |
| Helper tricks | 930 |
| Strategies for uncovered labels | 582 |

- Each asks for a fixed JSON shape and ends with "Respond ONLY with valid
  JSON". On OpenAI, JSON mode is also set.
- Typed text is fenced and capped (5438574): the goal at 300 characters,
  the support context at 5,000, prior sessions at 1,500.
- For a plan about someone else, the names, descriptions and tasks prompts
  also carry a rule: write about supporting that person, never the user's
  own career (b9d41e3).

**Model calls per plan (counted from the code):**
- For each goal: one names call and 2 description calls.
- For the plan: ⌈16 × goals ÷ 3⌉ task calls and one helper-tricks call.
- One more when a label has no curated model.

| Goals | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Calls | 10 or 11 | 18 or 19 | 26 or 27 | 35 or 36 |

Most go out at the same time, and a whole job takes a median of 35 seconds,
so they land in the same minute as the other agents' calls.

### When the model's output is malformed, or too much

**A failed or refused call:**
- **Failed.** An API error, an empty reply or JSON that doesn't parse
  returns nothing, and the fallback in the table above is used. Code fences
  around JSON are removed first.
- **Refused.** A call over the person's limit is refused before it is sent:
  by default 30 calls a minute or 300,000 tokens a day (`core/budget.py`).
  The refusal is raised outside the error handling.
  - In the names call, the helper-tricks call and a single milestone's tasks
    call, nothing catches it. The whole plan fails, and the job ends with
    the limit's message.
  - In the description and task batches, it is caught like any other
    failure.

**Too many or too few:**
- **Names.**
  - More than asked for are cut to 4 per area.
  - Fewer are kept as they are, so an area can come up short; nothing pads
    it.
  - Anything that isn't text is turned into text.
  - Names over 8 words aren't shortened.
- **Tasks.**
  - A milestone needs at least 3 named tasks, from its batch or else from its
    own call; otherwise it gets the five fixed phases.
  - More than 5 are cut to 5.
  - Names are cut at 120 characters and descriptions at 300.

**The quality gate** (`core/output_quality.py`) runs in the orchestrator,
after the agent. It:
- drops names under 3 characters or containing phrases like "as an ai" or
  "placeholder";
- drops a name repeated exactly within the same goal;
- gives four generic stages to a goal left with none;
- adds one starter task to a milestone left with none.

The confidence is computed before the gate, and the gate doesn't update it.

**The milestone cap** (`MAX_MILESTONES_PER_PATH` = 64):
- Above 64, each area gets fewer milestones before anything is generated:
  64 ÷ (4 × goals), at least 1.
- A final cut then keeps the first 64. With at most 10 goals it can't be
  reached: 10 × 4 × 1 = 40.
- **The cap has never run on a stored path.** It came after all of them, and
  no current path has more than 4 goals. Every job that asked for 5 or more
  failed (below).

---

## Measured

| | Current: 80 paths | All 96, legacy included |
| --- | --- | --- |
| Milestones per path | 16 in 63 paths, 32 in 16, 64 in 1: always exactly 16 per goal | 8 to 144, median 16. 5 legacy paths over 64; 4 legacy paths with fewer than 16 per goal |
| Tasks per milestone | 5, on every one of 1,584 milestones | 5, on every one of 2,404 |
| Confidence | **0.95 on all 80** | 0.85 on the 16 legacy paths (the old constant), 0.95 on the rest |
| Name source | 1,584 written by the model, 0 template | Plus 820 legacy milestones with no marker, 16 of them template names |
| Quality gate | Ran on all 80: no fallback, no goal backfilled, no task added | 14 legacy paths predate it |
| Descriptions from the fallback | 12 | 12 |
| Tasks from the fixed phases | 0 | 3,860, all in legacy paths (of their 4,100) |
| `estimatedDays` | 2 days for 1,236 milestones (78%), 3 for 255, 1 for 76. One path from 27 August still has the old random 7–30 | Legacy paths have the old random values |
| `recommendedChoices` | The fixed three, on all 1,584 | On all 2,404 |

**Accounts.** Of the current paths, 69 are from real accounts and 11 from
team accounts. "Real" uses the same email rules as the Vector deck.

**Confidence.** On all 80 current paths it equals its formula. The model wrote
every name, so it is the formula's maximum: 0.35 + 0.6 × 1 = 0.95. It
describes where the names came from, not the plan, and it hasn't varied once.

**Labels and the curated models.** 18 of the 80 current paths have a label
that reaches a curated model. The rest get model-written strategies.

| Condition | Current paths | Curated model used | Labels that miss it |
| --- | --- | --- | --- |
| ADHD | 19 | 18 | "AuDHD", in the one other path (checked separately: the script lists only labels found in 2 or more paths) |
| Autism | 14 | 0 | "Autism spectrum disorder", "AuDHD" |
| OCD | 8 | 0 | "Obsessive-compulsive and related conditions" |

The 20-minute task limit for ADHD also needs the label to read "ADHD". The
calendar audit found the same kind of exact matching.

### Generation failures

`generation_jobs` covers the whole pipeline, not Path Planning alone.

- **296 jobs, from 31 August to 9 October.** 73 succeeded and **223 failed
  (75%)**.
- **One message for all 223 failures:** "Too many requests in the last
  minute". This is the per-person limit on model calls: 30 a minute, unless
  `LLM_REQUESTS_PER_MINUTE` is set. **Production's value is NOT YET
  VERIFIED.**
- **Accounts.** 221 of the 223 failures were from real accounts.
- **By goals in the request:**

  | Goals | 1 | 2 | 3 | 4 | 5 or more |
  | --- | --- | --- | --- | --- | --- |
  | Succeeded | 56 of 56 | 15 of 16 | 0 of 58 | 1 of 99 | 0 of 66 |

- **When.** All the failures fell between 9 and 25 September. The limit
  arrived on 7 September (6141f66). The 12 jobs since 26 September each
  asked for one goal or none, and all succeeded.
- **Timing.** Median 35 seconds to succeed and 22 to fail.
- **What's left.** 71 of the 73 plans made are still stored. No job is
  stuck.
- **Whose calls.** Path Planning makes 91% of the calls in the usage ledger:
  5,858 of 6,409.
  - With three goals it needs 26–27 calls in the same minute, plus the
    other agents'.
  - A job keeps only the message, not which call was refused.
  - Blaming Path Planning fits the numbers but is **NOT YET VERIFIED.**

### `path_planning_outcomes`, the learner

- **What it holds.** 4 rows, for plans of 64, 128, 96 and 16 milestones,
  with 1, 3, 1 and 1 rewards. That is 6 rewards: five +1 and one −1, the
  last from 13 September.
- **Never applied.** No row has the 20 rewards needed, so it has never
  changed a plan.
- **It can't reach 20 as written.**
  - Its key, the profile signature, includes the first 32 characters of every
    goal as typed. Its docstring says "goal categories".
  - The 96 paths have 88 distinct signatures. In `user_latest_context`, at
    most 3 people share one.
- **Where the rewards came from.** `reflections` has 0 rows, so the 6 rewards
  can't be traced. **NOT YET VERIFIED.**

---

## Quality checks from stored data alone

### Definitions

These are in the script's docstring and tested in
`tests/test_agent_audit_path_planning.py`.

- **Words of a name or goal:**
  - lowercased, split on anything that isn't a letter or a digit;
  - without stopwords, words under 3 letters, and the generic verbs that open
    most names (get, make, find, build, create, start, improve, become,
    develop and a few more);
  - each cut to a stem: a final -ing, -ed, -es or -s removed, then the first
    6 letters.
- **Exact duplicate:** two milestones in one path whose names are the same
  once lowercased, without punctuation or extra spaces.
- **Near duplicate:**
  - not exact;
  - both names have at least 2 words;
  - their word sets overlap by at least 0.6 (Jaccard). Also counted at 0.5
    and 0.8.
- **Empty task:** no name once trimmed. **One-word task:** a name of one
  word.
- **A goal "appears" in its milestones** when at least one of its words is a
  word of at least one milestone name in its race. Descriptions aren't used,
  because the fallbacks paste the goal into them.

### Results

| Check | Current: 80 paths, 1,584 milestones, 7,920 tasks | All: 96 paths, 2,404 milestones, 12,020 tasks |
| --- | --- | --- |
| Exact duplicates within a goal | 0 | 14 pairs in 5 paths |
| Near duplicates within a goal | 3 pairs in 3 paths (at 0.5: 8 in 7; at 0.8: 0) | 93 pairs in 10 paths (at 0.5: 167 in 14; at 0.8: 23 in 5) |
| Exact duplicates across a path's goals | 4 pairs in 3 paths | 4 pairs in 3 paths |
| Near duplicates across a path's goals | 14 pairs in 5 paths (at 0.5: 27 in 11; at 0.8: 0) | 16 pairs in 6 paths (at 0.5: 29 in 12; at 0.8: 0) |
| Empty tasks | 0 | 0 |
| One-word tasks | 0 | 0 |
| Tasks without a description | 0 | 0 |
| Goals with no word in any milestone name | **22 of 95**, in 21 paths (4 more goals had no words to look for) | 35 of 113, in 34 paths |
| Goals with no milestones | 0 | 0 |

**Duplicates are rare in current paths.** The quality gate removes exact
repeats within a goal, but it doesn't compare goals. Most legacy duplicates
come from the old code, which put many goals into one race.

**The goal check is lexical, so 22 is an upper bound.** Three flagged goals
were checked by hand, from team test accounts only:
- two had steps plainly about the goal, in other words: for example, a
  university goal with steps about study schedules and an academic adviser;
- one was a one-word goal, too vague to plan for.

**Whether any real person's plan misses its goal is NOT YET VERIFIED.**
Finding out needs a person, or a check that compares meaning rather than
words.

The same hand check showed the fixed four-area shape at work: a
language-learning goal got workplace steps about using the language at work
and practising with colleagues.

---

## What can be evaluated now that milestone ratings exist

**Real ratings: 0.** `milestone_ratings` has no rows at all.

**The rating is live:**
- "How useful was this step for you?" (1–5) has been on each milestone's
  page since 11 October (0670fc0).
- The production backend (b9d41e3) answers its route: 401 without sign-in,
  checked on 13 October.
- That it shows for a signed-in person on production wasn't checked in a
  browser: **NOT YET VERIFIED.**

**Nobody has reached it.** The evidence is the `feature_use` event, which is
sent the first time each day a signed-in person opens a part of the app
(`frontend/lib/funnel.ts`):
- Since 11 October, there has been no "milestones" event, so no recorded
  visit to a milestone page.
- In that time the event recorded 36 day-visits to other parts of the app,
  25 of them to the Path.
- The milestone pages appear in it 3 times ever, the last on 10 October.

**Other signals:**
- **`reflections`:** 0 rows. "Was the path helpful?", the learner's reward,
  has no live source either.
- **`race_progress`:** 91 completions (84 from real accounts) and 3 hearts.
  - It has no path id, and milestone ids repeat across a person's paths. A
    completion can be tied to a plan only for people with one stored path.
  - That is 4 real people and 30 completions: 29 on legacy paths and 1 on a
    current plan.
- **`path_planning_outcomes`:** 6 rewards, all from before 14 September.

**What can be computed today:** only the descriptive measures above (shape,
provenance, duplicates, task form, goal words). Nothing can be scored against
anyone's judgment yet.

**What ratings would make possible.** A rating joins cleanly to its plan by
`user_id`, `path_id` and `milestone_id`. With enough of them:
1. **Usefulness by life area.** For example, are workplace steps rated lower
   for goals that aren't about work?
2. **Usefulness by position in a goal.** First steps against later ones.
3. **Plans about someone else against plans for oneself.** None is stored
   yet.
4. **Model-written names against template names.** Not until there are
   template names on current plans; there are 0.
5. **Confidence against usefulness.** Not with this confidence, which is
   0.95 on every current plan.

**Each comparison needs:**
- **The right ratings.** From real accounts, on current paths, from many
  different people. One person's 16 ratings of one plan are not 16
  independent judgments; `path_rating_scores` already averages them per
  plan.
- **Visitors to the milestone pages.** Ratings can't accumulate while nobody
  opens them.

**Caution:**
- **Ratings already change another agent.** Each rating re-indexes the person
  for Pattern Recognition, with the plan's score as their success rate
  (`api/routes/milestone_ratings.py`). The first ratings will steer Pattern
  Recognition as soon as they arrive.
- **The confidence is constant in practice.** It reports where names came
  from, not quality.
- **`recommendedChoices` stores invented success rates and attempt counts on
  every milestone.**
  - No page reads them: backend/, frontend/ and servicehub-mvp/ were searched.
  - Anything that starts showing them would present them as data.
- **The learner, if it ever triggered, would cut the end of the plan.** It
  keeps the first N milestones, and the list runs goal by goal and area by
  area, so whole goals and areas would go.

---

## Open question

**Should every goal get a roadmap in all four life areas?**

Today every goal becomes 16 milestones, 4 each in education, workplace,
relationships and health, whatever the goal is about. That one rule decides:
- **What people get.** A language-learning goal gets workplace steps. For
  parents this was Group 24's complaint, fixed on 12 October only for plans
  about someone else.
- **What it costs.** Path Planning makes 91% of the recorded model calls,
  about 8 for each goal.
- **What failed.** From three goals up, a plan needed more calls than the
  per-minute limit allows. 222 of 223 such requests failed in September.

The options:
- plan only the areas a goal is about;
- let the person choose the areas;
- keep all four.

That is a product decision. Once ratings come in, usefulness by area can
inform it, but can't make it.

---

## Running it

From backend/:

```
EVALUATION_RUNS_DSN=postgresql://... python -m scripts.agent_audit_path_planning
```

- **Read-only.** It only selects, and prints counts.
- **The run log.**
  - It goes to the database named by `EVALUATION_RUNS_DSN`, which needs
    STEP 61's table.
  - Without it, nothing is logged.
  - It never writes to production through the Supabase client.
- **The final run.** 13 October, `fc82e0bb-34ae-479f-85fd-47f2cd31534b` at
  e7d90b0, 27 seconds. Its logged inputs:
  - 96 paths, 296 jobs, 4 outcome rows;
  - 0 ratings, 94 `race_progress` rows, 0 reflections;
  - the settings.
- **Checks outside the script:**
  - the ratings route and `/health` on production;
  - the code history (`git log`);
  - the label on the one ADHD path that missed its curated model, printed
    only because it was a known condition name ("AuDHD");
  - the hand check of three flagged goals, from team test accounts only.

  Nothing a real person typed was printed or read by hand for this report.
