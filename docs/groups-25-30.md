# Riipen Labs Groups 25 to 30, September 2026

Six Riipen Labs reports from 25 September 2026, all about sign-up and the
first days:

- **Group 25**, "Simplifying Autinerary's User Experience": a sign-up page
  testers could not scroll to the end of, a dated search result, dense
  homepage text, and personalization asked before people reach the app.
- **Group 26**, "Onboarding & Initial Experience": a 9-step setup overloaded
  with optional steps; take out Location, Personalize and AI
  Recommendations, make the rest concise, and update the tour.
- **Group 27**, "Customer Experience Brief": a tour that explains but never
  asks people to do anything, inconsistent headings, a flat table of
  contents, and too many features at once.
- **Group 28**, "Reducing Onboarding Friction for Users": ask only what
  places someone on one path, show it, ask the rest in context, give every
  question a visible reason, and measure where people stop.
- **Group 29**, "Customer Experience Brief": a Skip / Fast-Track on the first
  step, a "Complete your profile" card for character, avatar and
  preferences, a default avatar, mini-rewards, and reminders in the first
  two weeks.
- **Group 30**, "Customer Experience Brief": progressive onboarding, avatars
  and spirit animals later, answers that can be changed, calmer visuals, a
  consistent check before changes reach testers, and day-30 retention.

