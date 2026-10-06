# Beta test plan: October 2026

For the Autinerary team and Riipen Labs reviewers. Group 2's report
("Improving the Autinerary User Experience") recommended four things:

- task-based beta testing with neurodivergent (ND) and neurotypical (NT) users
- comparing goal completion, clarity and perceived effort across
  representative user types and acquisition channels
- a 30-day trial in October
- asking active users whether the app is useful, and inactive users why
  they stopped

This plan covers all four. It uses only measures the app already records
(see "Measures" below), plus notes from moderated sessions.

Group 4's report ("Customer Experience Optimization Report") recommended a
guided "Start Here" before the full app, campaign links that land on it, and
testing it with "5-8 task-based tests with representative users" before the
next campaign push. Start here is live (see [start-here.md](start-here.md));
its first task and its measures (clarity, completion, relevance and
confidence) are part of this plan too.

Group 5's report recommended a shorter, persona-based start: "reduce initial
sign-up to 3 core steps (account setup, primary role, immediate goal)", a
personalized "Start Here" resource right after it, deeper questions
(sensory needs, conditions) over days 7 to 14, a week-two check-in, and a
clear path from the October campaign (merch, comic, research) to sign-ups.
All of that is live. Their measures are below: drop-off (target: 40% less),
returns within 7 to 14 days, and satisfaction in the first weeks. The
campaign's links and QR codes are in [campaign/README.md](campaign/README.md).

Group 6's report ("Optimizing User Experience") recommended a short welcome
survey that leads to relevant starting points, features introduced
gradually, an empathetic voice, tracking "where they click, leave, and
whether they return", and testing "with a small group of users from
different customer groups". The survey and starting points are Start here
and the two-question setup. From the second day, the Path offers its fuller
view instead of switching by itself. The voice is in
[voice.md](voice.md), and the report now shows where people leave.

Group 7's report ("Customer Experience Optimization") recommended
progressive onboarding with only essential questions first, one clear first
action on the dashboard, and measuring "completion rates, time to first
action and drop-off by step". Which questions are asked when is in
[onboarding-questions.md](onboarding-questions.md). The Path's first card
is "Your next step", with one button. The feedback form no longer reaches
people before they have used the app.

Group 8's brief ("Customer Experience Brief") reviewed ResourceHub's sign-up
and asked for three steps (role, one topic, a first resource), results sorted
by distance, and more questions asked later, in context. ResourceHub's setup
is now those three steps; search and the home page show places near you
first; identity, health and more topics live on the profile; and three
prompts ask for more when it is useful. Details are in
[resourcehub-first-session.md](resourcehub-first-session.md).

Group 9's report, from one student who tested the nine-stage setup, asked for
essential questions first (done: two questions, the rest optional or asked
later), less shown at once, calmer visuals, and a fix for the "freezing" they
hit. The freezing was the path failing to generate: 223 of 293 attempts in
September stopped with "Too many requests in the last minute", because a
second generation for the same person (a retry, or a request the browser
gave up on while the sleeping backend woke) ran beside the first and both met
the per-person AI limit. The backend now runs one generation per person, the
app wakes the backend when sign-up, sign-in or setup opens, and setup waits
60 s instead of 20. The goal step opens only the category picked (it showed
all six at once), the norms list opens one section at a time, and setup's
grass track with seven food emoji and an endlessly hopping bunny is now a
slim progress bar with the bunny on it.

Group 10's report ("Simplifying onboarding while preserving personalization")
recommended progressive onboarding: welcome, user type, immediate goal, a
useful path, micro-prompts when relevant, and check-ins that adjust the path.
The first five were in place; check-ins now offer a change matched to the
answer (a different goal, starter resources, or just the next step). Their
three open questions are answered here: which questions are essential is in
[onboarding-questions.md](onboarding-questions.md), now grouped as they asked
("essential now, useful later, optional"); which groups to test first is
proposed under "Who takes part"; and what is tracked is under "Measures".

A note on timing: Autism Acceptance Month is in April. October is ADHD
Awareness Month (and Dyslexia Awareness Month), so outreach copy for an
October trial should lead with that.

## Before the trial starts

Everything for recruiting and running sessions is in the
[beta testing kit](beta/README.md): outreach posts with each channel's tracked
link, the sign-up questions, the consent text and the facilitator's script.

