# Calendar Optimization: condition rules, energy, confidence and feedback (13 October 2026)

Calendar Optimization only. Each item is on its own branch, stacked in
order from `main`:

| Item | Branch |
| --- | --- |
| 0 | `feat/calendar-0-condition-labels` |
| 1 | `feat/calendar-1-energy` |
| 2 | `feat/calendar-2-confidence` |
| 3 | `feat/calendar-3-feedback` |
| 4 | `feat/calendar-4-run-log` |

Merged into main and deployed on 15 October 2026, with every flag off.

Numbers come from `python -m scripts.calendar_audit` (from backend/), run on
13 October against the production database.
- The script only selects.
- It prints counts, never ids, emails or anything people typed.
- "Real" accounts use the same email rules as the other audits.
- Anything not confirmed is marked NOT YET VERIFIED.

## Item 0. The label comparison

**Before.** The agent lowercased each label, turned its spaces into
underscores and looked the result up as a rule key. So only the labels
"autism", "ADHD", "OCD" and "bipolar" matched, and these never did:
- "Autism spectrum disorder", "ASD" or "AuDHD";
- "Obsessive-compulsive and related conditions";
- "Bipolar disorder".

**Now.** `rule_keys` (`core/agents/calendar_optimization_agent.py`) maps the
labels with `condition_taxonomy.match_keys`:
- **Same map as the live filter:** this is the normalised vocabulary from
  `feat/condition-vocabulary` (STEP 57), and the same canonicalisation Pattern
  Recognition's live filter uses (`core/agents/pattern_recognition_agent.py`).
- **AuDHD** gets both the autism and the ADHD rules.
- **Free text** gets none, even when it names a condition, as in the live
  filter.
- **The day tips** ("Take a sensory break if needed") use the same keys.

**How many real users each rule applies to.** These are the 61 real accounts
with a stored path, counted on each one's latest path:

| Rule | Have the condition | Before | After | Ran when the path was made |
| --- | --- | --- | --- | --- |
| Autism | 13 | **3** | **13** | 3 |
| ADHD | 17 | 15 | 17 | 15 |
| OCD | 7 | **1** | **7** | 1 |
| Bipolar | 0 | 0 | 0 | 0 |

- **"Before" matches what the stored paths show ran** (their `rules_applied`).
  So the old comparison is reproduced exactly.
- **Counted by path instead,** across every account as the 8 October audit
  did (96 paths), it reconciles with that audit:

  | Rule | Before | After |
  | --- | --- | --- |
  | Autism | 6 of 20 | 20 of 20 |
  | OCD | 2 of 10 | 10 of 10 |
  | ADHD | 25 of 27 | 27 of 27 |
  | Bipolar | 0 of 1 | 1 of 1 |

**Tests** (`tests/test_calendar_condition_rules.py`):
- **Every spelling fires its rule.** Each one the vocabulary records, plus the
  forms people type ("Autism spectrum disorder", "ASD", " autistic ",
  "Attention Deficit Hyperactivity Disorder", "ADD", "AuDHD", "Autism + ADHD",
  "Obsessive-compulsive and related conditions", "BIPOLAR_DISORDER"). The test
  checks the rule set's own flag in `rules_applied`.
- **Nothing fires without the condition:**
  - no conditions at all;
  - anxiety, dyslexia, depression or mood disorders;
  - "No current barriers" or "Prefer not to share";
  - free text that mentions a condition ("my brother is autistic",
    "ADHD-ish").
- **The rules change the schedule:**
  - ADHD tasks are capped at 25 minutes;
  - autism adds a 15-minute buffer;
  - bipolar makes every day flexible.

**Found while testing: OCD's extra time never applied.**
- **The bug:** the OCD rule set gives tasks 1.5 × their time. But the rules
  are combined by copying task-length caps, transitions, buffers and true or
  false flags, and the 1.5 is none of those. So it was never passed on, and
  the schedule never saw it.
- **The evidence:** none of the 96 stored paths has it in `rules_applied`.
  Only the OCD rule set's flags ever arrived, and nothing in scheduling reads
  them.
