# Tool Recommendation: pool, baseline, ratings and feedback (13 October 2026)

Tool Recommendation only. Each item is on its own branch, each one stacked on
the previous item's branch:

| Item | Branch |
| --- | --- |
| 0 | `report/tool-rec-0-pool` |
| 1 | `report/tool-rec-1-baseline` |
| 2 | `report/tool-rec-2-ratings` |
| 3 | `report/tool-rec-3-feedback` (no feature built: one already exists) |
| 4 | `feat/tool-rec-4-run-log` |

Nothing is pushed, deployed or applied.

Every number comes from `python -m scripts.tool_rec_audit` (from backend/),
run on 13 October against the production database, unless it says otherwise.
- The script only selects.
- It prints counts, never ids, emails or anything people typed.
- "Real" accounts use the same email rules as the other audits.
- Anything not confirmed is marked NOT YET VERIFIED.

## Item 0. What it recommends from

**The pool.** The agent draws from ResourceHub's `resources` table, the
same rows ResourceHub shows (`_fetch_resource_pool` in
`core/agents/tool_recommendation_agent.py`):
- **The query:** only rows with `status = 'approved'`, at most 500, in no
  particular order.
- **One exclusion:** Autinerary's own listing is left out (Group 24).
- **Ratings:** each row gets its mean rating from the `ratings` table.
- **Model scoring:** only the first 60 rows of the pool get a fit score from
  the model; the rest score a neutral 0.5.

ResourceHub's browse page has no status filter. Its recommenders
(`servicehub-mvp/lib/resources/recommendations.ts`) also read only approved
rows.

**The directory, checked.** The request reported 9,673 rows: 1 approved,
9,541 pending, 131 rejected. Production holds something else now:

| Status | Rows | Where they came from |
| --- | --- | --- |
| Approved | 9,561 | 9,541 OpenStreetMap places imported on 22 September, 19 organisations added on 5 October, and Autinerary's own listing (26 August) |
| Pending | **0** | |
| Rejected | 131 | The seed rows of 31 May |
| All | 9,692 | |

**The request's figures fit an earlier day.**
- 9,673 + the 19 organisations added on 5 October = 9,692.
- The import (6cf85e3, STEP 39) staged every place as `pending`.
- So the request's figures were likely true on 22 September, between the
  import and the approval.

When the places were approved, and the seed rows rejected, can't be read from
the table. There is no status history, and `updated_at` equals `created_at` on
every row. The exact dates are **NOT YET VERIFIED**. The paths narrow it down
(below).

**The pool today: 499 rows**, the 500 the query returns less Autinerary's own
listing. All 499 are OpenStreetMap places imported on 22 September.
- **By category:**

  | Park | School | Social Services | Doctor | Community Center | Recreation | Senior Care | Food Support | Therapist | Others |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | 165 | 135 | 50 | 41 | 34 | 28 | 25 | 12 | 6 | 3 |

- **What's missing:** of the 19 support organisations added for autism, ADHD
  and learning disabilities, none is in the pool.
- **What the model sees:** the first 60, all it scores, include 19 parks and
  2 therapists.

**What stored paths point at.** These are the per-milestone recommendations
in each stored path, by the status their resource has today:

| | Recommendations | Approved | Pending | Rejected | Not a ResourceHub row |
| --- | --- | --- | --- | --- | --- |
| Current paths (80), all accounts | 8,064 | 1,440 | 0 | **6,624** | 0 |
| Current paths, real accounts only | 7,008 | 672 | 0 | **6,336** | 0 |
| Pit stop shelf, current paths | 791 | 107 | 0 | 684 | 0 |
| Legacy paths (16) | 4,920 | 0 | 0 | 0 | 4,920 (the old built-in list, `svc_…` ids) |

**Most of what current paths recommend has since been rejected.**
- **How much:** 82% of their recommendations point at the rejected seed rows:
  33 distinct rows, in 57 of the 80 current paths.
