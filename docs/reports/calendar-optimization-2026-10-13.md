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

Nothing is pushed, deployed or applied.

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
