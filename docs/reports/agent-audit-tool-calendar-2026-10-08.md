# Tool Recommendation and Calendar Optimization: evaluation audit (8 October 2026)

Report only: no behaviour was changed. It follows the shape of the Pattern
Recognition slide: mechanics, the measured result, what an evaluation would
need, and one open question per agent.

Every number comes from `python -m scripts.agent_audit_tool_calendar`
(from backend/), run on 8 October against the production database. The
script is read-only and prints counts only.

Paths are split into two eras:
- **legacy:** 16 paths whose milestones predate commit 064801c. They still
  hold the old hardcoded confidence values.
- **current:** the other 79.

## Figures in the request, checked

| Figure | What the data says |
| --- | --- |
| Tool Recommendation confidence ranges 0.0–0.78 | **Mixes two eras.** All 16 legacy paths hold the old hardcoded 0.78. The 79 current paths range from 0.00 to 0.76, median 0.45. |
| Calendar Optimization has 26 tasks with high/med/low energy | **Two different things.** 26 is the `calendar_tasks` table: 22 imported from .ics files and 4 others. None is completed, and it has no energy field. Energy levels live on the agent's schedule days inside each stored path. Every one of the 95 schedules has the same pattern, set by the weekday: medium ×3, high ×1, low ×2, varies ×1. Each schedule holds 29–33 tasks. |
| Only 2 of 521 ratings are from real users | **Correct.** The other 519 are 515 from seed personas (`@test.com`) and 4 from team accounts. |

---

## Tool Recommendation

### Mechanics

**What it reads:**
- the approved resources, at most 500, in no particular order;
- every rating, with no filter on who gave it;
- learned rewards per tool from `tool_outcomes`.

**What it writes:** nothing. It returns, inside the stored path:
- the top 6 resources for each milestone, each with a `relevanceScore`;
- up to 4 "pit stop" resources per kind;
- a confidence;
- a one-sentence explanation.

**What is computed:**
- **Relevance:**
  - 0.55 × how well the resource fits the person's conditions, a 0–1 score
    from the LLM;
  - \+ 0.30 × rating / 5 × min(reviews / 10, 1), only when the resource
    has ratings;
  - \+ 0.15 × min(2 × the share of the milestone's longer words that also
    appear in the resource), capped at 1.
- **Confidence:** mean relevance × (0.6 + 0.4 × the share of returned
  resources with any rating).

**What is fixed:**
- the weights 0.55, 0.30, 0.15, 0.6 and 0.4;
- the 10-review saturation;
- the top 6;
- a fit of 0.5 for every resource when there is no LLM or no condition, and
  for every resource past the first 60, which the LLM never sees.

**What never applies:** the blend with learned rewards
(0.7 × relevance + 0.3 × reward). `tool_outcomes` has 0 rows, and its keys
couldn't match anyway: the agent looks up `sh_<id>`, and ResourceHub stores
the bare id. The journal also always sends an empty list of tools used.

### Measured

| | Paths | Range | Median | Middle half |
| --- | --- | --- | --- | --- |
| Confidence, legacy | 16 | 0.78 (constant) | 0.78 | — |
| Confidence, current | 79 | 0.00–0.76 | 0.45 | 0.26–0.53 |
| `relevanceScore`, each of 7,968 recommendations (current) | 79 | 0.00–0.82 | 0.47 | 0.41–0.55 |

The same few resources come back for every milestone of a path. The median
path's recommendations are 6% distinct resources. The pool and the fit
scores are identical for every milestone, and only the 0.15 word-overlap
term differs.

### What it would take to evaluate it

**Labels that exist today:**
- 2 real ratings;
- 6 `saved_resources` rows from real accounts (4 "using", 2 "wishlist");
- milestone completions in `race_progress`: 84 from real accounts, not
  linked to any tool.

**Labels that don't exist:**
- **Which resources were recommended to whom.** The snapshot that should
  record them (`user_latest_context.recommended_tool_ids`) is empty for all
  72 rows. It reads a key the agent never returns, so a later rating or
  save can't be traced back to a recommendation.
- **Whether a recommended tool helped.** `tool_outcomes` has 0 rows.

**Metrics that can be computed today:** only descriptive ones (the
distributions above, coverage of the catalogue, the share of recommendations
with any real rating). Nothing can be scored against ground truth. The
minimum would be:
1. record what was recommended;
2. capture a per-recommendation signal (saved, used, or "helped");
3. make the stored tool ids match.

