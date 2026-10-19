# Gamification review (October 2026)

Odosa asked for a "gamification review": how fun is each part of the app,
and where are people dropping off the most? This page answers both from
what the app records, and says what each game-like part really does today.
Written 19 October 2026.

**The numbers are small.** They come from 4 to 19 October:
- 95 people visited the landing page;
- 13 accounts opened the app;
- groups under 5 people are hidden.

They show where to look, not proof. The source is
`backend/scripts/onboarding_funnel.py`, run read-only against production.

## Where people drop off

| Step | People | Of the step before |
| --- | --- | --- |
| Visited the landing page | 95 | |
| Opened the sign-up form | 21 | 22% |
| Made an account | 2 | 10% |
| Finished setup | 3 (one began before this window) | |
| Opened their first step | 0 | |
| Marked a first step done | 0 | |

- **The biggest drop is before anyone signs up:** 75% left after the first
  page they saw.
- **Of those who opened the sign-up form, about 1 in 10 made an account.**
- **Inside the app, nobody has opened a first step yet:** people finish
  setup and look around, but don't get to doing something.
- **ResourceHub:** 137 first visits; about 1% came back within a week.
- **The tour:** 11 started it, none finished it, 2 closed it early.
- **"Complete your profile":** shown twice, answered by no one.

## How much each part is used

The share of the 13 accounts that opened each part at least once:

| Part | Opened by | Game-like? |
| --- | --- | --- |
| Path | 100% | The race track and streak live here |
| Calendar | 38% | |
| Settings | 38% | Spirit animals and themes are set here |
| Races | 31% | Yes: lanes, coins, the Pit Stop shop |
| Tidbits | 23% | Yes, since 19 October: Bites and Well-Dones |
| ResourceHub | 23% | |
| Milestones | 15% | |
| Pit Stop | 15% | Yes: "shop" items with coin prices |
| Journal | 15% | |
| Hare World | 15% | |
| Dream Self | 8% | Yes: the character and Dream Self |
| Life Stats | 8% | Yes: stats with "XP" |
| Tools, Assistant, Family, Starter kits | 0% | |

## How fun each part is, and what it really does

| Part | What it does now | Verdict |
| --- | --- | --- |
| **Races** (lanes, the track, your character) | Real: finished steps move you along (race_progress). | The core loop, and the most used game part. Fun only once a step is finished, and nobody has finished one yet. |
| **Coins and the Pit Stop shop** | **Not real.** Prices like "5 coins" are display text; coins can't be earned or spent. | Confusing: a currency that does nothing. Make it real or take it out. |
| **Streaks** (the badge and celebrations) | Real, but **kept on one device only** (localStorage): a new phone starts at zero. | Good idea, fragile. Save it to the account. |
| **Spirit animals and themes** | Real and saved: a guide for the day on the Path. | Cosmetic. Pleasant for some, "disrespectful during crises" for caregivers (Group 24), so it isn't suggested to them. Fixed this round: one, two or seven, with the right labels. |
| **Level map** (/gamification) | **Not real:** hard-coded levels, no data. | Misleading if anyone finds it. Hide it or connect it. |
| **Life Stats ("XP")** | Real: mood and check-ins become four stats. | Rarely opened (8%). |
| **Character and Dream Self** | Real: the look editors (AI pictures are gone this round). | Rarely opened (8%); kept for later days on purpose. |
| **Bites and Well-Dones** (Tidbits) | Real, from 19 October: reading to the end and rating, with a small animation and an optional sound. | Too new to judge. |
| **The tour's "try it" tasks** | Real. | Nobody finished. Too long at the start, or in the way. |

## What would make it more fun, in order

1. **Get people to their first step.** Every game part pays off only after
   a step is done, and nobody is getting there. Open the first step right
   after setup, instead of the Path overview.
2. **Make one loop real, end to end.** Finish a step: the race moves, the
   streak grows, a short celebration, and something earned. Either give
   coins a use (spirit animal colours, themes, a Pit Stop item for the
   character) or remove them.
3. **Save streaks to the account**, so they survive a new device.
4. **Hide the level map** until it shows real progress.
5. **Shorten the tour** to two tasks, or offer it as "Show me around" later.
   Info Mode now covers "what is this?" at the moment people wonder.
6. **Ask, lightly.** The funnel says what people open, not whether they
   enjoy it. A one-tap "Was this fun?" after a celebration would say more
   than any count.

None of these is built: they change how the app feels, which is the team's
call. The numbers will mean more with more people; run
`./venv/bin/python -m scripts.onboarding_funnel --version all` from
`backend/` again in a few weeks.
