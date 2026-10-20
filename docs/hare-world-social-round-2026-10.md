# The Hare World Social round (October 2026)

The team's notes for this round covered four things:

- **Pit Stop #2 / Hare World:** "Add one friend from here & test out each of the features in the Functions & Additional Features sections". Also "Creating a Collab Group", and "Relationships don't work for now".
- **The Journal** (Screen 6).
- **The Task View** (Screen 5).
- **Hare World Social** (Odosa), a new core part of Hare World.

This page says what was built for each note, how it was tested, and what needs someone on the team. It also gives the choices made where a note left room. Written 20 October 2026.

The database change is **STEP 87**: `backend/database/migrations/2026_hare_world_social.sql`, also at the end of `setup/all_migrations.sql`. It was tested on a local copy of the whole schema: 64 checks in `.qa-local/pgtest/step87_test.py`, run twice. **It was pasted on 20 October and checked on the live database:** 44 checks in `.qa-local/browser/step87_live.mjs`, as the two QA accounts, removing their own rows and files. Before the paste, the new parts said they opened soon, or didn't show; the app checks for STEP 87 by itself (`/api/moments?scope=check`).

STEP 87 adds five things:

1. **What each person shares with each of their people.** On each connection, each side picks one of three:
   - **Share:** path, calendar and progress.
   - **Restrict:** progress only.
   - **Private:** nothing.

   Each side also picks whether to **watch** the other, which sends a notification when they finish a milestone. The rules that let your people read your path, calendar and progress now follow these choices. Neither side can change the other's choices.
2. **Moments** (Hare World Social), with cheers and reports. Photos and videos go in a private bucket, `moments`, of up to 50 MB each.
   - A moment is private unless its author shares it: with their people at once, or with everyone after the team has looked at it.
   - Two reports hide a moment until the team looks.
   - Family accounts (under 18) can only keep moments private.
3. **Notes to future you:** the Journal's Quick Note to Self and the notes from "Stop for now". Only the writer can read them.
4. **Relationships (matching).** Only people who opt in are suggested to each other, and only what they choose to show is shown.
5. **Collab Groups.** The rule for seeing who is in your group read the same table again; Postgres stops that as infinite recursion. A helper now answers it instead.

Nothing is deleted. Safe to re-run.

## What needs someone on the team

| What | Where | Why it waits |
| --- | --- | --- |
| Review moments shared with everyone, and reported ones | The app, `/admin/moments`. It needs an admin, and nobody is one yet (see the All Apps round) | A moment for everyone shows only after a person has looked at it. The team gets an email when one is waiting or reported |
| Decide what Quick Note to Self is | Below, under the Journal | On 30 July the team's "Remove entirely" was taken to mean Memory and Quick Note to Self, and they were removed (`41ed42d`). This round's notes ask for Quick Note to Self again, so it is back. That chat may have been about Liam's animations instead |
| Decide the motivation styles before testing the report | Below, under the Journal | The report on All Entries and the profile use different sets of six |

## Hare World: "Add one friend from here & test out each of the features"

The screenshot shows Hare World as it was before 10 October. Both sections were rebuilt then (Riipen Labs, Group 34):

- **Functions** are now the tiles under "What you can do here".
- **Additional Features** are now under "With your people", in Messages, and on each person's card.

Every feature was tried with two QA accounts (QA A adds QA B; see "How it was tested"). ✓ means it worked in that run.

### Functions

| On the screenshot | Now | Tried |
| --- | --- | --- |
| Find/Search | The search bar finds your people (People) and groups by name (Collab Groups). "Find someone new called “…”" opens Add with the name already searched | ✓ |
| Add | Add, then Friends, Mentors or Role Models, then **Search on Autinerary**, then Send Request. Search finds people who turned on Discoverable. They accept at the top of Hare World | ✓ A added B, and B accepted |
| Remove | Each person is listed, and each Remove says which connection it is. The same person can be there twice: your friend, and someone who chose you as a mentor. If removing fails, they come back and it says so | ✓ both of B's connections |
| Suggest | New tile. Pick one of your people, then **A resource** (their page, with the suggestion box open) or **A task or a note** (their card) | ✓ |
| Journal | "Journal about your people" opens a new entry about the people in your life | ✓ |
| Share / Restrict / Private | Who can find you: Your profile, then Profile & Discovery. What each person sees: on their card, Share / Restrict / Private (STEP 87) | ✓ the link. The card's choices come with STEP 87 |