| Item | Why | Status |
| --- | --- | --- |
| Apply STEP 46 (`setup/all_migrations.sql`) | Stores check-in answers | Done 4 October |
| Email: Resend with autinerary.ca verified, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `REMINDER_FROM_EMAIL` | Welcome, reminder and check-in emails | Done 4 October (test email delivered) |
| `CRON_SECRET` in Vercel | Only Vercel can trigger the daily email jobs | Done |
| Google sign-in (provider on in Supabase, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`) | Sign up with Google | Done; confirmed with a real Google account 4 October |
| Privacy page | What testers are told about their information | Live at /privacy |
| Apply STEP 47 (`backend/database/migrations/2026_push_subscriptions.sql`) | Notifications on a device | Done 4 October; tested live (on, delivered, off) |
| Apply STEP 48 (`backend/database/migrations/2026_start_here_events.sql`) | Counts Start here's measures | Done 4 October; tested live |
| The app's own address, app.autinerary.ca (Route 53, Vercel, Supabase sign-in redirect) | Printed QR codes and shared links never have to change ([campaign/README.md](campaign/README.md)) | Done 4 October |
| Apply STEP 49 | Counts which parts of the app people open | Done 4 October; tested live |
| Apply STEP 50 (`backend/database/migrations/2026_ask_later_events.sql`) | Counts whether people answer the questions asked later; until then those events are dropped | Done 5 October, with STEP 51; tested live |
| The backend sleeps when idle: its first answer on 5 October took 41 s | The app now wakes it when sign-up, sign-in or setup opens, so it is usually awake by the time a path is made, but someone opening the Path straight after a quiet spell still waits. A plan that does not sleep would remove the wait | Decide |
| Apply STEP 51 (`backend/database/migrations/2026_resourcehub_events.sql`) | Counts ResourceHub's first session: setup, first place opened, results near you, and the prompts. It keeps every STEP 50 event, so running it alone covers both | Done 5 October; tested live |
| Fill the `[[TEAM: ...]]` blanks in the kit (thank-you, form link, booking, facilitator) | Before anything is posted | To do |
| Make the Google Form from [screener.md](beta/screener.md) | Session sign-ups | To do |
| Book 2 pilot sessions | Fix the script before the real sessions | To do |

## Who takes part

Everyone must be 18 or older (the app's rule for now). Recruit across the
first onboarding question ("Who are you here for?"), because that is how
results are split:

| Group | Recruit | Notes |
| --- | --- | --- |
| ND adults, for themselves | 6 to 8 | Mix of autism, ADHD and other; mix of ages |
| Parents of an ND child | 4 to 6 | |
| Siblings, partners, other family | 3 to 4 | |
| Teachers, employers, support workers, allies | 3 to 4 | |
| NT adults, for themselves | 4 to 6 | The comparison group Group 2 asked for |

Priority groups, proposed for the team to agree (Group 10: "choose 2-3
priority user groups"; Group 8 chose the same two): **ND adults, for
themselves**, and **parents of an ND child**. They are the largest rows above
and the two groups the outreach posts reach first; the other three rows are
recruited in smaller numbers so their results can still be compared.

ND or NT status comes from the sign-up screener, with consent, and stays in
the research spreadsheet under a participant code. It is never put into the
app, a tracked link or analytics: it is health information, and with groups
this small it would identify people.

Group 8 wrote a short feedback form for neurodivergent club executives at
Western (https://forms.gle/hRNpUKtBsA8B8RacA); the clubs had not replied by
25 September. It can be reused, but it belongs to Group 8's Google account:
ask them to add the team as an editor, or make a copy, before sending it, or
the answers go to them.

## Part 1: moderated task sessions (weeks 1 and 2)

About 40 minutes, remote or in person, think-aloud, recorded only with
consent. The participant uses their own phone or computer. The facilitator
reads each task, does not help unless the participant is stuck for two
minutes, and notes success, time and where they hesitated.

Before the first task, the participant looks at the home page without
clicking, and says in their own words what Autinerary is for (Group 4's
clarity measure).

| # | Task (as read to the participant) | Success means |
| --- | --- | --- |
| 1 | "Without making an account, find something that could help with your situation today." | Answers both Start here questions and opens one starter resource |
| 2 | "Make an account and get to your plan." | Reaches the Path, with or without Google |
| 3 | "What is the first thing your plan suggests you do?" | Names the first milestone |
| 4 | "Find a service near you that could help with that." | Opens a relevant ResourceHub result |
| 5 | "Mark something as done." | Completes a milestone or task |
| 6 | "Make the app easier on your eyes." | Changes a display setting |
| 7 | "You want to stop the app sending you emails. Do that." | Finds the email setting |
| 8 | "Find a place you've been to, or would like to go, and rate it." | Submits a rating |

After each task, ask: "How easy or hard was that?" (1 very hard to 5 very
easy, the same scale as the in-app survey). After task 1, also ask whether
the resources fit what they need, and what they would do next. At the end,
ask: "What would you use this for, if anything?" and "What nearly made you
give up?"

Record per task: success (yes / with help / no), time, ease 1 to 5, and
quotes. Compare ND and NT participants, and the five groups above, on task
success and ease. The full wording, prompts and notes template are in
[session-script.md](beta/session-script.md).

For participants who start in ResourceHub (Group 8 asked to "test the
restructured 3-step flow with an expanded beta group"): "Sign up for
ResourceHub and find one place that could help." Success means reaching a
place at the end of setup; note whether they set a location, and what they
make of "Near you" and "Broader options".

Task 7 matters beyond the sessions: ResourceHub's norm and minimum-rating
filters only find places once people have rated them, and today the only
rated, approved place is Autinerary itself (the other ratings belong to
rejected seed entries). The outreach posts and trial emails should ask
testers to rate places they know, too.

## Part 2: the 30-day trial (12 October to 10 November)

Open to anyone 18+ who reaches the app through a tracked link. No
facilitator. The app collects everything below by itself.

Tracked links: add `?utm_source=<channel>` to the address, one value per
channel, lower case. Campaign links open Start here (`/start`), and can
answer its first question for the people a channel reaches (Group 4's
"targeted landing paths"); [outreach.md](beta/outreach.md) has one for each
channel. The home page works too, for example:

```
https://app.autinerary.ca/?utm_source=riipen
https://app.autinerary.ca/?utm_source=reddit
https://app.autinerary.ca/?utm_source=instagram
https://app.autinerary.ca/?utm_source=linkedin
https://app.autinerary.ca/?utm_source=community-org
https://app.autinerary.ca/?utm_source=school
```

`utm_campaign` can name a post or partner (for example
`?utm_source=instagram&utm_campaign=adhd-month-reel`). Don't put anything
personal in either value. The ready-made links and posts, all using
`utm_campaign=beta-oct-2026`, are in [outreach.md](beta/outreach.md).

What participants will see, in order:

1. Start here, before any account: who they are here for, what they need
   today, then a few starter resources and "Save this path".
2. Setup in two questions (who you're here for, and one goal), starting with
   their Start here answers, with an optional "What are you looking for
   today?". Norms and the other extras are optional.
3. Starter resources picked from their answers, two optional questions about
   setup (how much they knew before signing up, how easy setup was), and an
   opt-in to a check-in by email, by a notification on their device, or both.
4. Optional questions they skipped come back on the Path, one group at a
   time: location first, sensory needs and conditions from day 7, the
   personal touches from day 10.
5. After five days of use, or on a return visit in the second week (and
   after the existing feedback form): "Is Autinerary useful to you so far?"
6. Anyone who comes back after two weeks away: "Welcome back, what got in the
   way?" Anyone who opted in and stays away two weeks gets the same question
   once, by email and/or notification, answerable without signing in.

## Measures

All from `python -m scripts.onboarding_funnel` (from `backend/`), which
splits each by who people are here for and by channel:

| Group 2 asked for | What we report | Where it comes from |
| --- | --- | --- |
| Goal completion | Share of new accounts that finish setup; task success in sessions | Funnel events; session notes |
| Clarity | Share answering "about right" to how much they knew before signing up | Post-setup survey |
| Perceived effort | Median setup ease (1 to 5); per-task ease in sessions | Post-setup survey; session notes |
| Drop-off | People reaching each setup step | Funnel events |
| Return | Share of new accounts back within 7 days | Funnel events |
| Usefulness (active users) | Very / somewhat / not yet | In-app check-in |
| Why people stop (inactive users) | Reasons, from the email and the welcome-back question | Check-ins |

Group 4's measures for Start here, from the same report:

| Group 4 asked for | What we report | Where it comes from |
| --- | --- | --- |
| Clarity: "explain what Autinerary is for after the first screen" | Share of participants whose description matches what it does | Session notes (first screen) |
| Completion: "select a role and goal, then reach a resource list" | Share of people who start Start here and reach a pathway | Start here events |
| Relevance: "users mark results as useful or save the path" | "Was this useful?" yes and not really, and saves, by need and by who for | Start here events; session task 1 |
| Confidence: "choose a next action" | Share of pathways followed by opening a resource or saving | Start here events; session task 1 |

Group 5's measures:

| Group 5 asked for | What we report | Where it comes from |
| --- | --- | --- |
| "Reduce drop-off by 40%+ (completion rate)" | Setup completion and drop-off for each onboarding version, and the change between the last two | Funnel events |
| "Track 7-14 day retention" | Share of new accounts back within 7 and within 14 days | Funnel events |
| "Monitor first-week satisfaction scores" | Usefulness answers given in the first two weeks after sign-up; setup ease | In-app check-in; post-setup survey |
| "Which features different user groups actually use" | Share of accounts that open each part of the app, by who they are here for | feature_use events (STEP 49) |

Group 7's measures: completion and drop-off by step (above), **time to
first action** (how long after sign-up people open their first step, and
mark one done), and whether people **answer questions asked later**
(shown, answered, closed, per group).

Group 8's measures, for ResourceHub: setup completion, **time from first
visit to the first place opened**, the **share of search results within the
radius** for people with a location, and whether each prompt that asks for
more is taken up (section "ResourceHub's first session").

Group 9's measures: completion and where people stop (above, and by
onboarding version), whether people reach and open their recommended
resources and path (Start here and first-step measures above), and, for the
freezing, the report's **Making the path** section: how many people got a
path, how many needed more than one try, how long it took, and why attempts
failed.

Group 10's six measures, and where each is in the report:

| Group 10 asked | What we report |
| --- | --- |
| Completion rate: "do more users finish initial onboarding?" | Setup completion, overall and by onboarding version |
| Time to first value: "how quickly do users reach a relevant path or resource?" | **Reached something useful**: share of accounts that opened a step of their path, a starter resource, ResourceHub or Tools, how long after sign-up, and how many did on the day they signed up |
| Drop-off points: "where do users pause, leave, or repeat steps?" | Setup steps reached; **where people pause** (median time on each step) and **what they come back to**; where people leave the app (above) |
| 7-14 day return | Back within 7 and 14 days, for Goal Planning and ResourceHub |
| Path engagement: "milestones or recommendations?" | First step opened and marked done; parts of the app opened |
| User feedback: "clear and manageable?" | Setup ease and clarity (post-setup survey), check-ins, session notes |

Group 6's measure: "where they click, leave, and whether they return". Clicks
are the parts of the app opened and the Start here resources opened;
returns are the 7 and 14 day returns above; **where they leave** is the
parts of the app people opened on their last day, for those away two weeks
or more (feature_use events).

Proposed targets, for the team to agree before the trial starts:

- at least 70% of new accounts finish setup
- at least 60% say they knew "about right" before signing up
- setup ease median of 4 or more
- at least 40% come back within 7 days
- at least 70% of people who start Start here reach a pathway, and at least
  half of pathways lead to a next action
- more people say starter resources were useful than not, for each need
- drop-off at least 40% lower in `twostep-2026-10` than in
  `goalfirst-2026-10`, once each has at least 5 accounts

Groups with fewer than 5 people are shown as "<5", with no percentages.
Browsers that send Do Not Track or Global Privacy Control are left out of the
funnel counts; survey and check-in answers, which people give on purpose, are
kept.

## After the trial (week of 10 November)

1. Run the report for the trial version (`twostep-2026-10`, the default) and
   export the session notes.
2. For each measure, compare user groups and channels; mark anything below
   target.
3. List the three most common reasons people stopped, with quotes.
4. Decide on two or three changes, and bump `ONBOARDING_VERSION` in
   `frontend/lib/funnel.ts` when they ship, so the next round compares
   cleanly against this one.

## Out of scope for this trial

- Training or tuning the AI on trial participants' data. Participants are
  not being asked for that consent, so their answers are used only for this
  analysis.
- Changes to the AI chat assistant.
- Under-18 users. They need a guardian-linked account, which is not part of
  this trial.
