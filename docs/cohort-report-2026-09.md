# Riipen Labs' cohort report, September 2026

Riipen Labs' "Customer Experience Report" brings together the 36 teams'
reports (41 files) on Autinerary's onboarding. This page says what Autinerary
does for each part of it (as of 10 October 2026), what changed because of it,
and what the team still has to do or decide.

Groups 1 to 11 were built one report at a time; their write-ups are in
[first-visit-to-return.md](first-visit-to-return.md) (Group 11),
[start-here.md](start-here.md) (Group 4), [onboarding-questions.md](onboarding-questions.md)
and [beta-test-plan-2026-10.md](beta-test-plan-2026-10.md). Of the five reports
the cohort report highlights, Teams 4 and 10 were built as Groups 4 and 10.
Teams 15, 18 and 35 have not been shared with us, so their parts below come
from the cohort report's summary of them.

## The main recommendation

"Run a controlled beta around one simpler onboarding spine."

| Part of the spine | In Autinerary |
| --- | --- |
| A plain-language value statement | The home page opens with "A life plan built around how you work": "Autinerary turns your goals into small, clear steps, schedules them around your energy, and points you to tools and services rated by people with similar norms." Start here: "Two quick questions, no account needed" |
| Only enough to route by role and immediate goal | Start here's two questions, who for and what you need today; setup starts with them |
| A useful starter destination before deeper profile data | Start here's starter shelf, with no account; after setup, starter resources come first |
| Progress, skip and save visible | Start here's progress list; setup's step counter, "Skip for now", "Need a break?" and welcome back |
| Small personalization prompts after value | Questions asked later on the Path, one at a time, each saying what it improves |
| Track completion, first useful action, returns and follow-up, by channel and group | The funnel report (`python -m scripts.onboarding_funnel`, from `backend/`) |
| Refine before expanding | The beta plan: recruiting groups, the 30-day trial, and a keep, change or stop review on 12 November |

## The five solutions

| They recommended | What is there | Changed on 10 October |
| --- | --- | --- |
| 1. A short, predictable, optional first session: audit every question as essential now, useful later or optional | The audit is [onboarding-questions.md](onboarding-questions.md): every question, why it is asked, and when it comes back. Each setup step says what its answer is used for | Nothing needed |
| 2. Route by role and immediate goal; validate the categories with participants | Start here (Group 4) | The session wrap-up now asks whether an answer fit them, and what they would call it |
| 3. Value before deep personalization: 3 to 5 trusted resources, one next action, save the path | Start here's shelves have 3 or 4 items each and "Save this path"; deeper questions come later | Nothing needed |
| 4. Channel-aware 7-14 day journeys: one spine, varied framing, source captured, one hypothesis per channel | Every link is tracked (`utm_source`), and the report splits by channel | **One path for every channel.** The Facebook, TikTok and Reddit links used to answer Start here's questions for people (Group 5). They now ask everyone, and only a welcome line changes. A hypothesis per channel is in the beta plan. Follow-up is the same for everyone until the beta shows a difference, as the report advises |
| 5. Trust, clarity and measurement: plain language, why sensitive questions are asked, transparent AI, error states tested, the funnel from day one | Plain language and "why we ask" throughout; the funnel since September; questions after setup and check-ins | **"Where does Autinerary use AI?"** on the home page. **Plain error messages** in setup, which used to show a browser pop-up with the server's words ("Cannot connect to server at https://...", "Agent orchestration failed: ..."). **"Do you know what to do next?"** after setup. **An accessibility check** for both apps, and the problems it found fixed (below) |

The sequence they describe (orient, route, deliver, deepen, follow, learn) is
the same: the home page and Start here orient; the two questions route; the
shelf and the page after setup deliver; questions asked later deepen; daily
reminders open the person's Path, and the weekly email carries what they
saved and new picks for their answers; the report and sessions are how we
learn.

## Prioritized recommendations

