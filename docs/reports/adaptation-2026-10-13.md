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

## Item 2. Naming a milestone

**Every adaptation names one milestone, by path id and milestone id, or is
not produced** (`suggestions()` in `core/adaptation_rules.py`).
- **Why both ids:** milestone ids repeat across one person's paths
  (`milestone_g0_education_0` is in each), so the path id is always part of
  the name.
- **Which path:** the active one, as the analysis reports it.

**Each change is one the app shows.** The plan's day estimates
(`estimatedDays`) appear nowhere in the app, so a suggestion like "give it
more time" would change nothing anyone sees. The changes are to:
- **the step's tasks,** listed on its page;
- **the order of steps,** in "Your next step" on the Path and in the race
  lanes;
- **its status,** the "In Progress" badge on its page.

| Rule | The milestone it names | The change | Produces nothing when |
| --- | --- | --- | --- |
| `stress` | The step the journal entry was about | Moved later: after the other steps in its part of the plan | The entry was about the path or the calendar, not a step; or the step is done, or already last in its part |
| `behind_schedule` | The earliest step due and not done | Lighter: its first 3 tasks kept, the rest set aside (kept in the offer's record) | No step that is due has more than 3 tasks; or the analysis is about another path |
| `rated_low` | The step rated 2 or less, newest first, on this path | Moved later | The rating is for another path's step with the same id; or the step is done, or already last in its part |
| `ahead_of_schedule` | The next step not yet due | Started now (In Progress) | It is already started; or the analysis is about another path |

**One at a time:**
- **One suggestion per step,** in that order of rules.
- **At most three** at once.
- **Ids are fixed:** a suggestion's id is fixed by its rule, path and
  milestone. Once offered, it is never offered again, whether it was
  accepted or not (item 3).

**Where it shows up:**
- **The agent** (`adapt_path(analysis=...)`) reads the person's stored path
  and completed steps, read-only. It returns the named suggestions, plus
  `unnamed_rules`: the rules that fired but could name no step.
- **Nothing is applied here.**

**Tests** (`tests/test_adaptation_milestones.py`, 10, fixtures only):
- each rule names its step;
- a step that is already light, done, already started or already last is
  skipped;
- completion rules name nothing on another path;
- a rating on another path's step with the same id doesn't count;
- a journal entry about the calendar names nothing;
- one suggestion per step, in order, at most three;
- ids are stable;
- naming changes nothing;
- the agent reports the rules that named none.

## Item 3. Offer, don't apply

Behind a flag that is off by default:
- `ADAPTATION_OFFERS_ENABLED=true` on the backend (otherwise 404);
- `NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED=true` in the app (otherwise nothing
  renders).

**The migration is written, not applied:**
`backend/database/migrations/2026_adaptation_offers.sql`, **STEP 73**, also
added to `setup/all_migrations.sql`. It is independent of STEP 72 (schedule
feedback, on the Calendar branches).

**Wording and placement:**
- **Where:** on the Path page (`/path`), directly under "Your next step". Up
  to three cards, one per suggestion.
- **Each card:**
  - the heading **"Suggested change"**;
  - **"For"** and the step's name, linked to that step's page, so each card
    names its milestone and leads to it;
  - the change in plain words;
  - the reason;
  - two buttons, **Accept** and **Not now**.
- **The texts:**

  | Rule | The change, as shown | The reason, as shown |
  | --- | --- | --- |
  | `behind_schedule` | "This step is taking longer than planned. Make it lighter: keep its first 3 tasks and set the other 2 aside." | "By your plan's own estimates, 4 steps would be done by now. 1 is." |
  | `stress` | "You wrote that things are a lot right now. Move this step later, after the other steps in its part of the plan." | "From your journal entry on 12 October." |
  | `rated_low` | "You rated this step "Not useful". Move it later, after the other steps in its part of the plan." | "Your rating on 12 October." |
  | `ahead_of_schedule` | "You're ahead of your plan. Start this step now?" | "4 of the 4 steps due by now are done." |

- **After Accept:** "Done. Your plan has changed." The Path reloads the plan.
- **After Not now:** "Okay. Your plan stays as it is, and this won't be
  suggested again."
- **If saving fails:** "This could not be saved just now. Please try again."
- **Component:** `frontend/app/components/SuggestedChanges.tsx`.

**Only Accept changes the stored path** (`backend/api/routes/adaptations.py`):
- **`GET /api/adaptations/{pathId}`**, for the person's own path only, computes:
  - Reflection Analysis's analysis, on read;
  - Adaptation's suggestions;
  - the person's completed steps.

  It records each new suggestion once and returns those not yet answered.
  Showing an offer changes nothing.
- **`POST /api/adaptations/{suggestionId}/respond`** takes `{ pathId,
  response: 'accept' | 'not_now' }`. It accepts only a suggestion that was
  offered to this person.
  - **Accept** applies the change that was offered, to the step it named,
    with `core/adaptation_rules.apply`:
    - "lighter" keeps the first 3 tasks, through the same merge adaptations
      always used (`core/path_storage.py`);
    - "start now" sets the status;
    - "move later" moves the step after the last one of its part of the plan,
      in all three copies the app reads.

    It then saves the path, drops the path routes' cached copy of it, and
    sets `accepted_at`.
  - **Not now** sets `dismissed_at` and doesn't touch the path.
  - **A second answer** changes nothing.

**Every offer and response is a row in `adaptation_outcomes`** (STEP 73):

| Column | Holds |
| --- | --- |
| `rule_fired` | The rule |
| `path_id`, `milestone_id` | The step it names |
| `suggestion_id` | Unique per person: offered once |
| `change` | What it would change, and the words it was offered with |
| `offered_at` | When it was offered |
| `accepted_at` or `dismissed_at` | The answer; one at most, a check enforces it |

The journal's reward loop (`close_adaptation_loop`) now leaves offers out:
they are not fired adaptations. As before, only the backend writes the table
(RLS on, no policies).

**Known limit:** the path routes keep a copy of each path per server process.
Accept drops its own process's copy; another process may show the old plan
until it reloads it. Every other write to a path has the same limit.

**Tested:**
- **The route** (`tests/test_adaptation_offers.py`, 8, on an in-memory
  database):
  - offered once, and named;
  - showing changes nothing;
  - Accept applies exactly the offered change (3 tasks kept, in both copies),
    drops the cached copy, and isn't applied twice;
  - Not now changes nothing and isn't offered again;
  - only the person's own path and offers;
  - off by default;
  - "not available" before the migration;
  - only accept or not_now.
- **Applying:** "move later" moves the step in every copy and nothing else;
  "start now" works; the refusals hold.
- **The migration,** on a throwaway local Postgres:
  - applies twice;
  - the same suggestion can't be offered twice;
  - an offer must name its step;
  - accepted and dismissed together is refused;
  - the journal's loop credits the old row and leaves the offer out;
  - a signed-in person reads nothing.
- **No adaptation was applied to any real path:** fixtures and local
  databases only.
