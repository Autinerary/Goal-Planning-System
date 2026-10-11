# Adaptations: what happens today (8 October 2026)

The plan was to record each adaptation against the milestone it changed,
then ask "Did that help?" (yes or no) once it is applied and again a week
later, storing both answers in `adaptation_outcomes`. First: does any real
adaptation happen end to end, is the bandit ever called, and is
`adaptation_outcomes` written anywhere?

**Answer: no adaptation of anyone's plan happens today.** So the ask was not
built. Recording an adaptation "against the right milestone" needs decisions
that aren't code (below), and the instruction was to stop and describe them
in that case.

## What happens now

Counted in the database on 8 October: `reflections` 0 rows,
`adaptation_outcomes` 0, `calendar_outcomes` 0, `tool_outcomes` 0,
`path_planning_outcomes` 4, `user_latest_context` 72.

| Way in | Who calls it | What it does |
| --- | --- | --- |
| Journal entry, `POST /api/reflections` | The journal page (`frontend/app/reflection/page.tsx`) | Runs the reflection analysis and the adaptation step, then throws the result away. The page ignores the response and shows "Reflection saved." Nothing writes to the stored plan (`user_paths`). |
| `PATCH /api/onboarding/{user_id}` | Nothing in either app | Writes the adaptation into the stored plan, but reads it from the wrong level of the result (`adaptation_result["updated_milestones"]`, which is always absent). So no milestone or task ever changed. |
| `POST /api/paths/{path_id}/adapt` | Nothing | Changes a copy held in the server's memory only. |

### The adaptation step can't change anything

- **It can't fire a rule.** The orchestrator passes it only the `insights`
  part of the reflection analysis (`core/orchestrator.py`,
  `_node_adaptation`). The concerns, patterns, conditions and sentiment its
  rules read sit beside `insights`, not in it, so they arrive empty.
- **The completion rate is a constant 0.65.** It is "Would be calculated
  from actual task data" (`core/agents/reflection_analysis_agent.py`). That
  sits between the two thresholds, 0.5 and 0.8, so neither the
  low-completion rule nor the momentum rule fires.
- **If a rule did fire, it would name no milestone.** Its rules are about a
  person's whole load, for example "Reduce daily task count from 5 to 3".
  Its milestone and task changes are fixed placeholders (`updated_milestone_1`
  with status `modified`, and `updated_task_1`). The agent never loads the
  plan.

**Correction to the earlier storage finding.** It said the adaptation step
"wrote to fields nothing reads, with placeholder values". The code would
have written them there, but the read above always came back empty, so
nothing was ever written. `fix/tasks-on-milestones` (B5) routes those values
through `apply_adaptation`, which accepts only real milestone ids. Through
this route it still receives nothing.

### The "bandit"

There is no bandit in the usual sense: nothing explores. A few choices are
greedy averages over stored rewards:

| What | Reads | Called? | Data today |
| --- | --- | --- | --- |
| Adaptation thresholds | `best_rule_threshold` over `adaptation_outcomes` | **No.** `learning.get_adaptive_threshold` has no caller. The agent uses fixed 0.5 / 0.8. | 0 rows |
| Path shape | `path_planning_outcomes` (20 or more samples) | Yes, when a plan is made | 4 rows |
| Tools | `tool_outcomes` (10 or more) | Yes, when a plan is made | 0 rows. Its keys can't match either: the agent looks up `sh_<id>`, and ResourceHub stores the bare id. |
| Calendar | `calendar_outcomes` (10 or more) | Yes, when a plan is made | 0 rows |

### `adaptation_outcomes`

- **What writes to it:** a journal entry with an outcome, but only when a
  rule fires, which never happens. At the person's next entry,
  `close_adaptation_loop` credits all of their open rows from the last 14
  days.
- **Its columns:** user, reflection, rule, threshold, the next reward, and
  times. There is no path or milestone column.
- **What reads it:** only `best_rule_threshold`, which nothing calls.

## Decisions needed before an adaptation can be recorded against a milestone

1. **Which milestone an adaptation belongs to.** The rules change a person's
   overall load, not one step. Options:
   - the milestone the journal entry was about, when it was about one;
   - the next active milestone;
   - every milestone with tasks this week;
   - the path, with the milestone optional.
2. **Whether an adaptation is applied automatically or offered.** Today
   nothing applies one. "After an adaptation is applied, ask whether it
   helped" depends on which of these it is.
3. **Where the person sees it.** No page shows that a plan changed. The
   "What changed and why" banner never appears: it looks for an
   `adaptation` entry that stored plans never contain.
4. **When to ask.** Right after an adaptation is applied, it hasn't had
   time to help. A first ask on the next visit at least a day later, then a
   re-ask 7 days after that, is one option.

Fixing the adaptation step's inputs (the `insights` level and the constant
0.65) would make rules fire. With 1–3 undecided they would fire into nothing,
so that was left too.

### A starting point, for decision

- **Record:** add `path_id`, an optional `milestone_id`, and the adaptation
  itself to each `adaptation_outcomes` row. The milestone is the one the
  journal entry was about, when it was about one.
- **Apply:** offer the change on that milestone's page, and apply it only
  when the person accepts.
- **Ask:** use the existing check-ins (`frontend/lib/checkin.ts`,
  `checkin_responses`), which already run in the app and by emailed link,
  with a fourth kind for "Did that help?". Store the answer and the
  week-later answer against the adaptation row.

No bandit policy is built on any of this.

## Found on the way

| Found | Done |
| --- | --- |
| `GET /api/reflections/user/{id}` had no sign-in check. It returned anyone's journal entries to whoever had their account id. 0 entries exist, so nothing has leaked. | Fixed on `fix/backend-route-auth`, with the update route and the path routes above |
| `PATCH /api/onboarding/{user_id}` had no sign-in check. It let anyone rewrite a person's answers, conditions and plan. | Same branch |
| A journal entry with an outcome replaced the person's stored goals and conditions with nothing, and rebuilt their profile vector from an empty profile | Fixed on `fix/reflection-reembed-profile` |
| `reflections` rows store a constant `completion_rate` (0.65) and empty `indicators`. These are the labels a future adaptation policy would learn from. | Not changed |
| When someone has no journal entries, the history page shows three made-up ones, starting with a "Graduate University Path" entry from January, unlabelled, as if they were theirs | Not changed: whether to show an empty state instead is a product call |
| The journal page says the "Did this suggestion help you?" answer "is not used to train anything for anyone else". Path feedback goes into `path_planning_outcomes`, which is keyed by profile signature, so it shapes plans for everyone who shares that signature. The answer also sets the success rate that ranks this person in other people's matches. | Not changed: the wording or the behaviour has to change, and which one is a decision |
