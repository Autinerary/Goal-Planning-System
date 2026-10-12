# Riipen Labs Groups 31, 32 and 33, September 2026

Three Riipen Labs reports from 25 September 2026:

- **Group 31**, "Selected Customer Experience Brief: Onboarding & First-Time
  Experience": too much on the first screen, no clear first step, menus
  inside menus, and accessibility to WCAG and the Government of Canada's
  guidance for people on the autism spectrum.
- **Group 32**, navigation and accessibility: two ways to the same places,
  accessibility settings that fail on some pages, a crowded Races page, the
  back button, and role-based progressive disclosure with a co-design panel.
- **Group 33**, "Final report": a "Skip Onboarding" option, buttons that
  look like buttons, larger tap targets on phones, and a tour that shows
  where things are.

This page says what Autinerary does for each point as of 11 October 2026,
what changed because of it, and what is for the team. Several points
overlap with Groups 34 to 36 ([groups-34-36.md](groups-34-36.md)), which
were done first.

## Group 31

### What they found (slides 2, 7, 9 and 15)

| They found | What it was | Now |
| --- | --- | --- |
| "Homepage has too much information and too many dropdowns" | The Path had six dropdown menus above its title (Stuck?, People, Fun, Mentors, Friends, Tools; Group 34's mockup), Quick Links below them, and even in the simple view a quote and two dashboard cards | One way to places: **Quick Links**, right after your next step. The six menus are one list under it, **All places**, one level deep. The simple view is your next step, four Quick Links and one card |
| No clear "Step 1" | "Your next step" has been the first card since Group 7, but only once there is a plan | Without a plan the first card is **Make your plan**: two questions, about two minutes |
| "Dropdowns in the app that lead to another dropdown" | The six menus, each opening a list | All places lists every place directly, grouped under the same six headings |
| The back button "reloads their last action" instead of going back | Three causes. The app's redirects (to sign-in, to setup, from `/login` to the Path) added themselves to the history, so Back landed on a page that redirected again: a loop. Each Calendar view change (list, week, month, a day) was a new history entry. And the Back button went back whenever the tab had any history, even another website | Redirects replace the page in the history instead of adding to it. A Calendar view is part of the page, not a new one. Back buttons go to the previous page in the app (`frontend/lib/navTrail.ts`), or to the Path when there isn't one, for example when opened from an email |
| The Journal is on the homepage and in Pit Stop; Pit Stop "only leads to more options that are already displayed" | The second Journal button was a journal about your people (in Hare World, then part of Pit Stop), labelled just "Journal". Pit Stop's tools page had three ways to ResourceHub, one of which removed Pit Stop from the history | It's **Journal about your people**, saying what it is. The third ResourceHub card is gone; "Browse resources by life area" and Find resources in the top bar remain |
| "The simplify option on the app does not simplify the layout, only the top area of the app" | Simplify hid a few cards, not the long ones | The simple Path is above. The simple Races page leaves out the ResourceHub and Hare World cards (both are Quick Links) |
| "Most of the app remains empty and meaningless until onboarding is completed" | Before setup was done the top bar was hidden, and pages said "Complete onboarding" | Group 33's **Skip for now**, below. Without a plan the top bar is there, and Races, Milestones and the Calendar say what will be there, the one step that fills them, and what works without a plan (services, Tidbits, Hare World, the glossary) |
| Different user groups need different starting points | Setup asks "Who are you here for?" (Groups 3 to 5), and Start here offers a first pathway for each answer (Group 4). After setup only one card on the Path used it | Quick Links come in the order that suits the answer (`frontend/lib/places.ts`): a parent sees services for their child and Family first; a teacher or support worker, services to share and questions to answer; an ally, Tidbits and the glossary |

### Their recommendations (slides 10 to 15)

| They recommended | Now |
| --- | --- |
| Fewer dropdowns, less clutter (option 1, their choice) | Above |
| More guidance on where to start (option 2) | Your next step, or Make your plan; the tour now points at things (Group 33, below) |
| An AI chatbot (option 3) | The assistant already exists (`/assistant`; "Ask the assistant" in All places, under Stuck?) |
| Accessibility to WCAG and the Government of Canada's guidance | Group 32's points below; the accessibility checker runs WCAG 2.1 A and AA and WCAG 2.2's target size on every page |
| Ask users, and keep collecting feedback after release | The beta sessions ([beta-test-plan-2026-10.md](beta-test-plan-2026-10.md)); in the app, the check-in questions and the questions after setup. The glossary now says the app is in beta and how to tell us (Group 32, below) |

## Group 32

### What they found (slides 7 and 8)

| They found | What it was | Now |
| --- | --- | --- |
| Quick Links and the secondary navigation compete | The six menus and Quick Links (above), and the plan's tabs (Path, Races, Milestones, Calendar, Task) looked like more of the same | One way to places (above). The plan's tabs are captioned **Your plan** |
| No clear difference between the primary menu (Find Resources, Settings, Help) and the secondary navigation | On a phone the top bar was icons only | The top bar shows each control's name on a phone too (Profile, Resources, Guide, Alerts, Help, Settings, Sign out), in one row; the plan's tabs sit apart under "Your plan" |
| Night Mode turns "Your Goals, Dreams & Obstacles" unreadable | Races' own night colours (the moon button): the goal names had no colour of their own, so dark text sat on the dark card, and the links were dark cyan | Every part of the card has night colours (the goal names measure 16:1). The moon button is named **Night colours** and says whether it is on |
| Large Font fails in ResourceHub and Hare World | 164 text sizes were set in pixels, which Large text can't change (some Races labels were 7 pixels). And ResourceHub is another site, so it never saw the app's settings | Every size is in rem, the same size normally, larger with Large text. ResourceHub gets the settings with its hand-off link and keeps them (`servicehub-mvp/lib/a11y.ts`): Large text, high contrast, dark mode, the dyslexia-friendly font, underlined links and less motion. Turning one off in the app reaches ResourceHub too |
| High Contrast fails in the secondary navigation ("dark blue text within an indigo bubble") | The high contrast rule made every link dark blue, including the tabs drawn as white-on-indigo buttons | A link drawn as a button keeps its colours (the current tab measures 6.3:1). Grey text and pale borders get darker, as high contrast should |
| Races is "overloaded with static goal content in comparison to Milestones" | Races opened with the goals, dreams and obstacles card, stats, and ResourceHub and Hare World cards before the race | The goals card is folded, under "What your races were made from". The simple view leaves out the ResourceHub and Hare World cards; the full view keeps them, as an earlier tester asked |
| Path Market, Pit Stop, Tidbits and Journal need scrolling to reach | Quick Links moved to the top in October (Group 34), without Path Market | Path Market is a Quick Link |
| Broken back-button loops | Group 31's point above | Fixed above |

### Their recommendation (slides 10 to 15)

| They recommended | Now |
| --- | --- |
| Role-based onboarding and progressive disclosure (option 2, their choice) | Setup's first question is the role, with a "Not sure yet" (since Groups 3 to 5). Quick Links now follow it (above). The app starts in the simple view and opens up with "Show more" |
| Fix contrast, font sizes, and move hidden pages into the top navigation (option 1) | Above; the pages are Quick Links rather than more top-bar items, which their other points warn against |
| A co-design panel with neurodivergent people, parents, siblings and professionals (option 3, their final recommendation) | For the team: the beta sessions are the start ([beta-test-plan-2026-10.md](beta-test-plan-2026-10.md)); an ongoing panel is a team decision |
| People should know their feedback shapes the app | The glossary (`/help`) has **It's in beta: what you tell us changes it**, with recent changes and how to tell us |
| Dual labelling, clear section headers | The top bar's labels; every Quick Link has a line saying what it is |

## Group 33

### What they found and recommended (slides 2, 7, 12 and 15)

| They said | What it was | Now |
| --- | --- | --- |
| Add a clear "Skip Onboarding" option | Setup could not be left: every page sent an unfinished account back to it | **Skip for now** on setup's first screen, after the age question (the app is for adults). The app then works without a plan, and the Path offers to make one. The choice is saved on the account (`setup_skipped`), and the funnel report counts skips and how many made a plan later |
| Clickable options blend into static text | On setup's first screen the "How setup works" box was tinted and bordered like the chosen answers | It is a note (a line down its side, no box), and the answers look like buttons: a darker border and a shadow |
| Clutter and small tap targets on phones | 509 controls on 17 pages were under 44 pixels at phone width, 76 under 24 | On touch screens every button, tab, menu, field and link drawn as a button is at least 44 pixels in both apps, and a button drawn as underlined text gets the same reach without moving the text. The Path has no control under 44 pixels |
| Consolidate setup into a single screen | The required part has been two short screens since Group 5 ("Two quick questions, then your path is ready"), with everything else optional and skippable in one go | Kept as two: the goal step has its own helper. Skip for now covers leaving setup altogether |
| Standardize button sizing across desktop and mobile | | The touch rule above; desktop is unchanged |
| The tour explains what things do rather than showing where they are | The tour's cards described each page | **Show me** beside each item rings the real control on the page and dims the rest, with what it does beside it; "Back to the tour" or Escape returns |
| Track onboarding completion and time to first action | Already in the funnel report (`backend/scripts/onboarding_funnel.py`, Groups 3, 7 and 10): completion by step, time to the first step opened and done, time to first value | Also the skips, above |
| Cross-device walkthrough testing with a targeted population | | The beta sessions |
| Subway posters and social media (appendix) | Out of scope, as they said | For the team |

## How it was checked

- Quick Links per role (`frontend/lib/places.test.mjs`), the funnel report's
  tests (64) and the planning service's tests (280).
- A browser test of the local build at phone width, with the live database
  (43 checks): Back from the Path after `/login` returns to the page before;
  a Calendar view change leaves the Calendar one page; Back on a page opened
  on its own goes to the Path; no dropdown menus, four Quick Links in the
  simple view and eight in the full view, with Path Market; All places'
  groups; a parent's order; the labelled top bar in one row and "Your plan";
  high contrast on the current tab; Large text reaching every label on
  Races, Life Stats and Path Market; Races at night; the simple Races and
  Path; every control on the Path at least 44 pixels; the tour's Show me,
  its focus and Escape; Pit Stop, Hare World and the glossary; ResourceHub
  following the app's settings and dropping them again; and Skip for now
  with a throwaway account (setup until the age is given, then the Path
  offering a plan, the top bar, Races and Hare World without a plan, the
  choice saved, Make my plan back to setup), deleted afterwards with the
  app's own account deletion.
- Every earlier browser test, rerun on the same build (56, 75, 18, 21, 10,
  6, 42, 27 and 11 checks; two needed updating: Group 34's menus are now
  All places, and the simple Path has no quote), and the accessibility
  checker on every page of both apps, signed in: no serious or critical
  problems.
