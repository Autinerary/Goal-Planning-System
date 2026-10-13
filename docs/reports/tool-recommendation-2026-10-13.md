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
