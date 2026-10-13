# Tool Recommendation: pool, baseline, ratings and feedback (13 October 2026)

Tool Recommendation only. Each item is on its own branch, each one stacked on
the previous item's branch:

| Item | Branch |
| --- | --- |
| 0 | `report/tool-rec-0-pool` |
| 1 | `report/tool-rec-1-baseline` |
| 2 | `report/tool-rec-2-ratings` |
| 3 | `feat/tool-rec-3-useful` |
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
