# The Calendar round (October 2026)

The team's notes for Screen 4, the Calendar View, are all Odosa's. They cover three things:

1. The Day, Week and Month toggle.
2. The weather: Grey Day and Sunny Day, rain days coming, and energy that follows the weather.
3. A new Analysis tab.

This page says what was built for each note, how it was tested, and what needs someone on the team. Written 20 October 2026.

**There's no database change.** What's new is kept in each person's preferences, which are already saved with their account. The forecast setting is kept on each device.

## What needs someone on the team

| What | Why |
| --- | --- |
| Decide on the weather data before paid plans or sponsored listings go on | The forecast comes from Open-Meteo's free API, which its terms allow "only... for non-commercial purposes". Their examples of commercial use are "websites or apps that have subscriptions or display advertisements". Paid plans and sponsored listings are off today. When either goes on, Autinerary needs Open-Meteo's paid plan, or a source that allows commercial use (MET Norway, or Environment and Climate Change Canada). The forecast was already in the app before this round |

## Day, Week and Month

| Note | Now |
| --- | --- |
| "The toggle under Low Energy/Balanced/High options for 'Day/Week/Month' is where it should be, but only the 'Week' & 'Month' buttons beside the 'Time Blocks' & 'List View' buttons are working; remove those 2 buttons & make sure the toggle at the bottom for Day, Week & Month all works as expected" | The Week and Month buttons are gone. The toggle stays where it was, under the energy options, and now chooses real dates for both List View and Time Blocks (details below). Old links to `?view=week` and `?view=month` open those periods |

Before, the toggle only reshaped the plan's weekly pattern: Day showed today's weekday, and Month said "Day-by-date scheduling is coming soon". Now:

- **Day:** one date. In List View, a card with its tasks, its weather and its theme. In Time Blocks, a time grid for that day.
- **Week:** Monday to Sunday, seven cards or the week's time grid.
- **Month:** the month grid. Choosing a date opens that Day.
- **Moving through dates:** each period has Previous, Today and Next.

Along the way:

- **Weeks start on Monday,** as everywhere else in the app. The week and month grids started on Sunday, so a week's Sunday belonged to the week before for ticking.
- **Ticking plan tasks.** Plan tasks repeat every week, and a tick counts for the week it was made in. They tick in their own week; other weeks show what was done without changing it. Your own tasks tick on any date.
- **The time grid.** A short task is at least 24 px tall, and short tasks sit side by side instead of covering each other.

## The weather