| They recommended | Where it is |
| --- | --- |
| 1. Audit and classify every onboarding question | [onboarding-questions.md](onboarding-questions.md) |
| 2. One short common onboarding spine | Start here, then the two-question setup; one path for every channel since 10 October |
| 3. The starter-path content set | Start here's shelves (`frontend/lib/startHere.ts`), and a useful first action for each: open a resource or save the path |
| 4. Progressive personalization | Questions asked later, saying what each improves (Groups 7, 8 and 10) |
| 5. Controlled beta cohorts by source and role | The beta plan's recruiting groups; the source is recorded and, since 10 October, no longer decides the answers |
| 6. Instrument the first 7-14 days | The report: completion, drop-off by step, first useful action, returns at 1, 7 and 14 days, follow-up opt-ins |
| 7. A scale/revise/stop review before public launch | The beta plan's "Review: keep, change or stop", proposed for Wednesday 12 November |

## What they said to do today

| They said | Done |
| --- | --- |
| The question inventory | [onboarding-questions.md](onboarding-questions.md) |
| A 20-second value statement, before any profile question | The home page's first lines (above) |
| Choose the first three role/goal paths | Proposed in the beta plan: myself + services, myself + people with similar experiences, my child + starter information, from the two priority groups. The report has a "Start here: by path" table for them |
| One starter shelf per path | Each has 3 or 4 items; listed in the beta plan |
| First-session and 7-day success, and one short question | In the beta plan: a next action in the first session, a return within 7 days, and "Do you know what to do next?" (needs STEP 62) |
| Set the review date before recruiting | Proposed: Wednesday 12 November, with a halfway check on 26 October. Who decides is for the team |

## Risks

Each of their six risks, and what handles it, is in the beta plan under
"Risks, and how this trial handles them".

## The accessibility check

`scripts/qa/check-accessibility.mjs` runs axe-core's WCAG 2.1 A and AA rules
on the first-session pages of both apps (the home page, Start here and a
pathway, sign-up, sign-in, the privacy page, the weekly email's stop page,
ResourceHub's home page and search, and signed in, the page after setup, the
Path and Settings) at phone and desktop widths. Its first runs, on 10
October, found these serious or critical problems, now all fixed, and the
last run found none:

- The Sign out button's spoken name ("Sign out") did not match its words ("Logout"). It now says "Sign out", in every language's own words.
- ResourceHub's cards announced only "View <name>", hiding the place and rating from screen readers. They now read what they show.
- Sign-up and sign-in labels were not tied to their fields, so a screen reader called the email field "you@example.com"; the date of birth had no name at all; the show-password button had none either.
- Settings: an unnamed switch (Discoverable), an unlabelled field, and 13 pieces of text or buttons below WCAG AA contrast.

It finds what a machine can find. It does not replace sessions with the
people Autinerary is for. Run it before any release that changes these pages.

## Extending the work with students

The report suggests Riipen's Level UP for tightly scoped work and FuturePath
for research that needs participants and data. What would help most now:

- **Level UP, starter-path content build.** Tag ResourceHub's listings by role, goal, source and reading effort, so the shelves stay current. There are 9,561 approved listings, and 6 of the 7 listings people had saved by 10 October have since been rejected, so curation matters.
- **FuturePath, a 7-14 day retention experiment, after launch.** It needs more people than the beta's 20 to 28, which is also why randomized A/B tests were not built for the beta.

The onboarding content audit and the beta operations kit are mostly done
already ([beta/README.md](beta/README.md)).

## The five highlighted reports

| Team | Their focus | In Autinerary |
| --- | --- | --- |
| 4 | Role-and-goal Start Here | Built as Group 4: Start here |
| 10 | Progressive onboarding | Built as Group 10: essentials first, questions later, check-ins that adjust the path |
| 15 | Channel profiles and a 7-14 day research plan | One path for every channel, a welcome line each, a hypothesis each, measured by channel |
| 18 | Trust, AI framing, first impression | "Where does Autinerary use AI?", plain error messages, trust and AI questions in sessions |
| 35 | Progress, save and skip safeguards, a starter shelf, day-one tracking | Already in place: progress, skip, save and resume; shelves; the funnel from day one |

## For the team

1. Apply **STEP 62** (`backend/database/migrations/2026_onboarding_next_step.sql`, also at the end of `setup/all_migrations.sql`) so "Do you know what to do next?" answers are kept.
2. Agree the review date and **who makes the call** (the beta plan's `[[TEAM: name]]`), and fill the beta kit's other `[[TEAM: ...]]` blanks.
3. Share Teams 15, 18 and 35's full reports if you want them gone through line by line.
4. Decide whether to post a Level UP or FuturePath project.