- **The fix:** a second commit on this branch carries `time_for_completion`
  through, taking the larger value. It is separate so it can be left out.
- **Tested:**
  - an OCD task of 40 minutes becomes 60;
  - with ADHD as well, it is capped at 25 first, then becomes 37.
- **Also unused, left as it was:** OCD's `checking_buffer`, autism's
  `max_transitions` and `preferred_task_length`, and most flags (for example
  `sensory_breaks`, `movement_breaks`). They are stored in `rules_applied`,
  but nothing in scheduling reads them.

## Item 1. Energy levels

**Each day's energy level comes from the day of the week**, the same for
everyone:
- Monday, Wednesday and Thursday are medium;
- Tuesday is high;
- Friday and Sunday are low;
- Saturday "varies".

The bipolar rules make every day "flexible".

**What per-person signals are stored.** Counts are of the 113 real
accounts' profiles, unless a row says otherwise:

| Signal | What it is | Real accounts with it | Energy by day or time? |
| --- | --- | --- | --- |
| `profiles.preferences.reminders.time` | When the daily reminder email goes out | 69, **all "09:00"**, the value it starts at | No: when to send email, not energy |
| `profiles.preferences.setupEnergy` and `setup_energy` events | "How much energy do you have for this today?" at setup (since 12 October) | **0** | One answer about one day, and nobody has given it yet |
| The Calendar's energy view (Low, Medium, High) | Chosen in the Calendar for the rest of the day | Kept in the browser only (`localStorage`). `calendar_tasks.scenario` records the view when a task is added: 2 rows from real accounts, both "average", which is where the view starts. **0 chosen** | Not stored |
| `life_stats_checkins` | Daily mood, 1–10, self-reported | 23 people, 33 rows | Mood, not energy, and one or two days per person |
| `life_stats_snapshots.energy` | A score computed from app activity (days active in the last week, streak) | 56 people, 1,933 rows | **Not reported by the person**: it counts visits |
| `calendar_outcomes`, `milestone_ratings`, `reflections` | Feedback the schedule could learn from | 0, 0, 0 | — |
| Other preference keys (age range, tech comfort, view, spirit animals, reminders, ...) | | | No energy or time of day |

**No real per-person energy signal exists, so none was used.** Instead the
output is marked as a generic default, and the app no longer implies
otherwise:

- **The agent** (`core/agents/calendar_optimization_agent.py`):
  - every day carries `energySource`: `'weekday'`, or `'condition'` for the
    bipolar rules;
  - the result carries `energySource` and `energyPersonal: false`;
  - the explanation sentence's prompt now says: "Each day's energy level is a
    default set by the day of the week, the same for everyone: never say the
    schedule follows the user's own energy, rhythm or best times."
