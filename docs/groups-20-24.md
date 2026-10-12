# Riipen Labs Groups 20 to 24, September 2026

Five Riipen Labs reports from 25 September 2026, all about the first visit:

- **Group 20**, "Customer Experience Brief": too much at once in the first
  session, and all four life paths (education, employment, relationships,
  health) shown together. Introduce one first and reveal the others after a
  first step; keep optional steps on a checklist; remind people who stop.
- **Group 21**, "Improving Autinerary Corp's New User Experience": no clear
  starting point on the website's homepage. A call-to-action button and a
  short survey (five multiple-choice questions) that routes people to what
  fits them; reviews, impact and a sense of human care.
- **Group 22**, "Autinerary Customer Experience": friction where people are
  categorised, a Google Form gate, setup's order (the sensory setting at step
  8 of 9), overlapping age groups, weak matches in the wrong cities, a second
  sign-in at ResourceHub, and people arriving from TikTok who decide on one
  screen. Reorder, explore before an account, levels of complexity.
- **Group 23**, "Customer Experience Brief": a long setup and a tour that
  blocks the page, changes it by itself and resets to step one. Move avatar,
  Dream Self and spirit animals into the app as rewards, ask about energy so
  setup fits it, and make the tour's button explain the page you are on.
- **Group 24**, "Customer Experience Optimization Project", on caregivers of
  autistic children: a parent's goal for their child turned into questions
  about the parent's career, Autinerary recommended itself with a "10%
  match", and saving needed a second sign-in. A 60-second start, two
  starter kits for parents, a clinical advisory board, and kind reminders
  with three choices.