### Additional Features

| On the screenshot | Now | Tried |
| --- | --- | --- |
| Rival Notifs | **Updates:** the steps your people finish. It isn't a contest. **Watch** on a person's card sends a notification when they finish a milestone (STEP 87) | ✓ B finished a step, and A saw it |
| Person's Icon @ Goal | Your people's icons beside a goal like theirs. In Hare World: "Your people on the same goals". In Races: beside each area's goal | ✓ both QA accounts have "Learn a new language" |
| Mentor Tasks | **Mentor tasks:** someone who chose you as their mentor can be sent small tasks. They accept, decline or tick them off | ✓ B chose A, A sent a task, and B accepted it |
| Supporting | **Notes of support** | ✓ |
| Messaging | **Messages**, with "(1 new)" on the button | ✓ |
| MEMES | **Memes:** an emoji or a few words. Like them, and delete your own | ✓ |
| Collab on goals | **Goals together:** invite one of your people to a goal; they accept or not. The goal box now starts with your first goal, even when your plan loads after the form | ✓ |
| Calls | **Calls:** book a time, with a private Jitsi Meet room or your own link. Cancel or mark it done | ✓ B cancelled |

### Creating a Collab Group

These faults turned up while testing, and are fixed:

- **A new group could vanish.** A group of another type didn't show while you looked at one type. Now the filter clears.
- **"Successfully Joined!" showed even when joining failed.** It now shows only when you're in.
- **Joining again could demote the leader.** It can't now.
- **The last member leaving deleted the group without a word.** It now asks first.
- **There was no way to hand a group on.** Each group now has a page with its rules and members. Members see each other's names; nobody else does. The page shows a private group's code, and the leader can:
  - edit the rules;
  - **Make leader** (hand the group to another member);
  - **Remove** a member.

  A leader who tries to leave while others are still in is asked to choose a new leader first.
- **The create dialog was hard to use with a screen reader.** Its fields now have labels, and its close button has a name.

Tried: A made a private group, and B joined it with the code. A edited the rules, made B the leader and left. B, now alone, closed the group on leaving. A made a public group, and B found it by searching and joined. A couldn't leave as leader, removed B, then closed the group.

### Relationships

The notes said "Relationships don't work for now" and "Relationships/Matching (add picture). Try with 1 other person from group!". It is built now (STEP 87):

- **Joining.** You choose what you're looking for (friends, an accountability buddy, a mentor, someone to mentor), the areas of life you're working on, and a short note. Others in Relationships see your name, your picture (from Your profile), these choices and the note.
- **Who is suggested.** Only others who joined and can be found, most areas in common first. Never Family accounts, blocked people, people already asked or connected, or people you said "Not now" to.
- **A match.** "Ask to connect" sends an ordinary friend request: they accept or not. "Leave Relationships" takes you out at any time.

**To try it with one other person**, after STEP 87: both join, both turn on Discoverable (Your profile), and don't already be connected.

## Journal (Screen 6)

| Note | Now | Tried |
| --- | --- | --- |
| Submitting took you back to the Path; it should go to Previous Entries | After Submit you land on **All Entries**, with "Your entry is saved". Back from there goes to where you opened the Journal, not to an empty form | ✓ |
| Rename "Previous Entries" to "All Entries" | The card and the page | ✓ |
| No back button | **Back** on the Journal and on All Entries, and "← Back to the Journal" inside New Entry and Quick Note | ✓ |
| Move "Memory" here as the third option, "Quick Note to Self", and say where it shows up | It is the third card. It says where notes show up: in the Journal, on the next task you open (as "From past you") if you tick "Bring it back to me", and in Memories (Hare World). See the 30 July note in "What needs someone on the team" | ✓ It opens soon until STEP 87 |
| (Liam) A page-turn sound for every submission | It plays once the entry is saved. Sound effects are on by default; Reduce motion turns it off | ✓ |
| (Odosa, "to test, NOT to add") A motivation style report | Not changed. A report is already on All Entries ("____ was your best Motivation Style"), read from the words of your entries. But its six styles (Achievement, Social Connection, Reward-Based, Purpose-Driven, Growth & Mastery, Autonomy) aren't the profile's six (Intrinsic, Achievement, Social Connection, Reward-Based, Deadline-Driven, Curiosity). Only three are the same. Worth deciding before testing it | |

