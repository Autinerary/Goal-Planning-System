# The Race, Milestone and Path Market round (October 2026)

The team's notes for this round (Odosa, Liam) covered three screens:

- **the Race view** (Track and List views);
- **the Milestone view** (Screen 3);
- **the Path Market**.

This page says what was built for each note, what needs someone on the team,
and the decisions made where a note left room. Written 19 October 2026.

The database change is **STEP 85**
(`backend/database/migrations/2026_path_market_models.sql`, at the end of
`setup/all_migrations.sql`).

- It was tested locally, twice over on the whole schema: 19 checks,
  `.qa-local/pgtest/step85_test.py`.
- It is **not pasted yet**. Until it is, the Path Market already shows the
  new filters and the new name: the app uses the same mapping STEP 85 sets.
  What waits for the paste is Model Jet's new place and labels, and saving
  labels, races and people with a model someone shares.

## What needs someone on the team

| What | Where | Why it waits |
| --- | --- | --- |
| Paste STEP 85 | [2026_path_market_models.sql](../backend/database/migrations/2026_path_market_models.sql) | Migrations are pasted by the team |
| Approve Model Jet when its content is ready | The Path Market review (an admin; nobody is one yet, see the All Apps round) | It is Odosa's draft: it stays "Waiting for review" until she says it's ready |
| Check the life categories each specialised category is under | The table in "Path Market" below; change it in `path_categories.life_areas` | Only three were given in the notes; the rest are a first guess |
| Model Madhu, and other named models | "Share your path model" in the Path Market | Their races and steps have to come from the people who walked them |

## The Milestone view (Screen 3)

| Note | Now |
| --- | --- |
| "Negatives - What NOT to do should be highlighted as much. Have a 'Top 5 mistakes made at this stage'" | A red **Top 5 mistakes made at this stage** box, as large as the tools, on the Milestone view and on each milestone's own page |
| "Make sure these match the 'avoidance' steps in the Race View for each milestone" | Both read the same list, kept with the plan (below) |
| "Change title of 'Tools to Use' to 'Recommended Tools to use'" | Done |
| "The 'open' should open to the resource in ResourceHub ... renamed 'View in ResourceHub'" | **View in ResourceHub** opens the listing's page there (signed in), in a new tab; a tool that isn't a ResourceHub listing opens a ResourceHub search for it |
| Bug: Wishlist and Currently Using swap instead of clearing | Clicking the chosen one again clears it. It used to fall back to the status saved when the page loaded |
| Bug: rating one tool rates all of them | Each tool has its own rating. Ratings were kept per norm, and most tools shared one |
| Add "Used"; only then show "How well did it help" | **Wishlist / Currently Using / Used**; the rating appears only for Used. Used is ResourceHub's "Completed" list, and it lets ResourceHub take the rating (`can_rate()`, STEP 79) |
| A button at the bottom: "View these resources & more in ResourceHub" | Done: a ResourceHub search for what the milestone is about |
| Remove a resource | **Remove**, with **Undo**. Kept with the plan, so it's the same on every device |
| Recommend more, up to 5; then "max resources for this milestone reached" | **Recommend more** adds the next best listing (the plan's own sixth first, then ResourceHub's, free first). At 5 it says **Max resources for this milestone reached**, and the server refuses a sixth |
| Each resource's labels from ResourceHub | Under each tool: its kind (Service, Product, Commentary), its type within that ("Education Support", "Doctor"), its ResourceHub tags, free or paid, the ages it serves, and the norms people rated it for |

More changes on this screen:

- **It is about one milestone now:** the one you're on, with "Show another
  milestone". Before, it mixed eight tools from every milestone.
- **The made-up "Norms Unlocked" table is gone** from each milestone's page.
  It gave every service "Access, Support" and every product "Focus, Routine".
  The real labels replace it.
- **"Categories addressed"** now counts only the norms a used, rated tool
  actually helped with (from its "What this helps with").
- **Older plans** no longer show Autinerary's own listing as a tool; the
  agent already left it out of new plans.

### Where the five mistakes come from

The lists are written once per plan and kept in it
(`backend/core/milestone_guidance.py`, `POST /api/paths/me/guidance`).

- **For each step:** five things to avoid, and up to five that help.
- **Written by AI** from the step, its goal and the person's norms and
  obstacles, when AI is on.