**Caution:**
- The confidence is the agent's own scores times rating coverage, not a
  measure of quality.
- 99% of the ratings it counts were written by seed personas.
- The deck says learned rewards are "already folded into ranking"
  (`docs/vector-evaluation-presentation.md`, section 4). In effect they
  are not.

### Open question

**What counts as a good recommendation for this person?** For example:
saving it, using it, rating it well, or saying in a check-in that it
helped. Until that is decided, nothing can be collected or scored.

---

## Calendar Optimization

### Mechanics

**What it reads:**
- the person's conditions as typed, lowercased with spaces turned into
  underscores; rules exist only for `autism`, `adhd`, `ocd` and `bipolar`;
- the planner's tasks (priority, difficulty, length);
- learned time-of-day preferences from `calendar_outcomes`.

**What it writes:** nothing. It returns, inside the stored path:
- a 7-day schedule starting today;
- worst, average and best scenarios;
- the rules applied;
- unscheduled tasks;
- a confidence;
- a one-sentence explanation, the only use of the LLM.

**What is fixed:**
- **each weekday's theme and energy level**: Monday medium, Tuesday high,
  Wednesday and Thursday medium, Friday low, Saturday varies, Sunday low;
- **tasks per day**: 5, with fewer on low-energy days and more on
  high-energy ones;
- **task length caps and buffers by condition**: ADHD 25 minutes, autism
  15-minute buffers, OCD 1.5× time.

**Confidence:** (days with work ÷ 7) × (1.0 if learned preferences exist,
else 0.75). No learned preferences exist (`calendar_outcomes` has 0 rows)
and every schedule fills all 7 days, so it is 0.75 for everyone.

### Measured

| | Paths | Values |
| --- | --- | --- |
| Confidence, legacy | 16 | 0.82 every time (the old constant) |
| Confidence, current | 79 | 0.75 for 78; 0.28 for 1 (the formula from commit 064801c, replaced four hours later) |
| Energy pattern per 7-day schedule | 95 | Identical in all 95: medium ×3, high ×1, low ×2, varies ×1 |
| Tasks scheduled per path | 95 | 29–33, median 30 |
| Task-days by the day's energy | 95 | medium 1,425; high 557; varies 475; low 473 |

The condition rules miss most of the people they were written for, because
the agent matches typed labels instead of using the condition map
(`core/condition_taxonomy.py`):

| Condition | Paths of people with it | Its calendar rules ran on |
| --- | --- | --- |
| Autism | 20 | 6 |
| OCD | 10 | 2 |
| ADHD | 27 | 25 |

The rules didn't run for these labels: "Autism spectrum disorder" (13),
"Obsessive-compulsive and related conditions" (8) and "AuDHD" (3).

### What it would take to evaluate it

**Labels that exist today:**
- 26 `calendar_tasks` rows: 22 imported, 0 completed, 2 from real
  accounts;
- milestone completions in `race_progress`, which don't say when a task was
  done.

**Labels that don't exist:**
- **Whether a scheduled task was done on the day it was planned.** Ticking
  off an agent-scheduled task is kept in the page only, and a task gets a
  row only if the person drags it.
- **Feedback from calendar journal entries.** `calendar_outcomes` and
  `reflections` both have 0 rows.
- **Anything about the person's own energy.** The energy shown is the
  weekday's.

**Metrics that can be computed today:** none against outcomes, only the
descriptive ones above. The minimum would be:
1. save the completion of agent-scheduled tasks together with the planned
   day;
2. ask about energy, or about whether the week felt manageable.

**Caution:**
- 0.75 is a constant, not a measurement.
- The energy distribution describes the weekday, not people.
- The learned re-ranking builds its lookup key from fields the day records
  don't carry, so it could match only medium-energy days. It is dormant
  anyway, with 0 outcomes.
- The deck says full confidence comes from a user who has "told us their
  preferred time-of-day buckets" (section 5). They can only come from
  learned outcomes, and there are none.

### Open question

**What makes a week good for this person?** For example: tasks done on the
day they were planned, the person saying it felt manageable, or energy
that matches their own rather than the weekday's. Ticking off a scheduled
task isn't saved today, and nobody has been asked.