## Task View (Screen 5)

| Note | Now | Tried |
| --- | --- | --- |
| "Start this as toggled off" | The companion is off unless you turn on the **Companion** switch, on the Task tab and on each task's page. The choice is kept with your account | ✓ |
| (Eliyana) Two mascots at once is distracting. Drag the spirit animal to a corner | One companion, your spirit animal; the bunny steps aside. Drag it to any corner, or move it with the arrow keys. It remembers the corner | ✓ |
| (Odosa) Drag it even after the app is closed? An extension? Privacy? | **Keep on top**: see below | ✓ offered |
| (Odosa) The Motivation Wheel generating quotes. (Eliyana) Maybe only at the start | **One spin as you start.** It lands on one of your motivation styles (from your profile; all six if you chose fewer than two), with one line written for it. It stays spun for that task that day. The rotating quote is gone | ✓ |
| (Odosa) "Today's trick/hack" has the tasks, not tricks | On a task's page: tricks written for that task with your plan, else its milestone's tips, else general ones, and it says which. On the Task tab: "Today's tasks", and a separate **Today's trick** | ✓ the task's own three tricks |
| (Odosa) The screen needs a redesign | See below | ✓ |

**The redesign:**

- **A task's page.** A header with Back, Companion, the task, its milestone and minutes. Then three columns:
  - Tricks & hacks;
  - the Wheel, "I've done it", "Stop for now", Music and the Journal;
  - From past you, and today's other tasks.
- **The Task tab.** Today's tasks, each with an **Open** to its page, and today's trick. It now shows today's tasks by weekday. It used to show the plan's first day, and a date-only day was read as the day before in the Americas, so Tuesday showed Wednesday's tasks.

**"Drag it even after the app is closed": what was built, and why not an extension.**

- **Keep on top (built).** This uses Document Picture-in-Picture: one button opens a small window that stays above every other app. It shows the companion, the task, a cheer every 90 seconds and the minutes so far, with a button back to the task.
  - It lasts as long as the app's tab is open, even minimized or behind another tab.
  - It works in Chrome and Edge on a computer, with nothing to install and no permission to ask.
  - It reads nothing on the screen and collects nothing new, so there is nothing new to ask anyone's consent for.
- **A browser extension would be worse.** It can't draw over other apps either, only over web pages inside the browser. It would need permission to read and change every website you visit, and a store review.
- **A truly floating companion,** after the app is closed or on a phone, needs a native app: an overlay or widget on Android, a Live Activity on iPhone. That's later, if wanted.

## Hare World Social (Odosa)

| Note | Now |
| --- | --- |
| At the end of each task and milestone, a photo or video plus a caption, or just one | **Capture this moment** comes after "I've done it", and after ticking a milestone in Races. Take a photo or video (the camera on a phone) or choose one, add a caption, or both. Then you're back on the Calendar (or, in Races, at the help prompt). Before STEP 87 none of this shows, and Done goes back to the Calendar as before |
| The caption should be about the f-ups and the beginning that led to the end | The caption box asks about the way there: one of several prompts, such as what went wrong and what you did next |
| Stop a task and write to your future self ("do better", "keep doing good", "today walked so tomorrow could run") | **Stop for now** on a task's page. Choose Do better next time, Keep doing good, or Remember today ("Today walked so that tomorrow could run: …"). The note comes back on a task's page from the next day, as "From past you" |
| A "Memories" profile, with each caption and its task or milestone | Hare World Social, then **Your Memories**: every moment with its caption and its task or milestone, and the notes to future you. Only you see the page; each moment says who else can |
| A "Reels"/Posts feed of the highest-trending photos and videos | Hare World Social: **Trending** (the most cheered in the last 60 days) and **Your people** (newest first). Cheer a moment, or report it |
| A core part of Hare World, called "Hare World Social" | Hare World's fourth tab |

**Keeping it safe.**

- **Who sees a moment.** It is private by default. "My people" means your connections (minus anyone you set to Private). "Everyone in Hare World" shows only after an admin has looked (`/admin/moments`).
- **Reports.** Anyone who can see a moment can report it. Two reports hide it until the team looks.
- **Under 18.** Family accounts keep their moments private.
- **The files.** Photos and videos are in a private bucket, and shown through links that expire after an hour. Deleting a moment deletes its file, and deleting your account deletes them all.
- **Terms and Privacy.** The Terms now ask people not to post others' faces or names without their OK. The Privacy page says what is kept and who sees it.