- **Without AI:** general advice for that kind of step, after what the
  person told us (the obstacles they named, and what didn't work for them
  before).
- **Each list says which it is**, and that it is not counted from people.
- **Real counts too:** once 5 people have reflected at a stage, what
  actually tripped them up shows under it, with percentages
  (CommonMistakes, as before).
- **Never:** advice on medicine, law or money beyond "ask a
  professional"; numbers or statistics; shaming.

## The Race view

| Note | Now |
| --- | --- |
| "This progress bar should be for both the track & list view" | The Track View has **All steps progress** and a bar for each race |
| "Flip the order; should be 1 at the bottom and the final step at the top" | Both views: step 1 at the bottom, the last step (marked "finish") at the top. The track says how many steps come after the last one it shows |
| "Then, center it at the current step for each race" | Each list opens centred on the step you're on, in its own scrolling box (the page itself doesn't jump). The track's window of steps is centred on it |
| The Tidbit options are unclear; offer them after a milestone | The always-on links are gone. **After you finish a milestone**, a short window offers two ways to help someone at the same step: **Answer someone's question** (unanswered Tidbits about it) and **Share what worked, or what didn't** (solved Tidbits about it). Both open in a new tab. "Not now", or "Don't ask after each milestone" |
| "The Ultimate dream should be what's at the top of the race view" | Your **biggest dream** is under the Dream Self at the top |
| "the individual race category goals should be under its associated race category ONLY" | Each area shows its own goals only, or "No Workplace goal yet. Add one" |
| "'Your Goals, Dreams & Obstacles' ... customizable here" | **Change goals, dreams or obstacles**, in place (below) |
| (Liam) A car with the person in it; it beeps when a task is done | On the track, you drive a small red car parked beside your step. Finishing a step makes it bounce and go **beep beep** (with sound effects on). A step finished on another page beeps when you come back |
| (Liam) A transition between Track and List | The view slides in from the side of the tab chosen. Still for anyone who asked for less motion |
| (Liam, Odosa) The Dream Self, not a stick figure | The Dream Self as made in the Dream Self section (no car there: the car is for "You are here") |
| Avoidance: "at each milestone, highlight in red text what should be avoided" | In the Avoidance view every step shows, in red, what to avoid at it. The banner says where to look |
| Suggestions: the same, in green | Every step shows, in green, what helps |
| "Remove the 'Compete' option" | Gone from Views |
| "'Shared Challenges' should be a unique color & highlighted" | Teal, used for nothing else: the **Shared challenges** section and a **Shared challenge** badge on each race shared with someone |

A few notes about how these work:

- **"Shared Challenges" didn't exist** anywhere in the app. The nearest
  thing is goals you're working on with someone (Riipen Labs, Group 34's
  "Collab"; STEP 66), so those are the shared challenges.
- **Where each goal's area comes from:**
  - the area it was written under in setup (saved with the plan from now
    on, and in the browser for earlier plans);
  - otherwise, the goal's words ("Learn a new language" is Education);
  - and anyone can change it in the editor.
- **"You are here"** is now where you actually are (the first step not
  done) in the List view too. It used to be the plan's first step,
  whatever was done.

### Changing goals, dreams and obstacles

This is "Your Goals, Dreams & Obstacles" on Races. It saves to the plan
(`PUT /api/paths/me/profile`, `backend/core/profile_edit.py`) after the
same checks as setup.

- **A renamed goal keeps its race and its steps.** Nothing is
  regenerated.
- **A goal taken out is hidden, not deleted.** Its race, steps, tools and
  calendar entries are hidden on every page; adding the same goal again
  brings them back.
- **A new goal** starts with no steps and offers **Build steps for this
  goal**. That plans the one goal with setup's agents and adds its race,
  leaving the rest of the plan alone (`POST /api/paths/me/goal-steps`,
  `backend/core/goal_steps.py`). Its tasks aren't on the calendar until
  the plan is next adapted.
- **The biggest dream** is changed here too.

## The Path Market