- **When the pool changed** (the day each path was generated):

  | Paths generated | Their recommendations point at |
  | --- | --- |
  | 27 August to 21 September (57 paths) | Seed rows only, all rejected now |
  | 22 September | One path at seed rows, two at the new places |
  | 23 September to 9 October | Approved places only |

  So the pool switched from the seed rows to the imported places on
  22 September.
- **Approved when made:** the agent reads only approved rows, so every one of
  these was approved when it was recommended.
- **Still shown:** stored paths keep the recommendations they were given, so
  people who planned before 22 September still see seed entries.

  Whether the app hides rejected entries when it shows a path's tools was not
  checked: **NOT YET VERIFIED**. The Path's weekly picks and "Your saved
  resources" do hide them (`docs/first-visit-to-return.md`).

## Item 1. Baseline

Current paths (`is_legacy` = false) from real accounts only: **69 paths**.

| Measure | Value |
| --- | --- |
| Paths with at least one recommendation | 69 of 69 (100%) |
| Recommendations per path | mean 101.6, median 96, min 16, max 192 (6 per milestone, 16 milestones per goal) |
| Distinct items recommended | 68, across 7,008 recommendations |
| **Concentration: the top 5 items' share** | **52%** (3,678 of 7,008); the top item alone 12% |
| **Relevance proxy** | **55%** of the 4,224 recommendations made to people with a normalised condition (below) |

**The top 5 items are all seed rows, rejected since:**

| Item | Recommendations |
| --- | --- |
| "Sensory-Friendly Movie Theater - Montreal 2" | 845 |
| "Sensory-Friendly Retail Store - Montreal 6" | 800 |
| "Adult Autism Meetup" | 754 |
| "Parent Support Network - Toronto 5" | 657 |
| "Accessible Community Park - Vancouver 2" | 622 |

**The relevance proxy, defined:**
- **The person's conditions:** the path's `barrierTypes`, normalised with
  `core/condition_taxonomy.py`. Each condition has one broad category:
  neurodevelopmental, learning, mental health, and so on.
- **A match:** a recommendation counts as relevant when its resource
  category serves one of those broad categories, in the map `SERVES` in
  `scripts/tool_rec_audit.py`:

  | Broad category of condition | Resource categories that serve it |
  | --- | --- |
  | Neurodevelopmental, learning, intellectual or developmental, communication | therapist, doctor, support group, organisation, school |
  | Sensory processing, mental health, sensory disability, physical, chronic health | therapist, doctor, support group, organisation |
  | Socioeconomic | food support, social services, supported housing, shelter, employment, organisation |
  | Language | community centre, school, social services, organisation |
  | Identity | support group, community centre, organisation |

  Parks, recreation, stores, books and apps serve everyone, so they count
  for no one.
- **Read literally**, "a category that matches a condition" gives **0%**: no
  ResourceHub category names a condition.
- **Who is counted:** 2,784 recommendations (40%) went to people with no
  normalised condition ("none", "prefer not to share" or free text), and
  are left out of the 55%.
- **It's coarse.** A park can help an autistic child, and a school isn't
  "for" anxiety. It is a proxy, not a judgment of fit.

**Recommendations by resource category:**

| Support group | Store | Park | Recreation | Therapist | School | Organisation | Doctor | Community centre | Social services | Senior care |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,605 | 1,362 | 1,021 | 849 | 750 | 619 | 338 | 195 | 195 | 73 | 1 |

**The agent's confidence:**

| Paths | n | Mean | Median | Quartiles | Range | Distinct values | By range |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Current, real accounts | 69 | 0.46 | 0.45 | 0.44–0.53 | 0.00–0.76 | 25 | 0: 2 · up to 0.2: 6 · 0.2–0.4: 7 · 0.4–0.6: 41 · 0.6–0.8: 13 |
| Current, all accounts | 80 | 0.44 | 0.45 | 0.26–0.53 | 0.00–0.76 | 27 | |
| Legacy, real accounts | 9 | 0.78 | 0.78 | — | 0.78 | 1 (the old constant) | |
| Legacy, all accounts | 16 | 0.78 | 0.78 | — | 0.78 | 1 | |