They tested the app around 20 September, when setup was nine steps. Setup
became two required steps with seven optional extras after them in early
October (Group 5, `twostep-2026-10`). Five of the six asked for the next
step, and it is done: **setup is the two required steps, and every optional
question is in the app**, on a "Complete your profile" card, where each is
used, and in Settings (`express-2026-10`). This page says what Autinerary
does for each point as of 12 October 2026, slide by slide.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Setup | Two required steps, then "Add optional details first" opening seven more (Norms, Location, Motivation, Character, Dream Self, Spirit animals, Personalize). Setup also asked the age again, after sign-up's date of birth, and offered pronouns and a username | The two steps only: who you're here for (and, optional, what you're looking for), then one goal. The age comes from sign-up. Required questions have a red asterisk, said in words too. Each question says why it is asked. Under the button, what the next step involves. "About you is done. This is the last question." on the goal. A goal's dream and obstacle are folded behind "+ Add a dream or an obstacle (optional)", and typing a goal offers that area's ideas. No decorative clouds |
| The optional questions | Asked in setup, and some (location, sensory needs, character) again on the Path over the first two weeks | **Complete your profile** (`components/ProfileCompletion.tsx`, `lib/profileItems.ts`): your city, reminders for your first two weeks, how the app looks, what motivates you, your norms and support needs, your character and Dream Self, your spirit animals. "2 of 7 done" with a bar. Each says what it unlocks. Four are answered on the card; three open where they live. The Path shows one at a time, in the order they help (norms from day 7, character and spirit animals from day 10, as Group 5 asked) and "See all"; it can be hidden there. Your profile always has all seven |
| Personalize | Setup's last step | A **Display** button on the Path, beside Show more: light or dark, higher contrast, text size and how lively it looks, changing at once |
| AI Recommendations | Dropped from setup (Group 5), and the page that shows them was linked from nowhere | **AI suggestions for your steps**, under your next step on the Path, and in All places |
| Location | Setup's optional step | On the card, with the browser's autofill; ResourceHub already asks with "Set your location" |
| What motivates you | Setup's optional step; nothing could change it afterwards | On the card, saved with the account (`profiles.preferences.motivation`); the backend uses it when matching people motivated in similar ways (`core/pattern_reindex.py`) |
| The tour | Nine screens of descriptions | Four parts, each with one thing to try before Next (open your next step, open the Calendar, pick today's energy, open Display), "Skip this one" always there; then where the rest is, and ResourceHub at the end. Says how the parts connect |
| Sign-up | The button about 991 pixels down: below the first screen of every laptop and phone tested | On the first screen at 1280 by 720 and on a phone, with Google sign-in on; centred in a way that never cuts off the top. Cost, privacy and the next step before the first field. Every field fills in from the browser. Red asterisks |
| The glossary | A flat list of ten sections | Sections in larger type with their words under them, smaller and indented; and **Search this page** |
| Headings | 29 different page-heading styles | One: every page title is the same size and colour (a compact bar keeps its smaller one) |
| Measuring | Day 1, 7 and 14 returns; setup steps; the survey | Also day 30, the card's answers by question, the tour's tasks, and "Was making your account clear and quick?"; the onboarding version changed so before and after can be compared |
| Checks | None automatic | Every change to `main` is type-checked, unit-tested and built (`.github/workflows/checks.yml`), with [release-checks.md](release-checks.md) for what to try by hand |

### Found and fixed while doing this

Moving the optional questions out of setup exposed two places where making
a new plan **deleted** what people had saved. Both happened before this
change, to anyone who made a second plan; without the fixes, every new
plan would have done it.

- **Norms.** The backend replaced all of a person's norms with setup's
  answer (`_persist_barriers_to_supabase`). A new plan without the norms
  question deleted norms added in ResourceHub, with their severity and any
  organisation's confirmation, and wrote "Prefer not to share" instead. It
  now only adds; "Prefer not to share" is only for people with no norms,
  and goes once a real one is added. Setup now sends the norms someone has
  saved, so a new plan still fits them.
- **Settings.** The backend wrote setup's preferences over the whole
  `profiles.preferences` column (`_persist_preferences_to_supabase`):
  email and check-in choices, a paused account, spirit animals, the
  character, Dream Self goals, notes about people and ticked plan tasks
  were reset by a second plan. It now merges, keeps everything else, and
  never lets an old page's defaults reset a choice. (The QA account's saved
  settings were exactly setup's object, which is what this leaves behind.)

Also: the Path read spirit animals only from setup's answer, so choosing
them in Settings never showed; it reads Settings first now. And the tour's
"Show me" for Find resources had pointed at nothing since that button was
renamed.

## Group 25

### What they found (slides 2, 5, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| "The signup page would not allow us to scroll down to complete account creation", on a phone and a laptop, by three testers | Checked on production on 12 October at nine sizes: the page scrolls, by wheel and touch, and nothing covers the button. But the button sat about 991 pixels down, below the first screen even at 1280 by 720, and the page was centred with flex, which on a short window cuts off the top of a form so it cannot be scrolled to. The website, where they started, scrolls too, but its only sign-up link is "Sign up to our Waitlist", a Google Form: nothing on it leads to the app | Sign-up fits the first screen of a laptop (with "Sign up with Google" on, as in production: the button at 677 of 720 pixels at 1280 by 720, 701 of 768 at 1366 by 768) and a phone (778 of 844), and scrolls to it on a small phone or at 200% zoom. "Already have an account? Sign in" moved to the top line, the name and date of birth sit side by side on a wider screen, and the two password fields side by side. It is centred with margins, which never cut anything off. For the website, see "For the team" |
| Found "through a Google search to find an outdated title link" | The website's title is "Autinerary - A Positive, All Purpose Hub for Autism (2025)", and its description says "(updated for 2025)". The app's own title was "Autinerary - Goal Planning System" | The app's title is "Autinerary: a life plan built around how you work", with a description saying it is free in the beta, what it does and who it is for, and no year. The website's is for the team, below |
| The homepage has "large blocks of dense text" | The website's homepage is 8,700 pixels tall on a phone. The app's home page is already in short sections with the details folded (Group 1) | The app's home page opens with an "On this page" list of its six sections. The website's text is for the team |
| Personalization questions are "front-loaded into sign up rather than saved for after account creation" | Sign-up asks only name, date of birth, email and password; setup then asked up to nine steps | Setup is two questions; everything else is in the app |
| The homepage's warm, positive tone works; keep leading with it | | Kept: nothing in the wording changed tone |

### Their recommendations (slides 9 to 14)

| They recommended | Now |
| --- | --- |
| Fix the signup usability issue; retest the full flow on mobile and desktop | Above. The test (`scratchpad/browser/g25.mjs`) checks the button at a laptop, a phone and a small phone |
| Simplify onboarding by moving personalization questions after users enter the app (option 2 with option 1, their choice) | Done: the "Complete your profile" card |
| Separate essential signup fields from preferences users can add later | Sign-up has only the four essentials, now marked required; setup's two questions are what the plan needs |
| "A decision on which profile/personalization fields are 'must-have before entry' versus 'nice-to-have later'" | Must-have: 18 or older (from sign-up), who you're here for, one goal. Everything else is later |
| Restructure the homepage into "shorter, more scannable sections", and update the outdated "(2025)" search title (60 to 90 days) | The app's home page and title, above; the website's, for the team |
| Test with a small batch of beta users; "directly ask beta testers if signup felt clear and quick" | The questions after setup now start with **Was making your account clear and quick?** (yes, mostly, no), kept from STEP 70 and counted by the funnel report. The beta sessions are in [beta-test-plan-2026-10.md](beta-test-plan-2026-10.md) |
| Measure "signup completion rate (before vs. after the fix)", and whether more users get through onboarding into the app | The funnel report counts sign-up and setup completion by onboarding version; this change is `express-2026-10`, so it compares with `twostep-2026-10` |

## Group 26

### What they found (slides 2, 5, 6, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| A "9-step onboarding process ... overloaded with optional steps", especially Location, Personalize and AI Recommendations | Two required steps, then seven optional ones offered | The seven are out of setup |
| "Your Norms ... requires to scroll through many categories" | The norms step: connections, then lists of conditions, identity, money and access | Out of setup. Norms and support needs are on the card, and open the private profile page (`/profile/diagnostic`); identity and access norms are in ResourceHub's profile, which already edits them |
| Users "might not realize what sections are required what can be skipped", for "lack of visual cues" | "Optional step" labels on the extras only | Red asterisks on the required questions, "Required. Everything else is optional." above them, and "(optional)" beside the optional one |
| Many open-ended questions, like in Goals | Each goal had a dream and an obstacle field open beside it | Folded until asked for; goal ideas to pick from, and suggestions as you type |
| Users "expect ... a clear detailed app tour" | The tour described each screen | The tour has people try four core parts (Group 27, below) |
| Keep the Resource Hub as the distinctive feature | | The tour ends on ResourceHub, and it stays a Quick Link and in the top bar |
| "Skip" made little difference to drop-off | The per-step "Skip this step" | Gone with the extras. "Skip setup for now" (Group 33) stays on the first step |

### Their recommendations (slides 9 to 14)

| They recommended | Now |
| --- | --- |
| Remove Location and AI Recommendations from onboarding (option 2, their choice), and move Personalize to a toggle on the home page (option 3) | Done: Location is on the card; AI suggestions are under your next step and in All places; **Display** is on the Path, beside Show more, "like the Dark/Light mode" toggle they described |
| Personalize could offer "themes that correspond to their general aesthetic" | Display has light or dark, contrast, text size and four levels of liveliness (Plain, Pretty, Exciting, Fun). Accent colours stay in Settings |
| "Scroll-free sections", "dropdown menus" for questions with many specific answers, "red indicators for required fields", "a preview of what the next step involves" (option 1) | The long sections left setup. Setup's first step is shorter (no age question, no pronouns). Red asterisks. Under the button: "Next: your goal. Pick an idea or type your own, about a minute." and "Next: we make your plan, in about a minute, then you are on your Path." The role list kept its buttons, which show what each covers (Group 32); a dropdown would hide that |
| Move Location to profile completion and the app tour; tie it to Your Resource; "Set Your Location" in the Resource Hub | The card says what the city unlocks ("services near you in ResourceHub, nearest first"); the tour's fourth part points at the card; ResourceHub already has "Set your location" on its home page and profile |
| AI Recommendations "accessible within the app, whether through a button or a specific location" | The link on the Path and in All places, to the page that shows the AI's suggestions for each step |
| "All new changes should be clearly reflected in a new app tour" | The tour's fourth part, "Make it yours", points at Display, Complete your profile and AI suggestions |
| Autofill, autocomplete or predictive text to reduce typing (60 to 90 days) | Sign-up, sign-in and the city fill in from the browser (`autocomplete`); typing a goal suggests that area's ideas (`datalist`) |
| A suggestion and feedback option during testing | "Tell us how it's going" in the glossary (Group 31), at any time |
| Track and compare completion before and after | The onboarding version (above) |

## Group 27

### What they found (slides 2, 5, 6, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| "Dissatisfaction with Interactive Tour due to lack of user input prompting"; the tour "does not clearly explain how they work together" | Nine screens describing pages, with "Show me" | Four parts with a task each (below), and a line on each saying how it connects to the rest |
| Inconsistent fonts, headers and alignment across the MVP | 29 heading styles across 49 pages: five sizes and two colours | Every page title is `text-2xl sm:text-3xl font-bold text-slate-900`; pages with a compact top bar use one smaller size. Themed headings (the milestone signpost, Dream Land) keep their look |
| The table of contents does not show sub-pages within topics | The glossary's "On this page" was ten links of one size | Sections in larger type, their words under them in smaller type, indented. All places does the same: group names larger, places indented under them |
| Too many features introduced before the purpose is clear | Setup's extras; the tour's nine screens | Setup is two questions; the tour has four core parts, then "More, when you are ready" points at All places |
| Users "may struggle to understand why certain personal information is being requested" | | "Why we ask" on each setup question; each card item says what it unlocks |
| A search bar, like Autism BC's (option 3) | | **Search this page** in the glossary; the assistant answers anything else |

### Their recommendations (slides 10 to 15)

| They recommended | Now |
| --- | --- |
| "Identify the 3 to 4 features that best show Autinerary's value and should anchor onboarding" | Your next step, its tools, the Calendar at your energy, and making it yours; ResourceHub last |
| "Add prompts that have users complete a task before moving to the next feature" (their final recommendation: "required prompts") | Next is waiting until the part's task is done or skipped. "Try it" rings the control and leaves the page usable; doing it moves the tour on, on the page it leads to. "Skip this one" is always there: a task nobody can leave would be a trap |
| Standardize fonts, header styles, text alignment and layouts | Page titles, above. The card, Display and the tour use the app's existing button styles |
| Text size variation in the table of contents | Above |
| Fewer open-ended questions and personal-information requests before value | Setup asks two questions; the goal's dream and obstacle are folded; ideas to pick |
| Introduce personalization and advanced functions gradually | The card suggests one question at a time, by day; the simple view opens with "Show more" |
| Track completion, drop-off by step and return usage; test with neurodivergent community members | The funnel report, with the tour's tasks (STEP 70). Testing with the community is the beta sessions |

## Group 28

### What they found (slides 2, 5, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| "New users are asked for excessive info before Autinerary returns anything useful" | Up to nine steps before the plan | Two, then the plan |
| Before signing up, people should understand what it is, who it is for, how it benefits them, "any costs or subscriptions", "how their personal information is protected", and "what their next step should be" | The home page covered these, spread down the page; sign-up said the next step | The home page's hero adds "We never sell your information" to "Free during the beta · No credit card · For adults 18+", and its "On this page" list ends with "Cost, privacy and what setup asks". Sign-up opens with three ticks: free, no credit card; we don't sell your information (with Privacy); next, two quick questions |
| "No tracking to show whether they left because the app overwhelmed them or because they lost interest" | The funnel has counted each setup step since STEP 45, and check-ins ask people who stopped why | Already there; this report adds the card and the tour |
| A parent looking for services and an adult looking for community go through the same screens | Who you're here for and what you're looking for decide what is shown first (Groups 3 to 5, 32) | Kept, as the two questions setup still asks |

### Their recommendations (slides 9 to 21)

| They recommended | Now |
| --- | --- |
| "Replace onboarding with a short guided first run that asks only what is needed to place a user on one relevant life path, then shows it" | Setup is who for, what you're looking for, one goal; then the plan, with starter resources for the answers |
| "Move the remaining personalization into the app, asked in context at the point it is actually used" | The card, and in place: Races says "On the track you are a placeholder for now. Design your character"; a step's tools say "These suggestions don't know your norms yet" with "Add your norms" when there are none; ResourceHub asks for a location when it needs one |
| "Each question carries a visible reason for being asked" | "Why we ask" in setup; "Unlocks ..." on the card |
| "Add drop-off tracking at each step before October" | Already there (STEP 45), reported by step and version |
| Keep it to a few questions, "show progress", "let them switch paths or view other options at any time" | Two questions, "Step 1 of 2" and the rail. Who you're here for can be changed in Settings (Group 32), and a new plan made any time |
| A help tool: "a chatbot or searchable help option" | The assistant, and the glossary's search |
| "Personalize beyond sign-up ... suggested next steps or reminders" | Quick Links follow who you're here for; the page after setup opens with what you were looking for; reminders for the first two weeks are on the card |
| A one-question survey at the end of onboarding | The questions after setup (Group 1 onwards), now with the sign-up question |
| A pilot group on the new flow, and the old one kept as a fallback | Not done on purpose, below |

## Group 29

### What they found (slides 2, 5, 6, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| Users "make many big choices – like picking identity tags, life goals, and ratings – all at once" | Norms (the identity tags) and goals in several areas in the app's setup; ResourceHub's setup used to ask how much each norm affects daily life, until Group 8 | Out of setup: one goal, and norms on the card |
| "Everyone follows the exact same long setup steps, no matter where they clicked in from" | Every campaign link opens Start here with a welcome line for its channel, then the same questions (the cohort report: "use the same onboarding spine across channels, then vary the entry framing") | The spine is now two questions for everyone. See "Not done, on purpose" for channel-specific paths |
| No exit or skip path during account creation | "Skip setup for now" since Group 33, on the first step | Kept, near the top of the first step, ready at once now that the age comes from sign-up |

### Their recommendations (slides 9 to 14)

| They recommended | Now |
| --- | --- |
| A "Skip / Fast-Track" button on step 1 that goes straight to the app (option 2, their choice) | "Skip setup for now", and with no extras the full setup is itself the fast track |
| "Ensuring default avatar settings exist if skipped" | A plain silhouette stands in on the race track and Your profile (`components/DefaultAvatar.tsx`), not a drawn face that may not look like the person |
| Character, avatar and preference customization on an optional "Complete Your Profile" card on the dashboard, and inside user settings | On the Path, and always on Your profile |
| "Easy progress bars and fun mini-rewards" during setup | The rail turns each answered step into a tick; "About you is done. This is the last question."; choosing who you're here for says what it brings; the card's "2 of 7 done" bar and "Added." Calm, as Group 9 and Group 30 asked |
| "Gentle in-app and email reminders during the first 7 to 14 days" | In the app: the card's next question, the getting-started checklist and the check-ins. By email: **Reminders for your first two weeks** on the card, a daily email at a chosen time that stops by itself 14 days after the account was made (`reminderDue`, `until`); off unless turned on, with the address shown. Settings says when it stops, with "Keep sending after that" |
| Entry pages by channel (Facebook parents, TikTok adults) | Not done on purpose, below |
| An A/B test of the skip option against the 9-step flow | Not done on purpose, below; before and after are compared by version instead |
| Check whether the time to first meaningful action goes down | The funnel report's "opened their first step" and "reached something useful", with median times, by version |

## Group 30

### What they found (slides 2, 5, 6, 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| "An overwhelming amount of information to be filled out"; "the goals and dreams section can be difficult because the questions are open-ended" | Above | Above |
| Similar apps unlock the dashboard after two or three questions | | Two questions, then the plan |
| "Screens are visually plain, so there is little to pull users forward" (option 3) and also a need for less sensory load | | The new parts use the app's existing look; setup lost its decorative clouds |
| "Changes reach testers without a consistent check" | No automatic checks | Below |

### Their recommendations (slides 10 to 15)

| They recommended | Now |
| --- | --- |
| "Step-by-step progressive onboarding" (option 2, their choice): essential steps first, the rest introduced as people use the app | The two steps, then the card, one question at a time |
| "Making less-essential options, such as avatars or spirit animals, optional or introducing them later" | Both on the card, suggested from day 10 |
| "Allow users to access the main platform before completing every question, while keeping some features locked until essential information is provided" | The app opens after two questions (or none, with Skip). What still waits for an answer says so: services near you need a city; a character on the track needs one designed; tools that fit your norms need them |
| "One question per screen, progress indicator, 'skip for now'" (a prototype idea) | Two short screens with a rail and "Step 1 of 2", and "Skip setup for now". One question per screen would add screens back, which Group 26 and their own risks ("more screens feeling longer") warn against |
| "Move deferred questions into contextual prompts shown when related features are first used" | Races (character), a step's tools (norms), ResourceHub (location) |
| "Save-and-resume and the ability to edit answers later" | Setup saves as you go (since Group 11). Every answer can be changed: who you're here for in Settings, the card's answers on the card, the rest where they live |
| "Calmer visuals, reduced sensory load, clearer copy" | Setup without the clouds; Display's liveliness and contrast one tap from the Path; the plain wording of the card and tour |
| Fix bugs with a consistent check | `.github/workflows/checks.yml`: on every change to `main`, both apps are type-checked and built, the app's unit tests run, and the backend's 300-odd tests run, with no secrets. [release-checks.md](release-checks.md) lists the browser checks to run before a release |
| Track "completion rate, per-step drop-off, time to complete, return rate for deferred questions, day-7 and day-30 retention, short post-onboarding survey" | All in the funnel report: setup steps and times, returns within 1, 7, 14 and now 30 days, the card's answers by question, the survey |
| A/B test the new flow against the current one | Not done on purpose, below |

## Not done, on purpose

- **Channel-specific entry paths (Group 29).** Every campaign link still asks
  the same two questions, with a welcome line for its channel. Riipen Labs'
  cohort report, covering all 36 teams, asked for "the same onboarding spine
  across channels" and warned that "channel should not be used as a proxy
  for identity or need": a parent can arrive from TikTok. Who arrives from
  each channel is measured instead (the funnel report's "By channel").
- **A/B tests and a pilot group (Groups 28, 29 and 30).** About 50 people
  are in the beta, and every group in the funnel report under five is
  hidden: split in two, neither half could show a difference. Each change
  gets a new onboarding version and is compared before and after. Worth
  revisiting once sign-ups are in the hundreds.
- **One question per screen (Group 30's prototype).** Above.
- **Dropdowns for the role (Group 26).** The seven answers are buttons with
  what each covers beside it (Group 32); a dropdown would hide that, and the
  list is short.

## For the team

- **The website, www.autinerary.ca (Group 25).** It is a separate site, not
  in this repository. Suggested title and description, without a year:
  - Title: `Autinerary: a positive, all-purpose hub for autism`
  - Description: `A positive, all-purpose centre for anyone connected to autism: plan your goals in small steps, find services rated by people with similar norms, and learn from people with lived experience. Free during the beta.`
  - Its only sign-up link is "Sign up to our Waitlist", a Google Form, and
    nothing on it leads to the app. A "Create your free account" button
    pointing at https://app.autinerary.ca/signup, near the top, would let
    people from a search reach sign-up.
  - Its homepage is about 8,700 pixels tall on a phone: shorter sections
    with headings, as Group 25 suggested, and as the app's home page now has.
- **Apply STEP 70** (`backend/database/migrations/2026_express_setup.sql`),
  after STEP 69: it keeps the tour's events and the answer to "Was making
  your account clear and quick?". Until then both are dropped and nothing
  else changes.
- **Test with neurodivergent community members** (Groups 26, 27, 28): the
  beta sessions.

## Checks

- `scratchpad/browser/g25.mjs` (local build, real backend; 71 checks): the
  home page's sections and title; sign-up's button on the first screen at
  1280 by 720 and 390 by 844, and reachable at 360 by 640; autofill and
  required marks; the glossary's contents and search; setup's two steps,
  reasons, previews and folded details; a real plan made after a norm, the
  check-in choice and a spirit animal were saved elsewhere, all three kept;
  the survey's new question; Display, AI suggestions and the card (city,
  motivation and two-week reminders saved, counted, hidden, on Your
  profile); Settings; the tour's tasks, done, skipped and counted. One
  throwaway account, deleted at the end. `races_default.mjs`: the default
  character on the Track View.
- On production, 12 October after the deploy (10cd011): `g25.mjs` 69 of 71
  on the first run, both misses the sign-up button with Google sign-in on
  (fixed in 10cd011; `signup_sizes.mjs` then 677 of 720, 701 of 768 and 778
  of 844, and the signed-out checks 15 of 15); a real plan made by the
  production backend kept the norm, the check-in choice and the spirit
  animal saved before it. The Groups 31 to 33 suites (43 and 34 checks),
  `races_default.mjs`, the social features (19) and the accessibility
  checker (66 page views, nothing serious) all passed. The first
  production run hit Vercel's Security Checkpoint, which challenges
  automated browsers after a burst of requests; it lifted within minutes,
  and the run was repeated with pauses.
- The first CI run (`checks.yml`) passed all three jobs on both copies of
  the repository.
- Unit tests: `lib/profileItems.test.mjs`, `lib/reminderSchedule.test.mjs`;
  backend `tests/test_persist_barriers.py`, `tests/test_persist_preferences.py`,
  `tests/test_pattern_reindex.py` and `tests/test_onboarding_funnel.py`
  (`ExpressSetupTests`).