| Note | Now |
| --- | --- |
| "Related Tidbits should open in a new tab" | They do |
| "Need suggestions for entire races, with a similar view to the current multi-race view" | **Start this Path** shows the model's races side by side, each to take whole |
| "Additionally, smaller suggestions for milestones" | A race's own steps can be taken one at a time, and **Smaller steps you could add** offers the category's ideas, each going with the race you pick. Setup gets the chosen races as goals in their own areas, and the planner uses the chosen steps as milestones |
| "No invented curricula for Recovery/Public Health/Entrepreneurship" (not to be developed) | None written. They stay under **Pathways awaiting content**, which now follows the filters |
| "Entrepreneurship & ADHD/Neurodivergence" → "Entrepreneurship & Neurodivergence" | Done (STEP 85, and shown now) |
| The same filters as ResourceHub, "Path Categories" first, with a dropdown of specialised categories under each | A sidebar like ResourceHub's: **Path Categories** (Education, Career, Relationships, Health & Wellness, Norms), each opening onto its specialised categories, then ResourceHub's **Norms** (with "Match my norms") and **Connection Type to Norm**, and **Status**. Each option shows how many models it would find. On a phone it folds into "Filters" |
| Each model labelled so the filters find it; Model Jet under Entrepreneurship | STEP 85 |
| Each path: category labels, norm labels, races and people, a name of its own, contributors and a short description; "Start this Path" | Every card shows them. Each category's starter is now "Medicine & Science Foundations" and so on, not fourteen models all called "Foundations". "Share your path model" asks for all of it: categories, norms, connection type, races with their steps, people (roles, never names), contributors |

### The life categories each specialised category is under

Only the first three came from the notes. The rest are a first guess:
check them, and change them in `path_categories.life_areas`.

| Category | Under |
| --- | --- |
| Medicine & Science | Education, Career (from the notes) |
| Entrepreneurship & Neurodivergence | Career (from the notes), Norms |
| Plant-Based Living | Health & Wellness (from the notes) |
| Public Health & Healthcare Careers | Education, Career |
| Career & Workplace | Career |
| Education | Education |
| Health & Wellness, Healthy Eating, Addiction & Recovery | Health & Wellness |
| Relationships & Community | Relationships |
| Creative & Hobbies | Career, Relationships |
| Independent Living | Norms, Health & Wellness |
| Adulting for Neurodivergent Adults, Travel & Independence | Norms |

### Model Jet

Model Jet is under Entrepreneurship & Neurodivergence, with the norms ADHD,
OCD and Depression and the connection type Self-diagnosed (ResourceHub keeps
"Self-diagnosed" as a connection type to a norm, not a norm). Odosa is its
contributor. It is still the draft written in September, with its two
starting goals as its races and no steps. It stays "Waiting for review"
(only its own account sees it) until Odosa's content is in and an admin
approves it.

## Also changed

- **Tidbits search, in ResourceHub:** a search now finds Tidbits with each
  of its words, in any order. It used to need the whole text as one phrase,
  so "study schedule" missed "a schedule for study". The help window above
  searches for the last two words of the step ("structured study schedule"
  → "study schedule").
- **Kept the same in both apps (checked in CI):** ResourceHub's tags,
  norms and filter lists, now also used by the app
  (`lib/filters/tags.ts`, `lib/filters/taxonomy.ts`,
  `lib/norms/taxonomy.ts`).

## How it was tested

- **Unit tests:**
  - `lib/milestoneTools.test.mjs`, `lib/guidanceData.test.mjs`,
    `lib/goalCategories.test.mjs`, `lib/pathMarket.test.mjs`,
    `lib/tidbitQuery.test.mjs`, and ResourceHub's `tidbits.test.mjs`;
  - the backend's `test_milestone_guidance.py`, `test_profile_edit.py`,
    `test_step_ideas.py`, and the route checks: all 464 backend tests
    pass.
- **STEP 85:** 19 checks on the whole schema, applied twice.
- **In a browser, on the local build:**
  - `.qa-local/browser/plan18.mjs`, 65 checks, all passing: statuses that
    clear, rating one tool, Used, labels, remove and undo, recommend more
    to 5, the Top 5 matching the Avoidance view, steps from the bottom, the
    car, the slide, the help window, renaming a goal (its race and 16 steps
    follow), and the Path Market's filters and Start this Path.
  - The QA account's plan and settings were put back after each run.
- **Accessibility:** no serious or critical problems on any page,
  including Races, its Avoidance view, the Milestone view and a
  milestone's page.
