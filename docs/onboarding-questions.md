# Which questions are asked when

Riipen Labs' Group 7 asked the team to "identify which onboarding questions
are essential and which can be delayed", then to "personalize
progressively". Groups 2, 5 and 6 asked for the same, so this is how
Autinerary works now (October 2026). Every setup step shows one line on
what its answer is used for (`STEP_PURPOSE` in
`frontend/app/onboarding/page.tsx`).

## Before an account: nothing

Start here asks two questions (who for, what you need) and shows starter
resources with no account. Its answers carry into setup, so nobody is asked
twice.

Riipen Labs Group 10 asked for every question to be marked "essential now,
useful later, or optional". That is how they are grouped below.

## Essential now: asked before the path is made

| Question | Why it can't wait |
| --- | --- |
| Name, email, password (or Google) | The account |
| Date of birth | Accounts are for adults 18 and over |
| Who are you here for? (with "Not sure yet") | The wording of the next questions, and the starter resources after setup |
| One goal | The path is built from it |

## Useful later: they sharpen what is shown, so they come back

| Question | What it improves | When it comes back |
| --- | --- | --- |
| What are you looking for today? | What the page after setup shows first | Not needed again: Start here and Quick Links cover it |
| Location | Services near you in ResourceHub | On the Path from the first day; in ResourceHub on its home page, in search and at the end of its setup |
| Norms, conditions and sensory needs | Tools, services and people matched to you | On the Path from day 7 (the condition and support profile), in the rating form, and in ResourceHub when you search for one |
| How much each norm affects daily life | Weighs recommendations, and groups ratings by level | On the ResourceHub profile, optional and in words; never in setup |
| Motivation style | Matching with people motivated in similar ways | Only in setup for now; a good next question to ask in context |

## Optional: how the app looks and feels

| Question | What it changes | When it comes back |
| --- | --- | --- |
| Character, spirit animals, how the app looks | Dream Land and the look of the app | On the Path from day 10 |
| Biggest dream | Sent with your goal when the path is made | One line on the goal step, opened only if wanted |
| Dream Self | The Ideal Self page | On the Ideal Self page; not prompted |

The Path shows one of these at a time, and only when no check-in is due.
From the second day it may instead offer the fuller view ("Ready for a bit
more?"). Nothing changes by itself.

## Feedback, after people have used it

- Two optional questions on the page after setup: how much they knew
  before signing up, and how easy setup was.
- The team's feedback form: only for people who finished setup and came
  back on a later day. Until 5 October 2026 it could reach a visitor on a
  second visit to the home page, before they had an account.
- "Is Autinerary useful so far?": after five days of use, or on a return
  visit in the second week. An answer of "Not yet", or a reason for
  stopping, is met with something that can change now: a different goal,
  starter resources, or just the next step in the simple view (Group 10:
  check-ins that "adjust path with feedback"; `ADJUSTMENTS` in
  `frontend/lib/checkin.ts`).

## ResourceHub

ResourceHub's own setup, for people who sign up there, asks three things:
who you are, one topic and what you hope to find. Location, identity, health
and more topics are asked later, where they are used. See
[resourcehub-first-session.md](resourcehub-first-session.md) (Group 8).

## Less at once

Riipen Labs Group 9 found setup showed too much at once. The goal step, which
everyone completes, now opens only the category picked (and any that already
hold a goal), with its field ready; it used to show all six, each with its own
ideas and fields, and the optional "biggest dream" box is one line until asked
for. The optional norms list (about 80 options in nine groups) opens one group
at a time, with what is picked shown above the groups; it used to show every
group at once, repeated for each connection picked.

## Help with the goal, and a break

Riipen Labs' Group 11 found the goal the hardest question in setup. Besides
the ideas in each category, the goal step offers an optional AI helper:
describe what you want in your own words, and it suggests goals from the same
ideas, or one in your words. Nothing is added until you pick one. Setup also
says that answers are saved on the device as you go, welcomes people back
where they left off, and offers one reminder email to finish. See
[first-visit-to-return.md](first-visit-to-return.md).

## Testing the assumption

Group 7: "Assumption to test, not assume: users will actually engage ...
later if not asked upfront." The funnel report (`python -m
scripts.onboarding_funnel`, from `backend/`) shows, for each group of
questions asked later, how many people saw it, answered it, or closed it
(`ask_later` events, STEP 50). If few answer, ask the question where it
matters instead (for example, location only when someone looks for places
near them), or bring it back into setup.