## Also in this round

- **Your data.** The personal data download (Your profile) now includes:
  - your moments (captions, and which task or milestone);
  - your notes to future you;
  - your Relationships profile.
- **Help.**
  - The page guides ("How it works") for the Task View, Hare World and the Journal describe the new parts.
  - The glossary (`/help`) has terms for Companion, Quick Note to Self, Relationships, Hare World Social and Memories, and the sharing levels. Relationships is off "Not working yet".
- **Accessibility.**
  - The Journal's answers and the create-group fields have labels.
  - Close and Remove buttons have names.
  - The Remove confirm and "Spin to start" buttons are dark enough to read.
  - The companion's buttons are at least 24 px.
- **Notifications** (requests, messages, calls, tasks, goals together) use a sender that can't break the request when push isn't set up.
- **ResourceHub's sign-in** (found by the regression run). A signed-out visitor to ResourceHub's home who then opened a page needing sign-in within a minute got ResourceHub's own sign-in, not the app's.
  - The cause: the home page prefetches `/shop`, and the loop guard (11 October) counted that prefetch as a visit.
  - The fix: now only real page loads count. Next.js hides its prefetch headers from middleware, so the browser's `Sec-Fetch-Mode` tells them apart (`servicehub-mvp/middleware.ts`).
  - The guard still stops a real loop. Checked: two page loads within the minute end on ResourceHub's own sign-in, and `loopguard.mjs` passes 5/5.

## How it was tested

- **STEP 87 on a local copy of the whole schema:** 64 checks (`.qa-local/pgtest/step87_test.py`), run twice. They cover the sharing levels (each side only its own), who sees which moment, the team's review, cheers and reports, the bucket's folders, Family accounts, notes, matching, and group members without recursion.
- **`.qa-local/browser/plan20.mjs`:** two QA accounts, before STEP 87. Result: **108 of 108 checks passed, locally and then on production** (app.autinerary.ca, after the deploy on 20 October). The first runs found the faults fixed above: the companion's small buttons, the same person twice in Remove, and the icons missing from Races. It covers:
  - every Function and Additional Feature above, between the two accounts;
  - the Collab Groups;
  - Relationships, Hare World Social and Memories ("opens soon");
  - the Journal (its POST answered in the browser, so no entry is saved);
  - the Task tab and Task View, the wheel and the companion;
  - finishing a task and a milestone;
  - the admin page as a non-admin;
  - axe on each changed page and dialog, and phone width (375 px) on ten pages.

  It removes everything it made, and puts back names, preferences, plans and progress. Nothing was left over, either time.
- **ResourceHub's sign-in on production:** after the home page, a page that needs sign-in goes to the app's sign-in and comes back.
- **The earlier suites** (`run_all_local.sh`, 17 suites and the accessibility checker on every page) all pass after a rerun. The checker found no serious or critical problems. On the full run:
  - **g8 (1 failure):** the ResourceHub sign-in fault above. 57/57 after the fix.
  - **g34b (1 failure):** a note saved a moment late. 75/75 alone.
  - **plan10 (4 failures):** it still counted four colour themes; there are seven since the Tidbits round. With seven, 42/42.

  Also run, as they cover pages changed here:

  | Suite | Result |
  | --- | --- |
  | plan15 | 37/37 |
  | plan18 | 65/65 |
  | plan19 (ResourceHub, after the sign-in fix) | 51/51 |
  | plan14 | 65/68. The 3 are the help chat, which needs `OPENAI_API_KEY`; the local app doesn't have one, and production does |
- **Code checks:** typecheck, lint (three older warnings, none new), the production build, and the library tests (`lib/*.test.mjs`).
- **After the paste:** `step87_live.mjs`, 44/44. Then `plan20.mjs` on production found STEP 87 by itself and tried capture, Stop for now, Memories, Trending, Relationships and sharing for real: 115 of 120 at first. The 5 had two causes:
  - **A photo could be dropped without a word.** It happened when chosen before the dialog knew who was signed in, which takes longer on a slow connection. The dialog now looks that up itself (`MomentCapture.tsx`).
  - **The test chose a note kind wrongly.** The kinds are radio buttons, and it looked for buttons.

  Both are fixed, and the suite was run again (see the Calendar round's doc).
