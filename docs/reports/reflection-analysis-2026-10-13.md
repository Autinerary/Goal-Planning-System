# Reflection Analysis: what existed, and the smallest useful version (13 October 2026)

Reflection Analysis only. Each item is on its own branch, stacked in order
from `main`:

| Item | Branch |
| --- | --- |
| 0 | `report/reflection-0-verify` |
| 1 | `feat/reflection-1-analysis` |
| 2 | `feat/reflection-2-themes` |
| 3 | `feat/reflection-3-no-data` |
| 4 | `feat/reflection-4-evaluation` |

Nothing is pushed, deployed or applied.
- **Tested** with fixtures and local databases only. No real person's data
  was written or changed.
- **Production was only read,** for counts.
- Anything not confirmed is marked NOT YET VERIFIED.

## Item 0. What existed

**It was not "not started": code exists and runs on every journal entry.**
But it analyses the text of that one entry and nothing else, and what it
returns is mostly thrown away.

**The code:** `backend/core/agents/reflection_analysis_agent.py` (512 lines),
`ReflectionAnalysisAgent.analyze_reflection(reflection_data, user_id)`. For
the entry's text (its answers and free text) it returns:

| Part | How |
| --- | --- |
| `sentiment` | The model (`complete_json`), when one is configured. Otherwise counts of positive and negative keywords, defaulting to "neutral", 0.5, when none match |
| `patterns` | Keyword indicators (for example "didn't sleep"), joined to four hardcoded "coupled events" with made-up correlations (0.78, 0.72, 0.68, 0.74, "from research"), plus `learned_patterns` above an evidence bar of 20 observations and 0.65 |
| `concerns` | Keyword rules: burnout, negative self-talk, isolation, sustained negative mood |
| `insights` | The model (what works, what doesn't, recommendations, something to celebrate), with keyword rules as fallback |
| `progress` | **Constants:** `completion_rate` 0.65 ("Would be calculated from actual task data"), `mood_trend` "stable", `energy_level` "moderate" |
| `confidence` | From the text's length and the patterns found |

**What it reads:**
- the entry it is handed;
- the `learned_patterns` table, through `learning.get_top_learned_patterns`;
- the model.

**What it doesn't read:**
- past journal entries;
- milestone ratings;
- milestone completions;
- the person's path;
- the `user_id` it is given.

**What it writes:** nothing itself. The reflections route
(`api/routes/reflections.py`) stores its output in a `reflections` row:
- the sentiment;
- `completion_rate`, which is the constant 0.65;
- the whole response.

The completion people report on the journal page is used only to weigh the
reward, and is not stored.

**What calls it:** the orchestrator's adaptation graph
(`core/orchestrator.py`, `_node_reflection_analysis`), the first step of
`Orchestrator.adapt_path`.

| Caller of `adapt_path` | Called from |
| --- | --- |
| `POST /api/reflections/` | The journal page (`frontend/app/reflection/page.tsx`). The page ignores the response and shows "Reflection saved." |
| `POST /api/paths/{path_id}/adapt` | Nothing in either app |
| `PATCH /api/onboarding/{user_id}` | Nothing in either app |

**What Adaptation gets from it:** only `insights` and `progress`. The
concerns and patterns its rules read sit beside `insights`, not in it, so
they arrive empty. And the progress is the constant.

**Data, 13 October:**

| Table | Rows |
| --- | --- |
| `reflections` | 0 |
| `milestone_ratings` | 0 |
| `learned_patterns` | 0 |
| `adaptation_outcomes` | 0 |

The usage ledger shows 10 model calls by this agent, on 16, 21 and 24
September, all gpt-4o-mini. So some journal entries were analysed, but none
is stored. Possible reasons:
- they were written while signed out (stored under "user_123", which the
  insert refuses);
- the insert failed;
- they went with deleted accounts.

Which of these it was is **NOT YET VERIFIED**.