- **The app.** The only place a schedule's energy reaches anyone is the
  Path's guide.
  - **Who sees it:** 7 real accounts chose two spirit animals, one for fast
    days and one for slow days. The other 62 use one. The guide picks the
    slow animal on the weekday's low days.
  - **The change:** its label (the icon's tooltip) said "Slow Day" or "Fast
    Day", as if the app knew the person's day. It now says "Slow day (default
    for Fridays)", or "Fast day (default)" for the bipolar rules
    (`frontend/lib/spiritAnimal.ts`). Schedules made before this change have
    no `energySource` and are treated as weekday defaults too.
  - **Unchanged:** which animal shows.
  - **Elsewhere:** the Calendar page shows no day energy from the agent, only
    its tasks, and the energy buttons there are the person's own choice.
- **Tests:** `tests/test_calendar_energy.py` (3) and
  `frontend/lib/spiritAnimal.test.mjs`.

**What onboarding would need to ask to make it personal** (not added, as
asked):
1. "When in the day do you usually have the most energy?"
   - Morning
   - Midday
   - Afternoon
   - Evening
   - It changes from day to day
2. "Are some days of the week usually harder?"
   - Optional; choose any of Monday to Sunday, or "Not really".

**How the agent could use the answers:**
- Store them in `profiles.preferences` (for example `energyPattern`).
- Harder days become low-energy, recovery days.
- High-priority tasks go into the best time of day.
- The weekday default stays the fallback for anyone who skips the questions.

"It changes from day to day" is a real answer, and should keep the defaults
rather than guess.

## Item 2. Confidence

**What the 0.75 measured.**
- **The formula:** (days with at least one task ÷ days scheduled) ×
  (1.0 if the person has learned time-of-day preferences, otherwise 0.75).
- **Learned preferences** need 10 or more rewards per time slot in
  `calendar_outcomes`. That table has 0 rows, so the second factor is always
  0.75.
- **The first factor is always 1:** every stored schedule fills all 7 of its
  7 days (80 current paths, 16 legacy). A plan has dozens of tasks, and the
  week holds about 30.
- **So it is 0.75 for everyone:** 79 of the 80 current paths. The other one
  holds 0.28, from a formula replaced on 26 August. The 16 legacy paths hold
  the old constant 0.82.
- **It measures nothing about the schedule:** whether it fits the person,
  can be done, or was done.

**What changed:**
- **The agent stores null** (`'confidence': None`). The two facts it was made
  of are kept as what they are: `daysWithWork`, and `learnedPreferences`
  (true or false).
- **The orchestrator** already copies whatever the agent returns, so
  `agentResponses[calendar_optimization].confidence` is null too.
- **The UI never shows a confidence for the calendar.** The only place it
  could appear was the "Why your week looks like this" banner (on Tasks), as
  a last fallback ("Confidence: 75%") when there was no explanation.
  - Every stored schedule has an explanation (0 without one), so it never
    actually showed.
  - The banner's message is now `insightMessage` in
    `frontend/lib/agentInsights.ts`, and leaves out Calendar Optimization's
    confidence whatever is stored. That includes the 0.75 older paths still
    hold.
  - Other agents' fallbacks are unchanged.
- **The type** `confidence` in `AgentPathContext` may be null.

**What the UI shows now:** on the Tasks page, the collapsed banner "Why your
week looks like this" with the explanation sentence, as before. A calendar
confidence appears nowhere.

**Tests:**
- `tests/test_calendar_confidence.py`: null for a full week, a short plan, and
  with learned preferences.
- `frontend/lib/agentInsights.test.mjs`.

## Item 3. "Did this schedule work for you?"

Built on the milestone-ratings pattern (STEP 54), behind a flag that is off
by default. **The migration is written, not applied:**
`backend/database/migrations/2026_schedule_feedback.sql`, **STEP 72**, also
added to `setup/all_migrations.sql`.

**Wording and placement:**
- **Where:** on the Calendar page, right under the week's schedule and above
  "Compare with your people". Only when there is a schedule from the plan.
- **Heading:** **"Did this schedule work for you?"**
- **Under it:** "Optional, and asked once for each schedule. Your answer helps
  Autinerary plan better weeks."
- **Buttons:** **Yes** and **No**.
- **Once answered**, the card is replaced by a line: "Thank you. You said this
  schedule worked for you." (or "didn't work"). It doesn't ask again for that
  schedule. If saving fails: "This could not be saved just now. Please try
  again."
- **Component:** `frontend/app/components/ScheduleFeedback.tsx`.

**Once per generated schedule:**
- **The schedule id:** every schedule the agent makes now has a `scheduleId`.
  A schedule made before has none, and is named `path:<path id>`: a path held
  one schedule.
- **Storage:** a row in `schedule_feedback` with `user_id`, `path_id`,
  `schedule_id`, `answer` ('yes' or 'no') and `created_at`. `path_id` is kept
  too, so an answer can be joined to its path.
- **Never changed:** the key is unique per person and schedule, and there is
  no update policy.

**The route** (`backend/api/routes/schedule_feedback.py`):
- `GET /api/schedule-feedback/{pathId}` returns the schedule's id and the
  answer, if one was given.
- `POST /api/schedule-feedback` takes `{ pathId, scheduleId, answer }`.
- **It checks** that the path is the person's own and that the schedule is the
  one stored in it.
- **A second answer** returns the first. It isn't saved.

**The flags:**
- `SCHEDULE_FEEDBACK_ENABLED=true` on the backend (otherwise 404);
- `NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED=true` in the app (otherwise the card
  isn't rendered).

Until STEP 72 is applied, the route says feedback isn't available and the app
shows nothing, even with both flags on.

**Tested:**
- **The route** (`tests/test_schedule_feedback.py`, 9 tests):
  - off by default;
  - asked once (a second answer returns the first);
  - older schedules named by their path;
  - only the schedule in the person's own path;
  - yes or no only;
  - "not available" before the migration;
  - a new id for every generated schedule.
- **The migration,** on a throwaway local Postgres with a Supabase auth stub:
  - applies twice;
  - a person can add their own answer, but not someone else's;
  - a second answer for the same schedule is refused;
  - answers other than yes or no are refused;
  - people see only their own rows, and can't change or delete them;
  - deleting the account deletes the answers.

**Not done, as with milestone ratings:** the app's "download my data" route
(`frontend/app/api/me/data`) doesn't list this table. It doesn't list
`milestone_ratings` either.

## Item 4. Run log

`scripts/calendar_audit.py` calls `core/evaluation_runs.py` at the start of
a run (`start`, once its inputs are read) and at the end (`finish`).
- **Never through the Supabase client.** The row goes only to the Postgres
  named by `EVALUATION_RUNS_DSN`, so production's `evaluation_runs` stays
  empty.
- **Without that variable,** the run says it wasn't logged.
- **What it records:** counts and hashes only. No user ids, emails or free
  text.

**One row**, from the run on 13 October against production, logged in a
local Postgres that has STEP 61's table:

```json
{
  "run_id": "39380604-8388-491a-bd4e-fb5863b5e6ee",
  "script": "scripts.calendar_audit",
  "git_commit": "2d6fa1e",
  "started_at": "2026-10-13T03:34:18.815464-04:00",
  "ended_at": "2026-10-13T03:34:20.727591-04:00",
  "inputs": {
    "paths": 96,
    "is_legacy_excluded": 16,
    "tasks": {"scheduled_current_paths": 2457, "per_path_max": 33,
              "calendar_tasks": 26, "calendar_tasks_real_accounts": 2},
    "rules_applied_current_paths": {"adhd": 18},
    "rules_real_accounts": {"people": 61,
                            "before": {"autism": 3, "adhd": 15, "ocd": 1},
                            "after": {"autism": 13, "adhd": 17, "ocd": 7}},
    "condition_map_hash": "841a277543",
    "real_feedback_answers": "table not present (STEP 72 not applied)"
  }
}
```

**Reading the row:**
- **`rules_applied_current_paths`** is what ran when each current path was
  made: in all 80, only the ADHD rules ever ran. The autism and OCD rules
  that real users' latest paths show (3 and 1) are in legacy paths.
- **`real_feedback_answers`** will count yes and no once STEP 72 is applied
  and the flags are on. (Update, 15 October 2026: STEP 72 was applied and
  checked live; the flags are still off.)
- **`condition_map_hash`** is `TAXONOMY_VERSION` from
  `core/condition_taxonomy.py`.

**To run it,** from backend/:

```
EVALUATION_RUNS_DSN=postgresql://... python -m scripts.calendar_audit
```

## Checked in a browser

**The setup:**
- **The flags:** the app ran locally with `NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED=true`.
- **The page:** `ScheduleFeedback` was rendered on a throwaway page (never
  committed), signed out.
- **The backend:** a mock backend answered with a schedule id and no answer
  yet.
- **Nothing escaped:** every request that wasn't a read, or a call to the
  mock, would have been stopped. None was attempted.

**The run:**
- **On load:** "Did this schedule work for you?", "Optional, and asked once
  for each schedule. Your answer helps Autinerary plan better weeks.", and
  Yes and No.
- **On Yes:** it sent `{ pathId, scheduleId, answer: "yes" }`, and the card
  became "Thank you. You said this schedule worked for you."

**No page errors.**

**Not checked:** the card on the real Calendar page, signed in. That would
have needed a production account's password to be set, which is a write. The
placement is the one line in `app/calendar/page.tsx`, under the week, and it
builds.