| Note | Now |
| --- | --- |
| "For the Weather API that matches to someone's location if allowed" | The local forecast is the one the app already had (Open-Meteo, with the browser's location and permission). It's off until someone turns it on, and says what it shares. It now tells the kind of day apart: sunny, cloudy, rain, snow or fog, not only the chance of rain. The location is rounded to about 10 km before it's sent; it used to be sent exactly. It's kept on the device. Open-Meteo is credited in the weather settings, as its CC BY 4.0 licence asks |
| "Add a final layer of options for 'Grey Day' & 'Sunny Day', under the energy buttons" | **"What kind of day is today? ☀️ Sunny Day / ☁️ Grey Day"**, the last layer under the energy buttons. The forecast marks the one it suggests, and nothing changes until you choose. What a chosen day changes is listed below the table |
| "Add an option to tell when a rain day is coming & offer to switch day to that's theme" | **"Tell me when a rain day is coming"** is in the weather settings, on unless turned off. When the forecast has rain in the next week, it says so: "Rain on Thursday 22 October (rain, 85% chance)", and whether more rain days follow. It offers **"Make Thursday a Grey Day"**, with Undo. If you prefer sunny days for your own tasks, it also offers to move your own Thursday tasks to the driest day |
| "Add an option in the customization of animals & themes to automatically match the energy level to weather" | **Customize animals and themes, then Weather: "Match each day's energy to the weather"** (also in Settings, where the same section is). Details below the table |

**What a chosen Sunny Day or Grey Day changes:**

- the Calendar's colours, and that date's card;
- one of the ideas for your week ("Take one task outside" on a sunny day, "Make a cosy spot for one task" on a grey one);
- for today, the sky behind the whole app: bright, or cloudy and grey. A night or dusk sky is left as it is.

**What "Match each day's energy to the weather" does:**

- **Today's energy level:** a sunny day is High Energy, a grey one Balanced, and rain or snow Low Energy.
- **It says so:** "High Energy, matched to today's weather (sunny)". An energy level you choose yourself always wins for the day.
- **Spirit animals:** with two of them (fast and slow days), the fast one shows on sunny days and the slow one on rainy days.
- **It needs the forecast on.**

**The old rain banner is gone.** It sat on every day in the old views. It was replaced by the one rain alert above.

Its "Auto-move undated added tasks" option went with it. It moved people's own tasks to another day by itself whenever the Calendar opened; it's now an offer you press.

## Analysis

| Note | Now |
| --- | --- |
| "Add an 'Analysis' tab. When clicked, you get the option to show your daily, weekly & monthly patterns, as well as your best day(s)" | **📊 Analysis** beside List View and Time Blocks, with four options |

The four options:

- **Daily patterns:** when in the day you get the most done, by part of the day and by hour ("around 9 am").
- **Weekly patterns:** which weekdays. Each is averaged over how many of that weekday there have been, so one busy Tuesday doesn't make every Tuesday look best. Also the energy level you chose on each weekday.
- **Monthly patterns:** the weeks of the month (1st to 7th, and so on) and the last six months.
- **Best days:** your best day or days, your best time, your best day so far, and how many of the last 30 days had something done.

**What counts:**

- plan tasks you tick (in the Calendar, the Task tab or a task's page);
- your own tasks done;
- milestones finished.

A tick on a plan task used to keep only its week. From 20 October 2026 it also keeps its day and hour; unticking takes that hour back. The energy level you choose each day is kept too. Both are kept for six months, and only you see them.

With fewer than five things done, Analysis says there isn't enough yet and what will fill it.

## Also in this round

- **Capture this moment** (Hare World Social). On production, a photo chosen before the dialog knew who was signed in was dropped without a word. The dialog now looks that up itself.
- **Help.** The Calendar's page guide, the glossary (Sunny Day, Grey Day and the forecast; Analysis) and Privacy (the rounded location; the day and hour of ticks; energy levels) say what's new.
- **Accessibility.**
  - The energy buttons, views, periods and weather choices say which is chosen.
  - The chosen energy buttons are darker under their white text.
  - The month and time grids' faint text is darker.
  - Blocks are at least 24 px.

## How it was tested

- **Library tests:** `lib/weather.test.mjs` (the kinds of day, from Open-Meteo's real answer, and the rounding), `lib/dayTheme.test.mjs`, `lib/patterns.test.mjs` (the patterns, ties, and ticking hours), `lib/gamification.test.mjs`, and the existing ones (page guides, glossary).
- **`.qa-local/browser/plan21.mjs`:** QA A on the local app, with Open-Meteo answered by a fixed week and the location faked. **64 of 64 passed.** It covers:
  - the views, and Day, Week and Month in both views;
  - moving through dates;
  - ticking plan tasks, and their hours;
  - old links;
  - the layer, the forecast and the location sent;
  - the rain alert and Undo;
  - today's theme, the Calendar's colours and the sky;
  - energy matched to the weather, and your own choice winning;
  - Analysis with three weeks of data, and each option;
  - axe on each view, and phone width on every view and period.

  It puts QA A's preferences back.
- **The earlier suites (`run_all_local.sh`) and the accessibility checker on every page.** The checker found no serious or critical problems. Fifteen of the 17 suites passed in full. Two failed, each because the suite still expected something that changed on purpose:
  - **g31 (1 of 43):** it pressed the Week and Month buttons, which are gone. It now switches between the views that remain: 43/43.
  - **g34 (1 of 57):** it recognised the chosen energy by its old colour. It now reads the button's pressed state: 57/57.
- **The later suites:**
  - **plan15:** 37/37.
  - **plan14:** 65/68. The 3 are the help chat, which needs an OpenAI key the local app doesn't have.
  - **plan18 (62/65):** with STEP 87 live, finishing a milestone opens "Capture this moment" before the help prompt. It now closes that first: 65/65.
  - **plan20 (119/120):** the two-person suite, now with STEP 87, photo and all. Its one failure looked for "From past you", which the page shows in capitals: 120/120, nothing left over.
