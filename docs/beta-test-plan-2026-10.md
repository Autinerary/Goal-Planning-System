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
| Google sign-in (provider on in Supabase, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`) | Sign up with Google | Live; needs one real sign-in to confirm |
| Privacy page | What testers are told about their information | Live at /privacy |
| Apply STEP 47 (`backend/database/migrations/2026_push_subscriptions.sql`) | Notifications on a device (keys already set in Vercel) | To do |
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

ND or NT status comes from the sign-up screener, with consent, and stays in
the research spreadsheet under a participant code. It is never put into the
app, a tracked link or analytics: it is health information, and with groups
this small it would identify people.

## Part 1: moderated task sessions (weeks 1 and 2)

About 40 minutes, remote or in person, think-aloud, recorded only with
consent. The participant uses their own phone or computer. The facilitator
reads each task, does not help unless the participant is stuck for two
minutes, and notes success, time and where they hesitated.

| # | Task (as read to the participant) | Success means |
| --- | --- | --- |
| 1 | "Make an account and get to your plan." | Reaches the Path, with or without Google |
| 2 | "What is the first thing your plan suggests you do?" | Names the first milestone |
| 3 | "Find a service near you that could help with that." | Opens a relevant ResourceHub result |
| 4 | "Mark something as done." | Completes a milestone or task |
| 5 | "Make the app easier on your eyes." | Changes a display setting |
| 6 | "You want to stop the app sending you emails. Do that." | Finds the email setting |
| 7 | "Find a place you've been to, or would like to go, and rate it." | Submits a rating |

After each task, ask: "How easy or hard was that?" (1 very hard to 5 very
easy, the same scale as the in-app survey). At the end, ask: "What would you
use this for, if anything?" and "What nearly made you give up?"

Record per task: success (yes / with help / no), time, ease 1 to 5, and
quotes. Compare ND and NT participants, and the five groups above, on task
success and ease. The full wording, prompts and notes template are in
[session-script.md](beta/session-script.md).

Task 7 matters beyond the sessions: ResourceHub's norm and minimum-rating
filters only find places once people have rated them, and today the only
rated, approved place is Autinerary itself (the other ratings belong to
rejected seed entries). The outreach posts and trial emails should ask
testers to rate places they know, too.

## Part 2: the 30-day trial (12 October to 10 November)

Open to anyone 18+ who reaches the app through a tracked link. No
facilitator. The app collects everything below by itself.

Tracked links: add `?utm_source=<channel>` to the landing page address, one
value per channel, lower case, for example:

```
https://goal-planning-app.vercel.app/?utm_source=riipen
https://goal-planning-app.vercel.app/?utm_source=reddit
https://goal-planning-app.vercel.app/?utm_source=instagram
https://goal-planning-app.vercel.app/?utm_source=linkedin
https://goal-planning-app.vercel.app/?utm_source=community-org
https://goal-planning-app.vercel.app/?utm_source=school
```

`utm_campaign` can name a post or partner (for example
`?utm_source=instagram&utm_campaign=adhd-month-reel`). Don't put anything
personal in either value. The ready-made links and posts, all using
`utm_campaign=beta-oct-2026`, are in [outreach.md](beta/outreach.md).

What participants will see, in order:

1. Setup in three steps (who you're here for, one goal, and an optional
   question about norms), then an optional "What are you looking for today?"
2. Two optional questions after setup (how much they knew before signing up,
   how easy setup was), and an opt-in to a check-in by email, by a
   notification on their device, or both.
3. After five days of use (and after the existing feedback form): "Is
   Autinerary useful to you so far?"
4. Anyone who comes back after two weeks away: "Welcome back, what got in the
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

Proposed targets, for the team to agree before the trial starts:

- at least 70% of new accounts finish setup
- at least 60% say they knew "about right" before signing up
- setup ease median of 4 or more
- at least 40% come back within 7 days

Groups with fewer than 5 people are shown as "<5", with no percentages.
Browsers that send Do Not Track or Global Privacy Control are left out of the
funnel counts; survey and check-in answers, which people give on purpose, are
kept.

## After the trial (week of 10 November)

1. Run the report for the trial version (`goalfirst-2026-10`) and export the
   session notes.
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