- **What it is:** the mean relevance score of what was returned, times
  (0.6 + 0.4 × the share of returned items that have any rating).
- **What it rewards:** most of those ratings are from seed personas (item 2),
  so the confidence is highest where the seed ratings are.

## Item 2. What ratings exist

**Confirmed: 2 of 521 ratings are from real users.** The rest are 515 from
seed personas (`@test.com`, created by ResourceHub's seeding,
`servicehub-mvp/scripts/SEEDING.md`) and 4 from team accounts.

| Question | Answer |
| --- | --- |
| Which table | ResourceHub's `ratings` (shared Supabase), 521 rows from 12 raters on 105 resources |
| What they rate | A ResourceHub place: an overall score of 1–5, and optionally a score per barrier and a comment (413 rows have one). ResourceHub's form also copies the rater's conditions and relationships onto the row |
| Who writes them | Three sources, listed below |
| Whether Tool Recommendation reads them | **Yes: every row, whoever wrote it.** Details below |

**Who writes them:**
1. **ResourceHub's rating form** (`servicehub-mvp/app/api/resources/[id]/ratings/route.ts`): signed in, approved resources only.
2. **The app's Milestone View**, through "How well did it help?" (`frontend/app/api/me/resource-rating/route.ts`): a score only, approved resources only, one per person per resource.
3. **ResourceHub's seed data:** the 515 persona rows.

**How Tool Recommendation reads them.** `_fetch_resource_pool` reads
`resource_id` and `overall_score`, with no filter on who rated. It uses the
mean and count per resource:
- **in ranking:** 0.30 × mean ÷ 5 × min(count ÷ 10, 1);
- **in the confidence:** the share of returned items that have any rating.

It doesn't read the per-barrier scores, the comments or the rater's
conditions.

**What the ratings point at now:**
- **On rejected seed rows:** 520 of the 521.
- **On today's pool:** none. None of its 499 places has a rating, so ratings
  don't affect any recommendation made today.

  For paths made before 22 September, the seed personas' ratings did shape
  the ranking: they rated the seed rows that were then the pool.
- **The 2 real ratings:**
  - scores 4 and 3, written on 22 and 24 September;
  - one on a now-rejected seed row, one on an approved place that isn't in
    the pool.
- **Which form wrote each row,** going by which fields are filled:

  | Form | Rows | Real ratings |
  | --- | --- | --- |
  | ResourceHub's form (the rater's conditions or barrier scores are recorded) | 455 | 1 |
  | A score only | 66 | 1 |

  "A score only" means the Milestone View, or ResourceHub's form with
  nothing else filled. The table doesn't record its source, so this split is
  **NOT YET VERIFIED**.

**Related signals:**
- **`saved_resources`:** 8 rows, 6 of them from real accounts. 7 of the 8
  are now-rejected seed rows.
- **`tool_outcomes`:** 0 rows. It is the learned reward the agent blends in.

Nothing was changed.

## Item 3. "Was this useful?" feedback

**A feedback path already exists, so a second one was not built.**

**Wording and placement (the existing one):**
- **Where:** the Milestone View (`/milestones`), in the Tools panel. It shows
  up to 8 recommended tools, taken from the per-milestone recommendations and
  the pit stop shelf without repeats.
- **What each tool shows:**
  - the tool's name and type;
  - "What this helps with";
  - **Wishlist**, **Currently Using** and **Open**;
  - below a rule, **"How well did it help?"** with 1 to 5 stars
    (`frontend/app/milestones/page.tsx:536`).