They tested the app in September, when setup was nine steps. By 12 October
setup was already two questions with the rest in the app (Groups 25 to 30,
[groups-25-30.md](groups-25-30.md)), and Start here (Group 4) already gave
starter resources with no account. This page says what Autinerary does for
each point as of 12 October 2026, slide by slide. The onboarding version is
now `paced-2026-10`, so the funnel report compares it with `express-2026-10`.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| A parent's plan | The planner was never told who a goal was for. Every goal got four roadmaps, one of them "Workplace" (job tasks, career moves), so "Get my son ready for grade 1" also got steps like "Research inclusive employers" for the parent | Setup sends who the plan is for. For a child, a family member, a friend or someone taught or supported, every roadmap is about supporting that person: "Learning & school", "School, work & daily life", "Relationships & support", "Health & routines", and the prompts say never to write about the user's own career (`backend/core/agents/path_planning_agent.py`) |
| Life areas | A plan's 16 steps in four areas were all shown at once on Races | The plan opens on the area it starts in; the note names the other three and how many steps each has, and they open when the first step is done. "Show all 4 areas now" is always there (`lib/lifeAreas.ts`) |
| The goal in setup | Six area buttons to choose from | One area, from the answers so far, or Education (32 of 63 people's first goals were about education, more than any other area); "Choose a different area" shows the rest |
| Energy | Setup was the same for everyone | An optional first question: how much energy do you have for this today? "Not much" ends with one button and asks nothing more; "Plenty" offers the optional questions straight after the plan |
| Skipping | "Skip setup for now", on the first step | "Skip to resources" beside it, on both steps: a parent goes straight to the starter kits, anyone else to Start here's resources for their answers |
| Starter kits | None | Two, for parents in Ontario: getting an autism assessment, and support at school with an IEP. Step by step, from the Government of Ontario's own pages, with places in ResourceHub and Tidbits. Each says who wrote it, from which pages, when it was checked, that no one has reviewed it yet, and that it is not advice (`lib/starterKits.ts`, `/kits`) |
| Help right now | Crisis lines in the glossary and the goal helper | "Help right now" is a need in Start here and setup, and shows who to call at once: 911, 9-8-8, Kids Help Phone (new), and for parents the Ontario Autism Program's urgent response services |
| Start here | Two questions | The same two, then three more, optional, after the resources: where you are, how soon, how you like to start. Each changes the list at once (five in all, as Group 21 asked) |
| Reminders to finish setup | One email the next morning, "the only reminder we will send" | Up to three when asked for: later the same day, after 3 days, after a week. Each email offers finish now, remind me in 3 days or a week, or stop. In the app, the Path's "Make your plan" card has the same three choices. The emails carry the postal address and a one-click unsubscribe |
| The tour | A dark layer over the whole page; Next changed the page; it always restarted at part 1 | A card beside the page, which stays usable; "Go to …" changes the page when asked; it picks up where it was left, or at the part about the page it was opened from, with "Start over"; Escape closes it |
| "How it works" | Started the tour | Explains the page you are on: what it is for, how to use it, how it connects; the tour is a button inside (`lib/pageGuides.ts`) |
| Display | Only on the Path | Also on the home page, Start here, sign-up, sign-in, setup and the kits, with a new Calm motion switch that applies from the first moment of a page; signed in, it also has "Simplified View" or "Full View" |
| ResourceHub sign-in | Links carried the session's access and refresh tokens; many links skipped the hand-off; Save signed out went to a separate-looking sign-in and back to the home page | A one-time code instead of tokens, every ResourceHub link through the hand-off, and Save or Rate signed out goes through the one Autinerary sign-in and comes back to finish the save |
| ResourceHub's recommendations | "10% match" and "40% match" with no one similar behind them, any city, and Autinerary's own listing | A percentage only from people with similar norms and at 50 or more; otherwise a plain fact ("Rated 4.8 by 6 people", "Not rated yet"); nearest first when there is a location, and "Highly rated places, in any city" when there is not; Autinerary's own listing left out of every recommender, in ResourceHub and the backend |
| The calendar | "+ Add task" last in the row of views, and a length had to be chosen | "+ Add task" beside the heading, and "How long?" starts at "Not sure yet" |
| The home page | No word on care | "At your own pace": four things the app does, a person to email, who to call; and the starter kits for parents |

### Found and fixed while doing this

- **The goal hijacking was in the planner, not setup** (above). Templates
  used when the AI is down had the same problem; supporting plans have their
  own.
- **The tour's calendar task rang the wrong control.** "Open the Calendar"
  matched the "Your plan" bar's Calendar tab, which comes first on the page,
  not the step's own link.
- **The tour counted a new start on every page** until it was closed.
- **ResourceHub's distances never reached the cards**, one fallback's
  tie-break did nothing, and "recommended resources" came back in database
  order, not by score.
- **`/go/servicehub` could be cut short by setup**: someone signed in but not
  set up could be sent to setup on the way back to ResourceHub. The page only
  passes people on, so setup no longer interrupts it.
- **ResourceHub's sign-in had "Try Demo Account"**, for an account that does
  not exist in production. Removed.
- **A ResourceHub example settings file in the repository held a service
  key** for an older Supabase project. That project no longer answers, so
  the key opens nothing; the value is still worth treating as spent.

## Group 20

### What they found (slides 2, 3, 5, 6, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| The first session asks for "too much information and too many decisions at once" | Nine steps when they tested; two questions since early October | The two questions, now with an optional energy check-in that can end setup there |
| "All four life-path categories: education, employment, relationships, and health, early in the experience" | Setup showed six areas to pick from, and each plan's four life areas were shown at once | One area first, in setup and in the plan (above) |
| The goals, dreams and obstacles questions are the hardest | Dreams and obstacles were folded away (Groups 27 and 30) | Unchanged; the goal starts with one area's ideas |
| Different audiences go "through a common onboarding experience" | Who you're here for decides what comes first (Groups 3 to 5, 32) | And now the plan itself, for parents and supporters |
| A skip option exists, "so its effect is not yet known" | "Skip setup for now" (Group 33) | The funnel report counts skips, and now where they went (resources or the Path) |
| The employer is adding "an information feature and a guide" | The tour and the glossary | The page guide, under "How it works" |
| "Returning daily or weekly is the outcome the employer wants most" | Day 1, 7, 14 and 30 returns in the report | And "still using after two weeks" (Group 24) |

### Their recommendations (slides 2 and 9 to 15)

| They recommended | Now |
| --- | --- |
| Option 1, their choice: "Sequence the four life-path categories. Start with one, and reveal the others after a first step. The categories stay the same; only when they appear changes" | Done, in setup and in the plan. "Choose which life path should be introduced first": the one that fits the person's answers, or Education, which most people start with |
| Option 2: "Skipped questions move into a checklist users can finish later, so nothing is lost" | The "Complete your profile" card (Groups 25 to 30) |
| Option 3: "A gentle reminder, in the app or by email, for users who stop part way through onboarding. This was the employer's own idea" (consent, "tone should stay positive") | Reminders only when asked for, up to three, each with "Not now?" choices; and the Path's card in the app. Wording: "No rush. Setting up takes about two minutes …" |
| "Progress previews, reminders, and clear next step messaging" | Setup says what each step involves and when it ends; the page after setup and the Path name the next step |
| Option 1 of the research slide: rank the friction points | This page and [onboarding-questions.md](onboarding-questions.md) |
| Option 2: a few specific changes, tested with beta testers first | The changes above; the beta sessions ([beta-test-plan-2026-10.md](beta-test-plan-2026-10.md)) |
| Option 3: keep measuring "completion at each onboarding step, return visits, milestones reached and in-app journaling" | The funnel report: setup steps, returns, first step done; **new**: journal entries written in the first 14 days (it counted only visits to the Journal) |
| "Test the updated flow with beta users and compare their experience with the current version" | By version: `paced-2026-10` against `express-2026-10` |
| Risk: "Simplifying onboarding too much could reduce the information available for personalization" | The optional questions stay one tap away on the Path and Your profile; "Plenty" energy offers them all at once |

## Group 21

### What they found (slides 2, 3, 5, 6, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| No clear starting point on the website's homepage, and no call-to-action button | www.autinerary.ca's only sign-up link is a waitlist Google Form. The app's home page has "Find starter resources" and "Create your free account" | For the website team, below. The app's starting point is Start here |
| "No real reviews, video quotes, or impact shown" | "In their words" (stories, with consent) and "So far in the beta" exist and stay hidden until there is something real (Group 11) | Unchanged on purpose: nothing is invented. The team's part is in [first-visit-to-return.md](first-visit-to-return.md) |
| "A sense of human care or emotional safety" is missing; people need to know their differences "are not a barrier", "the value of completing milestones, where resources are, and that they are cared for deeply" | | **At your own pace** on the home page: how you work is not something to fix; nothing is a test and answers are saved; each step brings up the next; a person reads email, and who to call now |
| Users "expect a skip option, and no character customization at beginning" | Both done (Groups 29 and 30) | |
| Users "might feel confused if uncertain about a selection" | "Not sure yet" is an answer to who you're here for and what you need | Kept |
| The soft theme and skip options work well | | Kept |

### Their recommendations (slides 9 to 14)

| They recommended | Now |
| --- | --- |
| A call-to-action button on the homepage | The app's home page has one ("Find starter resources"); the website's is for the team |
| A short survey of five targeted multiple-choice questions that directs people "to the most relevant section" | Start here: two questions route to starter resources, then three more, optional, sharpen them (where you are, how soon, how you like to start). People see something useful after two, as the cohort report asks |
| Risks: "Too many questions could create additional friction"; "Poorly designed questions could lead users to irrelevant information" | Only two are needed; the other three only reorder or add, never hide, and each is one tap to undo |
| Measure "survey completion rate, user feedback, clicks on recommended sections, and ease of finding information" | Start here's report: reached a pathway, "Was this useful?", resources opened; **new**: the optional questions answered, by answer |

## Group 22

### What they found (slides 2, 5, 6 and 7)

| They found | What it was | Now |
| --- | --- | --- |
| People from short videos "decide fast in one screen" and need "proof the app is for them in an instant" | The home page's first screen says what it is, who it is for and that it is free | Unchanged; Display and Calm motion are on that screen now |
| "The onboarding shouldn't feel like a diagnostic test" | Norms left setup (Groups 25 to 30) | |
| "A survey gate, 9 onboarding steps, and another wall at the Resource Hub" | The survey gate is the website's waitlist form; setup is two questions; ResourceHub asked again | ResourceHub uses the same sign-in now (above) |
| "The 'sensory' setting should be rearranged as it is at step 8 of 9"; "sensory control before the animations load" | Display was only on the Path | Display with Calm motion on every page before an account and in setup, applied before the page first draws |
| The Google Form asks people to rate Barrier Connections before they have seen it, and is hard to read on a phone | The website's waitlist form | For the website team, below |
| "Age 40 fits two buckets" (the form's 18-24 / 25-35 / 36-45 / 46-55 / 55+ against the app's 18-24 / 25-40 / 40-65 / 65+) | The app works ages out from the date of birth, so 40 was only ever in one, but the names said 25-40 and 40-65 | Named "25–39" and "40–64". The funnel report also counts ages in the form's bands, from the date of birth, so the two can be put side by side |
| "No record of where a user came from, and no follow up if they stop mid flow" | Every link is tracked since September; one reminder email existed | Reminders, above |
| Three matches "at 40%, in the wrong cities", one "Special Needs Learning Center" | ResourceHub's cold start; "Special Needs Learning Center" was made-up seed data, already rejected on 5 October (all eight are rejected) | Fixed (above) |
| "Prefer not to share" and "Your identity is not a barrier" work; more options like them | | "Not sure yet" in setup and Start here, "Not sure yet" for a task's length, and every optional question skippable |

### Their recommendations (slides 2 and 9 to 15)

| They recommended | Now |
| --- | --- |
| "A short survey at the beginning to identify what focus group the customer belongs to" | Who you're here for, in Start here and setup |
| "An interactive walkthrough" | The tour, now beside the page |
| "Gradually introduce the user to more functionalities as usage increase without needing them to create an account" | Start here, the kits and ResourceHub's search need no account; one is needed only to save a path or a resource, or to make a plan |
| Option 2, their choice: sensory setting and the affirming line first, "one short categorization question early, the research survey after the first result, and account creation only when a user saves something" | Display first in setup; "There are no wrong answers" before the first question; who you're here for is the one categorisation; the questions after setup come after the plan (and not at all for "Not much" energy); an account is asked for when saving a path |
| Track "onboarding completion, drop-off points, acquisition channels, and feature usage" | The funnel report; **new**: features used in each of the first four weeks |
| "Respect the 'complexity of screen' options, and potentially design levels of complexity"; "hiding extra features behind toggles" | Simplified View (the default, which never changes by itself) and Full View, now one tap away in Display as well as Settings, with four levels of liveliness and Calm motion |
| Explore channel-specific personalization "once enough data is available" | Not yet, below |
| Instagram: "connect with advertisers and influencers" | For the team, below |

## Group 23

### What they found (slides 2 to 11)

| They found | What it was | Now |
| --- | --- | --- |
| Setup "overwhelming and lengthy" | Nine steps then; two now | Plus the energy check-in |
| The tour "blocks active use of the page content", "automatically changes the background webpage" and "resets to step one every time it opens" | All three were true in the code | All three fixed (above) |
| The tour labels buttons rather than "page-level workflows" | | The page guide explains each page's purpose and how to use it; the tour kept its tasks |
| The visual tracker and rewards work; keep them | | Kept: the rail, "Step 1 of 2", "About you is done" |
| Avatars, Dream Self and spirit animals feel like a lot even when skippable | Moved to the "Complete your profile" card | And now **rewards**: finishing a first step unlocks the character and spirit animals on the card early ("Unlocked: you finished your first step") |

### Their recommendations (slides 3 and 13 to 25)

| They recommended | Now |
| --- | --- |
| Avatar creation, Dream Self and spirit animals "inside the main app as unlockable, low-pressure goals" | Above |
| "An initial question asking users to select their current energy level ... so the setup length dynamically adapts"; it must be "optional and very brief", and people "should be able to change paths or skip the check-in" | Done: three chips, unanswered by default, changeable at any point in setup. Low: nothing more today, no questions after setup, the tour waits. Plenty: the optional questions on the page after setup |
| "Update the tour button so it opens guidance specific to the page the user is currently viewing" (Option 2, a "secondary phase") | Done now rather than later |
| Audit every question as "essential for first use", "helpful later" or "optional" | [onboarding-questions.md](onboarding-questions.md), rewritten with those three labels |
| Deferred questions "easy to find later", with "gentle reminders that users can dismiss" | The card on the Path (one at a time, can be hidden) and Your profile (always) |
| Compare the shorter and fuller paths: completion, time-to-finish, confusion, early engagement | The report: setup completion and median time by energy answer; first useful action; returns |
| "Test additional personalized paths by user type or entry channel" | By user type: the parent's plan, kits and needs. By channel: not yet, below |
| Measure "time spent, abandonment points, first meaningful action, and 7- and 14-day return rates" | All in the report; **new**: time spent in setup by version |
| Appendix: make "Add task" easier to find, and "allow flexible task entry for users who may not know the exact duration" | Done (above) |

## Group 24

### What they found (slides 2, 3 and 7 to 10)

| They found | What it was | Now |
| --- | --- | --- |
| A nine-stage intake starting with a nine-step avatar | Two questions now; the avatar is on the card | And never suggested to parents on the Path |
| "Goal Hijacking: Parent goals regarding child education branch into personal career interrogations" | The planner (above) | Fixed in the planner, the templates and the prompts for descriptions and tasks |
| "AI engine suggests Autinerary to itself with a 10% match" | ResourceHub's cold start, and no exclusion of its own listing (approved, named "Autinerary") | Fixed in every recommender (above) |
| "Secondary login wall for ResourceHub" | Above | Fixed |
| A "5-minute" promise that the 8-minute flow did not meet | The app dropped "5 minutes" in September; setup is two questions | The website, for the team |
| "Dense text blocks lacking visual anchors" | The app's pages are in short sections (Group 1 onwards) | The kits are numbered steps with ticks |

### Their recommendations (slides 3, 12 and 15 to 21)

| They recommended | Now |
| --- | --- |
| "A visible, permanent 'Skip to Resources' link on all intake screens" | On both setup steps, form and chat |
| Day 1 restricted to two questions: role, and "Immediate Need: Diagnosis Navigator vs. School IEP vs. Crisis Support" | Setup's two questions; for parents and supporters, "What are you looking for today?" adds "An assessment or diagnosis", "Support at school, like an IEP"; everyone has "Help right now" |
| Avatar and spirit animals into optional settings | Done (Groups 25 to 30) |
| "Program AI recommendation engine to filter out self-referential listings" | Done |
| "Instantly serve 100%-match starter packages when users skip profiling": an Ontario assessment and pediatrician navigator, and a school IEP and special education rights checklist; "Surface 2 pre-curated 'Caregiver Starter Kits' on the main dashboard" | The two kits, with plain titles, offered by "Skip to resources", Start here, the page after setup and a parent's Quick Links. Not called a "100% match": they are curated, and say so |
| A volunteer clinical advisory board and "Clinically Reviewed" badges | The kits show "Reviewed by …" only once a real reviewer is recorded (`review` in `lib/starterKits.ts`); until then they say no one has reviewed them yet. Recruiting the board is for the team, below |
| Re-engagement: email and in-app, "a same-day nudge, a Day 3 follow-up, and a Day-7 final reminder", three choices in each, snooze of 3 or 7 days, capped, CASL | Done (above); at most three, never two within three days, only between 9 AM and 8 PM where the person is, and none after setup is done |
| "Synchronize session state between Autinerary and ResourceHub to eliminate secondary login" | Done, without tokens in links |
| Success criteria: time to first resource under 60 seconds, Day 1 save rate, skip against complete, drop-off by step, Day 7 return, reminder return, snooze and opt-out, Day 14 active | All in the funnel report; **new**: time to first resource (with the share under 60 seconds), saved a resource within 24 hours, where skippers went, reminders asked, sent, opened, snoozed, stopped and finished after, and still using after two weeks |

## Not done, on purpose

- **Channel-specific onboarding (Group 22's option 3, Group 23's 60-90 day
  idea).** Riipen Labs' cohort report, across all 36 teams, asked for "the
  same onboarding spine across channels" and warned that "channel should not
  be used as a proxy for identity or need". Who arrives from each channel is
  measured instead.
- **A/B tests and a separate pilot flow (Groups 20 and 23).** About 50 people
  are in the beta; split in two, neither half could show a difference. Each
  change gets a new onboarding version and is compared before and after.
- **A "100% match" label on the kits (Group 24).** They are curated, not
  matched; a percentage would not be true.
- **A full rebuild (Group 24's option 1)**, which they also turned down.
- **An AI character that guides people (Group 21)**, which they left out of
  scope; the assistant and the page guide cover it.

## For the team

- **Apply STEP 71** (`backend/database/migrations/2026_paced_setup.sql`),
  after STEP 70. It keeps the energy check-in's answer and Start here's
  optional questions; until then both are dropped and nothing else changes.
- **The website, www.autinerary.ca (Groups 21, 22 and 24).** It is not in
  this repository.
  - A "Find where to start" button near the top, pointing at
    `https://app.autinerary.ca/start` (two questions, then starter resources,
    then three optional ones: the survey Group 21 described), beside
    "Create your free account" (`/signup`).
  - The waitlist Google Form asks people to rate Barrier Connections before
    they have seen it, is hard to read on a phone, and uses age groups the app
    does not (Group 22). If it stays, ask about features after people have
    tried them, link to the app instead of embedding the form, and use the
    funnel report's age groups or ask for an age.
  - Any "5 minutes" claim (Group 24): setup is two questions. Measure it in
    the funnel report ("time spent in setup") before quoting a time.
  - The title's "(2025)" (Group 25, still open).
- **Clinical reviewers for the kits (Group 24).** Two or three volunteers (for
  example a pediatric occupational therapist, a child psychologist, a special
  education advocate). When one has read a kit against its sources, add
  `review: { by, role, on }` to it in `frontend/lib/starterKits.ts`; the page
  then says "Reviewed by …". Reread every kit's sources every three months and
  update `checked`.
- **Reminder emails and CASL (Group 24).** They go only to people who asked,
  name Autinerary Corp. with its postal address, and stop in one click or
  from any email. Worth a look by whoever owns compliance.
- **Instagram (Group 22).** Partnerships with creators who reach
  neurodivergent adults and parents; links should carry `utm_source=instagram`
  so the report can count them.
- **Supabase: the email OTP expiry** (Authentication settings) also limits
  ResourceHub's one-time sign-in code. The code is used at once, so a shorter
  expiry (for example 10 minutes) would cost nothing there, but it also
  shortens password-reset and confirmation links.

## Checks

- `scratchpad/browser/g20.mjs` (local build, real backend; 79 checks):
  Display and Calm motion before sign-up; the home page's care lines; Start
  here's kits, Help right now and optional questions; the kit pages; the
  glossary's crisis lines; sign-up's button still on the first screen with
  Display added; ResourceHub's sign-in page. A parent: the energy check-in,
  the parent's needs and Help right now, reminders asked, cancelled, a bad
  link refused and a snooze from the email; one area first; the helper's
  example; a real plan with no career steps for the parent; the short page
  after setup; no tour by itself; Quick Links; the page guide; the tour
  beside the page, not moving it, resuming and starting over; Display's
  views; Races' one area; the calendar's task with no length; ResourceHub
  signed in from the app with no token in any link, Save through the one
  sign-in, and no "% match" under 50. Someone who skips to resources: on the
  kits in seconds, recorded, and the Path's card's choices. Two throwaway
  accounts, deleted at the end.
- Backend: 326 tests, including `tests/test_path_planning_supporting.py`,
  `tests/test_self_listing.py` and the funnel report's new sections
  (`PacedSetupTests`), in a clean copy with no secrets.
- Unit tests: `lib/lifeAreas.test.mjs`, `lib/starterKits.test.mjs`, and new
  cases in `lib/reminderSchedule.test.mjs`, `lib/profileItems.test.mjs` and
  `lib/places.test.mjs`.
