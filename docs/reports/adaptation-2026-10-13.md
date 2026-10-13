# Adaptation: rules on the analysis, offers, and "Did that help?" (13 October 2026)

Adaptation only. Each item is on its own branch, stacked in order. The stack
starts from `feat/reflection-4-evaluation`, because Adaptation reads Reflection
Analysis's output:

| Item | Branch |
| --- | --- |
| 1 | `feat/adaptation-1-inputs` |
| 2 | `feat/adaptation-2-milestones` |
| 3 | `feat/adaptation-3-offers` |
| 4 | `feat/adaptation-4-helped` |
| 5 | `feat/adaptation-5-run-log` |

Nothing is pushed, deployed or applied.
- **No adaptation was applied to anyone's stored path while testing:** fixtures
  and local databases only.
- **No bandit or learning policy.**
- Anything not confirmed is marked NOT YET VERIFIED.

**What was wrong** (the 8 October audit, `adaptation-loop-2026-10-08.md`):
- The step received the wrong part of the analysis.
- The completion rate was a constant 0.65.
- A rule that fired named no milestone.
- No route applied an adaptation to a stored path.
- Nothing explored.
- `adaptation_outcomes` had 0 rows.

## Item 1. The inputs

**It now gets the right part of the analysis.**
- **The whole analysis:** Adaptation receives the whole of Reflection
  Analysis's structure (`adapt_path(analysis=...)`; that report, item 1).
  Its rules read it in `core/adaptation_rules.py`, `decide()`.
- **What used to get lost:** the concerns the stress rule reads used to sit
  beside `insights`, not in it, so they arrived empty.

**The completion rate is computed, not 0.65.** It comes from the analysis:
- the person's stored milestone completions (`race_progress`);
- set against their active path's own estimates (each life area's
  `estimatedDays`, added up from the day the path was made).

**"Unknown", then nothing.**
- **No data:** an analysis with status "no_data" (no journal entries, no
  ratings) fires no rule.
- **An unknown rate** (fewer than 2 milestones due yet) fires neither
  completion rule.
- An unknown is never read as a number.

**The rules,** with the old agent's thresholds:

| Rule | Fires when |
| --- | --- |
| `behind_schedule` | The completion rate is known and below 0.5 |
| `ahead_of_schedule` | The completion rate is known and above 0.8 |
| `rated_low` | A milestone's latest rating is 2 or less ("Not useful", "A little") |
| `stress` | A burnout or sustained-negative-mood concern in a journal entry of the last 14 days |

The old pattern rule fired on hardcoded "research" correlations, which the
analysis no longer carries, so it is gone. The energy-mismatch rule never had
an input.

**Nothing is changed here.**
- **What the agent returns:** which rules fired and on what evidence, with
  no updated milestones or tasks, no calendar re-run, and no confidence
  (nothing is measured about them).
- **The journal route no longer records fired rules** in
  `adaptation_outcomes`. That fed a threshold policy, and there is none this
  round. Offers are recorded where they are made (item 3).

**Tests** (`tests/test_adaptation_rules.py`, 11, fixtures only):
- "no data" fires nothing;
- an unknown rate is never read as a number;
- the thresholds: 0.25 fires `behind_schedule`; 0.5, the old 0.65 and 0.8
  fire nothing; 0.9 fires `ahead_of_schedule`;
- low ratings and stress fire, and isolation alone doesn't;
- **end to end on stored-row fixtures**, through Reflection Analysis to the
  rules: a path 5 days old with 4 milestones due and 1 done fires
  `behind_schedule`; 3 done fires nothing; 4 done fires `ahead_of_schedule`;
  a path 1 day old fires nothing;
- the agent reports what fired and changes nothing.
