# Which questions are asked when

Every question Autinerary asks, sorted the way Riipen Labs' Group 23 asked
(September 2026): **essential for first use**, **helpful later**, or
**optional**. Groups 2, 5, 6, 7 and 10 asked for the same audit; this is how
it stands on 12 October 2026 (onboarding version `paced-2026-10`). Every
question in setup says why it is asked (`WHY_WE_ASK` in
`frontend/app/onboarding/page.tsx`), and every one on the "Complete your
profile" card says what it unlocks (`frontend/lib/profileItems.ts`).

## Before an account: nothing

Start here asks two questions (who for, what you need today) and shows
starter resources with no account, then offers three more, optional ones
(where you are, how soon, how you like to start). The starter kits for
parents need no account either. Start here's answers carry into setup, so
nobody is asked twice.

## Essential for first use: asked before the plan is made

| Question | Why it can't wait |
| --- | --- |
| Name, email, password (or Google) | The account |
| Date of birth | Accounts are for adults 18 and over; setup does not ask the age again |
| Who are you here for? (with "Not sure yet") | Whose plan it is: a parent's plan is about supporting their child. Also what comes first afterwards, and the kits for parents |
| One goal | The plan is built from it. Setup starts with one life area, from the answers or Education, and "Choose a different area" shows the rest |

## Helpful later: they sharpen what is shown

| Question | Where it is asked | What it improves |
| --- | --- | --- |
| How much energy do you have for this today? | Setup, first step, optional | How much setup asks today: "Not much" stops at the plan; "Plenty" offers the questions below straight away |
| What are you looking for today? (parents also: an assessment, support at school; everyone: help right now) | Setup, first step, optional | What the page after setup shows first; who to call at once for "Help right now" |
| Your city | "Complete your profile", from the first day; ResourceHub | Services near you, nearest first |
| Reminders for your first two weeks | The card, from the day after joining (Group 15: no notification asks before a first useful action); Settings, under Emails | Three emails about what you did, on days 1, 7 and 14 (Group 15), or one email a day about the next step; both stop by themselves |
| What motivates you | The card, from the first day | Matching with people motivated in similar ways |
| Your norms and support needs | The card from day 7; `/profile/diagnostic`; ResourceHub | Tools and services that fit, and ratings from people with similar norms. Private |
| Where are you? How soon? How do you like to start? | Start here, after the starter resources, optional | The order of the resources, the kits, who to call |

## Optional: how the app looks and feels

| Question | Where it is asked | What it changes |
| --- | --- | --- |
| How the app looks (light or dark, contrast, calm motion, text size, liveliness, Simplified or Full View) | Display, on every page before an account, in setup and on the Path; the card | The app's look, at once |
| Your character and Dream Self | The card, from day 10 or as soon as the first step is done (Group 23's rewards); not suggested to parents | Puts you on your race track |
| Your spirit animals | The same | A guide for the day on your Path |
| What you hope a goal leads to, and what might get in the way | Setup's goal, folded under "+ Add more about this goal" (plain questions since Group 17 found "dream for the other person" and "ideal relationship with ally" unclear) | Sent with the goal when the plan is made |
| Your biggest dream, beyond any one goal | The Ideal Self page (it left setup: Group 17, "front loads personal questions ... before trust is established") | Sent with the next plan you make |
| Words we use: identity-first or person-first | Settings (Group 15) | How your plan and the assistant write about autism and ADHD |

The Path shows one of these at a time, and only when no check-in is due.
"See all" and Your profile list every one. Nothing changes by itself.

## Feedback, after people have used it

- Optional questions on the page after setup (not shown after "Not much"
  energy): whether they know what to do next shows; four more are folded
  under it (Group 18: a long survey before any use of the app): whether
  making the account was clear and quick, how much they knew before signing
  up, how easy setup was, and where they heard about Autinerary, with the
  group, school or event's name when one pointed them here (Group 15).
- "Two weeks in: is Autinerary useful so far?": in the day-14 email, for
  people who asked for the first two weeks' emails.
- The team's feedback form: only for people who finished setup and came
  back on a later day.
- "Is Autinerary useful so far?": after five days of use, or on a return
  visit in the second week. An answer of "Not yet" is met with something that
  can change now (`ADJUSTMENTS` in `frontend/lib/checkin.ts`).

## ResourceHub

ResourceHub's own setup, for people who sign up there, asks three things:
who you are, one topic and what you hope to find. Location, identity, health
and more topics are asked later, where they are used. See
[resourcehub-first-session.md](resourcehub-first-session.md) (Group 8).

## Testing the assumption

Group 7: "Assumption to test, not assume: users will actually engage ...
later if not asked upfront." The funnel report (`python -m
scripts.onboarding_funnel`, from `backend/`) shows, for each question on the
card, how many people saw and answered it (`ask_later` events), and since
Groups 20 to 24, setup completion and time by energy answer, and Start
here's optional questions by answer. If few answer one, ask it where it
matters instead, or bring it back into setup.