- **What it stores:**
  - a row in `ratings` (`user_id`, `resource_id`, `overall_score`,
    `created_at`), through `POST /api/me/resource-rating`;
  - one per tool per person: rating again replaces the score
    (`onConflict: 'resource_id,user_id'`);
  - no feature flag: it is always on.

Against what was asked for (Yes or No, once per tool per person, with
`user_id`, `path_id`, `tool_id`, `answer`, `created_at`), it records a 1–5
score instead of Yes or No, and **no path id**.

**What's wrong with it.** Found by reading the code; not exercised in a
browser, because that would write to production.

1. **Ratings can't be tied to a recommendation.** There's no path id, and a
   score is about the resource, not the recommendation that showed it. The
   rating can't be traced back to the path the tool came from.
2. **Most stars save nothing, silently.** The route refuses resources that
   aren't approved (`route.ts:81`, 400 "Resource is not available for
   rating"). 82% of stored recommendations are rejected seed rows (item 0).
   The page doesn't read the response (`page.tsx:170`), so the stars light up
   and nothing is saved.
3. **The stars shown belong to a slot, not a tool.**
   - The page keeps its star state per "barrier" slot, `b1` to `b5`,
     assigned as milestone number modulo 5 (pit stop tools always get `b1`),
     and saves it in `localStorage` (`page.tsx:80`, `262`, `473`).
   - Rating one tool lights up the same stars on every other tool in that
     slot, though only the rated tool is sent.
4. **Few people see it.** The milestone pages have been opened 3 times ever
   (the Path Planning audit, 13 October).
5. **The agent reads every rating.** Seed personas' included (item 2).

Changing this control is a behaviour change the request didn't ask for, so
it is left for a decision. What fixing it would take:
- **Add a path id** to what is stored: a column on `ratings`, or a small
  table like `milestone_ratings`.
- **Tell the person** when a rating isn't saved.
- **Keep the star state per tool.**
- **Count only real ratings** in the agent.

## Item 4. Run log

`scripts/tool_rec_audit.py` calls `core/evaluation_runs.py` at the start of
a run (`start`, once its inputs are read) and at the end (`finish`).
- **Never through the Supabase client.** The row goes only to the Postgres
  named by `EVALUATION_RUNS_DSN`, so a run against production writes nothing
  there. Production's `evaluation_runs` stays empty.
- **Without `EVALUATION_RUNS_DSN`,** the run says it wasn't logged.
- **What it records:** counts and hashes only. No user ids, emails or free
  text.

**One row**, from the run on 13 October against production, logged in a
local Postgres that has STEP 61's table:

```json
{
  "run_id": "f3ea7f0c-537d-4ea1-b0d6-411778615deb",
  "script": "scripts.tool_rec_audit",
  "git_commit": "068e570",
  "started_at": "2026-10-13T02:15:29.198956-04:00",
  "ended_at": "2026-10-13T02:15:32.870247-04:00",
  "inputs": {
    "paths": 96,
    "is_legacy_excluded": 16,
    "recommendations": {"current": 8064, "current_real_accounts": 7008, "legacy": 4920},
    "point_at_approved": 1440,
    "point_at": {"approved": 1440, "rejected": 6624},
    "resources": {"approved": 9561, "rejected": 131},
    "condition_map_hash": "841a277543",
    "real_feedback_answers": {"ratings": 2, "scores": {"3": 1, "4": 1}},
    "settings": {"pool_limit": 500, "llm_scored": 60, "relevance_map_hash": "65506ed4ff84"}
  }
}
```

- **`condition_map_hash`** is `TAXONOMY_VERSION` from
  `core/condition_taxonomy.py`.
- **`real_feedback_answers`** are the real accounts' rows in `ratings`, the
  table the existing "How well did it help?" control writes to (item 3).

**To run it,** from backend/:

```
EVALUATION_RUNS_DSN=postgresql://... python -m scripts.tool_rec_audit
```

Left alone, as asked: the community-written resource list inside the
tool-ranking prompt, and ResourceHub's moderation prompt.
