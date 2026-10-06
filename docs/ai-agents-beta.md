# The six AI agents during the beta

Riipen Labs' Group 5 asked whether "all six AI agents are needed right now,
or if some can wait". They warned that "6 multi-agent background AI
processes risk overcomplicating MVP or creating cognitive overload if
introduced early", and suggested keeping "AI personalization running behind
the scenes until basic onboarding is fully completed".

This note gives the facts and a recommendation.

**Decided 4 October 2026: keep all six agents for the beta.** Revisit pattern
recognition once there are a few hundred real users, using the report of
which parts of the app people open.

## What each agent does, and what it costs

AI use comes from the app's usage ledger (`llm_usage`, 8 September to 4
October 2026, 6,167 calls). That includes test and load-test traffic.

| Agent | Runs when | What people see | Share of AI use |
| --- | --- | --- | --- |
| Path planning | A path is created, at the end of setup | The path itself: races and milestones | 88% of tokens (5,690 calls) |
| Tool recommendation | A path is created | Tools for each milestone | 11% (360 calls) |
| Calendar optimization | A path is created, or a reflection changes the plan | The low, balanced and high-energy days. The schedule is rule-based; the AI only writes the explanation | 0.2% (78 calls) |
| Pattern recognition | A path is created | "Why we suggested this" notes, from people with similar answers | Not in the ledger: one embedding per person, then a database search. 71 people are indexed so far |
| Reflection analysis | After a journal entry, when the plan adapts | "What we noticed" | Almost none (10 calls) |
| Adaptation | After reflection analysis | "What changed and why". The changes are rule-based; the AI only writes the explanation | None recorded |

All of it uses `gpt-4o-mini`, apart from one call. Creating a path takes
about a minute (the median was 59 seconds with five people at once, in the
load test of 4 October), because the first four agents run one after
another.

## What has changed (Group 5's mitigation)

- **No AI during setup, unless someone asks for it.** The "AI
  Recommendations" step is gone from setup. Start here's starter resources,
  which use no AI, come after setup instead. Since 6 October the goal step
  has an optional **goal helper** (Riipen Labs, Group 11): one line,
  labelled "AI helper", that suggests goals from the ideas setup already
  shows when someone describes what they want in their own words. It runs
  only when asked, makes one small call per ask, and is not one of the six
  agents: the usage ledger records it as `goal_helper`. See
  [first-visit-to-return.md](first-visit-to-return.md).
- **AI explanations come after the essentials.** The page after setup used
  to open with two AI explanations ("How your path was built", "Why we
  suggested this"). They now sit below the first steps, and still show only
  when there is something to say.
- Every agent still runs as before, out of sight while the path is created.

## Recommendation

Keep all six for the beta. Cutting any of them saves very little: path
planning is the product and makes up almost all the cost, and the other
five together are about 11%, mostly tool recommendations. What made AI feel
like "a lot" was showing it early, and that is fixed.

If the team wants a smaller MVP anyway, these two can wait with the least
loss:

1. **Pattern recognition.** With 71 people indexed, "similar people" means
   very few people, so its suggestions rest on thin evidence. It also adds
   an embedding call and a search to every path creation. Turn it back on
   when there are a few hundred real users.
2. **The calendar's AI explanation.** The schedule is rule-based already;
   only the sentence explaining it uses AI.

Reflection analysis and adaptation only run when someone writes in the
journal, so they cost nothing for people who don't.

## How to decide with data

The funnel report (`python -m scripts.onboarding_funnel`, from `backend/`)
now shows which parts of the app each group opens (after STEP 49). For
example, if few people open the calendar, calendar optimization can wait;
if Tools is opened often, tool recommendation earns its 11%.

Where to change it: the generation graph is in `backend/core/orchestrator.py`
(`_build_generation_graph`). An agent comes out by removing its node and
joining the edges around it.
