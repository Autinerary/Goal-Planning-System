# Riipen Labs Groups 34, 35 and 36, September 2026

Three Riipen Labs reports from 25 September 2026:

- **Group 34**, "Layout and Feature Improvement Pitch": navigation, the
  social features, bugs, and customization.
- **Group 35**, "Final Report": a manageable first session.
- **Group 36**, "Customer Experience Brief": the personalization step, plain
  explanations, and how the website, the app and ResourceHub fit together.

This page says what Autinerary does for each recommendation as of 10 October
2026, what changed because of it, and what the team still has to decide.
Group 35 is also summarised in [cohort-report-2026-09.md](cohort-report-2026-09.md).

## Group 34

### The problems they hit (slide 8, and "stabilize core functionality")

| They found | What it was | Now |
| --- | --- | --- |
| Pop-ups misaligned | The page headers on Races, Life Stats, Compare paths, Ideal Self and the assistant stuck to the top of the screen under the app's own top bar, so after scrolling their Back arrows were hidden. On Races the header didn't stick at all. | The top bar publishes its height (`frontend/lib/useCssHeightVar.ts`) and those headers stick just below it. The race track's progress badge sits below both. |
| Calendar resets | Ticks on the tasks from your plan were kept only in memory, and the energy level and Day/Week/Month went back to defaults on every visit | Ticks are saved with the account and shared by the Calendar, Tasks and each task's page (`frontend/lib/planTaskDone.ts`). The energy level is remembered for the day, and the period for good. |
| "Too many requests" errors | Two causes. A retried path creation started a second one beside the first and hit the limit of 30 AI calls a minute (fixed 5 October, Group 9). And signing in went through a server route: it first asked a placeholder backend login that accepted any password, then signed in again from the hosting servers. Everyone's sign-ins came from the same few addresses, so a group signing in together shared one Supabase limit. | The browser signs in directly. The server route is removed, and if Supabase's limit is reached the message says to wait a few minutes. |
| Friend requests not received | Declining didn't stick: only the sender could delete the row, so the request came back. Nobody was told about a request. A request could be sent already accepted. | Declining and removing work for both people (checked against the live rules with two test accounts). A request sends a notification to devices that have them on. A request to a real person is always pending until they accept. The inbox says what accepting shares. |
| Filters not working | ResourceHub's category filters did nothing; one category list was incomplete; search missed matches | Fixed after their testing: 26 September, 4 and 5 October |
| (Found while checking this round) Tidbits and other signed-in ResourceHub pages, opened from the app, landed back on the Path | The app sends people to ResourceHub with their session in the link, but ResourceHub's middleware checked for its own cookie first and sent them to the app's sign-in, which sends signed-in people to their Path | ResourceHub's middleware sets the session from the link and reopens the page without it; the app's sign-in sends people ResourceHub sent there back through the hand-off. Signing in also no longer follows a `returnTo` to another website. |
| Mobile view broken | Not reproduced now | No main page scrolls sideways at phone width (12 pages checked) |
| Karma and up-votes feel inappropriate | Tidbits showed "N found helpful", which was really karma | "Helpful points", with the rule on hover and for screen readers. You can't vote on your own post or answer, and signed-out voting says to sign in. "How Tidbits works" explains it, ending "It is a place to learn from each other, not a contest." |
| Competition may discourage users | Races had a "Compete" view; Hare World said "See who's ahead" and "See who's competing on same goals"; one compare option was "To Friend-vals" | "Learn from others" ("It isn't a contest"); "See how they're getting on and learn from them"; compare "With role models / friends / mentors". Races is still your own race, at your own pace. |
| Energy tied to activity feels demotivating | The stat called Energy counted app activity, and its streak dropped every morning until you did something | Renamed **Activity**, saying it counts what you do in the app, not how you feel. The streak counts from yesterday until you've done something today. |
| No back button | Some pages had none; the milestone page always said "Back to Races" | Back buttons on a task's page, Gamification and Share your story. The milestone page goes back to where you came from. |
| Text too light | Low-contrast text and controls without names | The accessibility checker covers every signed-in page and WCAG 2.2 target sizes; 35 elements fixed |
| Limited customization | Setup's Character step had 34 hair styles but the Dream Self editor had 7, one of them "Braids" drawn as locs; 5 skin tones; the character appeared nowhere after setup; the accent colour only changed checkboxes | One editor everywhere, with every style; 9 skin tones and 13 hair colours. Your character is saved with your account, can be changed on Ideal Self, and stands at "You are here" on the race track. The accent colour now covers checkboxes, sliders, progress bars and selected text, and Settings says so. |
| The survey feels stressful | | Setup has been two questions since Group 5, with everything else optional; Group 36's changes below shorten it again |

### What they said is missing (slide 8)

| They said | Now |
| --- | --- |
| AI transparency | "Where does Autinerary use AI?" on the home page (since the cohort report) and in the glossary |
| Customization and accessibility | Above |
| Community features lack transparency | "How Tidbits works"; the rating form says ratings and written reviews are public on the listing; Tidbits settings are in the desktop menu; the Hare World inbox says what accepting shares |
| Onboarding stressful and unclear | Group 36, below |
| Navigation is confusing; feature purposes are unclear | The glossary, Quick Links at the top, Hare World on its own page, Your profile |

### Their recommendation (option 2, key takeaways, slides 12 to 17)

| They recommended | Now |
| --- | --- |
| Move core resources to the top | Quick Links come straight after "Your next step" on the Path, two to four across, each with a line saying what it is. Hare World is one of them. |
| A separate social page | **Hare World**, at `/hare-world`: your people, requests, groups and relationships. Pit Stop keeps the tools. Old `/pit-stop?tab=haveworld` links go to Hare World. |
| Break Pit Stop into clearer sections (tools, social, mentors, friends) | Pit Stop is tools; Hare World has role models, mentors and friends in columns, then groups |
| A profile page | **Your profile**, at `/profile`, opened from your name in the top bar: how friends see you, your character, your name, your email address (now changeable), your phone number, your password, Profile & Discovery (moved from Settings), and taking a break or deleting your account. Their mockup's fields are below |
| Short explanations for Tidbits, Pit Stop, mentors, races and messaging | **What things are called**, at `/help`: 33 terms, public. Linked from the home page, the Path, the Help popover, and the Pit Stop and Hare World headers. |
| Being able to expand the tabs on the main page | Their mockup (slide 22) shows menus across the top of the Path. **Stuck?, People, Fun, Mentors, Friends and Tools** each open a short list of places. "Show more" is still there for the rest |
| Split setup into two parts, the second after the account | Since Groups 5 to 7: two questions, optional extras, and questions asked later on the Path |
| Dropdowns instead of test-like questions | Kept as large buttons: Group 36 asked for large touch targets, and a dropdown hides the choices. A team decision if they want it revisited. |
| A 7-14 day feedback survey | The check-in questions (useful? why did you stop?) and the questions after setup |
| Moderation rules, mentor definitions, non-competitive framing | Friend, mentor and role model are defined in the glossary; non-competitive wording above. Tidbits reports go to the moderation queue. Written moderation rules are for the team. |

### Smaller items (slide 30)

| They asked | Now |
| --- | --- |
| More diverse hair types and appearance options | Above |
| Accent colours that actually change, everywhere | They change everything they say they do. A full theme is a team decision: about 2,300 colours are written into individual pages. |
| A back button on every page | Above |
| Reorganise Quick Links; maybe drop Races | Moved and explained. Races stays: it is where the plan's goals are. |
| A calendar with colour-coded tasks and checkboxes (slide 5) | Already there: the list colours tasks by priority and the week grid by repeating or one-off, with a legend; the list and time-block views have checkboxes; done tasks are greyed and struck through |
| Let the calendar suggest activities | **Ideas for your week**, on the Calendar: from the milestone you're on, a tool suggested for it, and today's energy level, by fixed rules. Each one adds through "Add to Calendar". |
| Energy not tied to how much you use the site | Above |
| Easier Life Stats toggle and happiness calendar | There was no happiness calendar. The **mood calendar** on Life Stats shows five weeks of "How are you today?", numbers as well as colours, and you can check in there (on the Path it only appears after "Show more"). Hide/Show stats on Races is remembered. The stats themselves were fixed: calendar rows never counted, and journal entries never reached Mentality. |
| Dream Land naming and look consistent with the rest | The page is called **Races** everywhere; Dream Land is its look. "Welcome to Dreamland" before the Path now says "Opening your Path". |

### Trust and community (slide 32)

| They asked | Now |
| --- | --- |
| A clear public/private toggle in ResourceHub | Tidbits settings: "Public profile" explained, two switches that did nothing removed, a desktop menu link. The rating form says who sees a rating. Reviews no longer send the reviewer's email and location to the browser. |
| Delete your own comments | Delete on your own answers; posts already had it |
| AI transparency | Above |
| Explain Compete and Marcus | Compete is now "Learn from others". "Marcus" was a placeholder name, removed in September; nobody called Marcus is in the app. |
| Repetitive quotes | 40 quotes, ten for each stage of the journey, one a day (`frontend/lib/quotes.ts`) |
| Integrate Tidbits and ResourceHub | Tidbits is inside ResourceHub, with the same account; the glossary says so |
| Explain Reddit-style features | "How Tidbits works" |

### Their mockups (slides 19 to 26)

| Mockup | Now |
| --- | --- |
| The Path's menus (slide 22): Stuck? > People > Fun > Mentors > Friends > Tools | Done. Stuck? includes **Talk to someone now** (9-8-8, 988 and 911) on the glossary page |
| Hare World (slide 19): "Find your friends" with Add and Search beside "Your friends", the same for mentors, and your top role models as cards | Done. Add and Search open the search or the add-by-name form for that list; role models show the top three, with the rest in a list |
| A person's card (slide 20): friends since, notes, Remove, Block | Done. The card shows their @username, pronouns, a few words about them and their dream; when you connected (for requests accepted after STEP 65) or when you asked; **your notes**, which only you can see; Remove; and **Block**, which asks first. Blocking removes the connection and any requests both ways, hides each of you from the other and stops new requests; they aren't told. **Blocked people** at the bottom of Hare World lists them, with Unblock. Block is on requests too. Chat and Collab are with the features below |
| Your profile (slide 21): username, bio, photo, phone number, change email, pause, delete | Done. Username (3 to 20 letters, numbers, dots or underscores; unique), **pronouns** (tick any of seven, or type your own), a bio, and a **photo**, cut square and made smaller in the browser, which also drops where the photo was taken. The phone number is the one verified for text reminders, changed in Settings. **Change email address** sends a link to the new address. **Pause** turns off every reminder, check-in, weekly email and notification, and hides you from search, until you press Resume (on the Path or here). **Delete** removes the account and everything linked to it at once, after you type DELETE; it points to the back-up first. Team accounts can't be deleted this way |
| Setup (slide 25): pronouns, a username, "Who are you?" in three groups, and "Pick your settings" (dark mode, contrast) | Done. "Who are you here for?" has three headings: **Yourself**, **Family**, and **Friends, work and others**, with "Not sure yet" after them. Their first group was called "Neurodivergent"; it says "Yourself" because not everyone planning for themselves uses that word. Pronouns and a username are folded away under "Add your pronouns and a username (optional)", so the first step is still two questions; they save with their own button, so a taken username is said there, and they appear once STEP 64 is applied. Personalize has **Pick your settings**: light or dark, higher contrast, and text size, which take effect at once |
| Dark mode | Done, marked experimental, in setup and in Settings, then Accessibility. The app's colours are written into each page (about 2,300), so instead of a second palette the page is shown as its negative with the hues turned back. Photos, video, characters and emoji pictures keep their colours; other emoji look different. It is set before the page first draws, so it doesn't flash white. A designed dark palette is a team decision, with the accent colours |

### Hare World features that didn't work

Messages went to the wrong person and were never shown; the meme feed showed
only your own; "Mentor call" was a timer with no video; rival updates, mentor
tasks and notes of support were never filled in; "Collab" on races had nothing
behind it; "Suggest" and "Share/Restrict/Private" only showed an alert. They
are now listed under "Coming later" instead of offered, and in the glossary's
"Not working yet". Their code is kept. **Team decision:** build them or remove
them.

## Group 35

Their recommendation is in place: progress, save and skip in setup, a starter
shelf, a question audit and tracking from day one.

| They recommended | Where it is |
| --- | --- |
| A visual progress cue | Setup's "Step 1 of 2", then "Optional extra N of 7" |
| Save and resume | "Need a break? Your answers are saved on this device" and "Welcome back" |
| Skip optional questions | "Skip for now" on every extra, and "Create my path now" |
| A starter shelf before the full profile | Start here (no account), and starter resources first after setup |
| A question audit | [onboarding-questions.md](onboarding-questions.md) |
| Basic tracking from day one | The funnel since September (`python -m scripts.onboarding_funnel`, from `backend/`). Since this round it also counts Hare World, Your profile, Life Stats and the glossary. |

Their "10 pages of intake" was cut to two questions in Group 5.

## Group 36

| They recommended | Now |
| --- | --- |
| Fewer questions on the personalization step | **Personalize** asks two things instead of four. Age range and "How often do you use apps?" only capped the liveliness picked in the next question, so they asked it twice. The age band comes from the date of birth given at sign-up, and only for matching similar people. |
| Less text, more visuals | Personalize's text is one line, and its choices are picture tiles |
| Explain unfamiliar terms (Races, Norms, Path Model) | The glossary |
| A visual roadmap of the website, the app and ResourceHub | **Three places, one account**, on the home page and in the glossary: what each is for, whether it needs an account, and which to start with |
| Large touch targets, clearer labels, shorter text | The accessibility checker tests target sizes (WCAG 2.2); labels added to icon-only buttons |
| A "Start here" option | Start here, since Group 4 |
| The website repeats itself (Who We Are, Our Story, Our Mission, the Learning menu) | www.autinerary.ca is a separate project, not in this repository: **for the website team** |
| Rewards for finishing setup (their option 2) | They recommended option 1, simplifying, which is what changed. Setup has a progress cue; badges for setup are a team decision. |
| A live chat assistant | The assistant page, and the AI goal helper in setup (Group 11) |

## Team decisions

1. Hare World's unfinished features: build or remove.
2. ~~Closing or pausing an account in the app~~: built from the mockup
   (slide 21), with Privacy updated. Deleting needs STEP 65; until it is
   applied the page says to email us, as before.
3. Accent colour as a full theme.
4. Written moderation rules for Tidbits.
5. The website's content (Group 36): for whoever runs www.autinerary.ca.

## Database

STEP 63 (`backend/database/migrations/2026_badge_wording.sql`): two Tidbits
badges say what earns them. "Helpful" said "Received 5 upvotes on an answer"
but is given at 25 helpful points. It changes only those two rows, only while
they still have the old wording, and can be run twice. Applied on 10 October
and checked live: "Reached 25 helpful points" and "Reached 1,000 helpful
points", with the other four badges unchanged.

"Streak Starter" ("Posted on 3 consecutive days") has no rule that grants it,
so nobody can earn it yet.

STEP 64 (`backend/database/migrations/2026_profile_privacy.sql`), found while
building the person card: anyone could read the **whole** profile row of a
person who was discoverable, or linked to them by a connection or request,
including their email address, date of birth and settings (which can hold a
phone number). Discoverable rows could be read signed out, with the public key
the website ships. The app never showed those fields, but the database did.
After STEP 64 people read only their own row; other people's public fields
(name, picture, dream, username, pronouns, bio, photo) come from a
`public_profiles` view; people search matches a name, a username or a
**whole** email address (it matched any part, so "gmail" listed everyone
discoverable on Gmail). It also adds the new profile fields and the photo
bucket. The app was changed first, so it works before and after.

STEP 65 (`backend/database/migrations/2026_blocks_and_account_deletion.sql`,
after STEP 64): when a request was accepted (for "Friends since"), blocking,
and `delete_my_account()`. Deleting clears references that would stop it
(who locked or resolved a Tidbits post, who suggested a resource), removes
rows in tables that hold a person's id without a link to the account (the
journal, the matching vectors and others), then the profile and the sign-in.
Where the database may not remove a sign-in, the app finishes with the admin
API. Both were tested on a local copy of the whole schema (every migration
file): 46 checks, with each run more than once to show it can be.

## How it was checked

- Unit tests for the new logic: plan-task ticks, daily quotes, calendar
  ideas, age bands, password rules, avatar choices and the funnel areas.
- The funnel report's tests (62).
- The live friend-request rules, with two test accounts: the person asked can
  decline, accept, and remove an accepted connection, and can't touch someone
  else's private note. The test rows were removed.
- A browser test of the local build against the live database (56 checks),
  with the reset email and usage counts intercepted, and the test account
  restored afterwards. It covered signing in, "Forgot password?", the reset
  page, Your profile (name and password), Pit Stop and Hare World, a request
  declined, accepted and removed between two test accounts, the character on
  the race track, the Races wording, the calendar's ideas, energy level and
  ticks (saved to the account and still ticked after a reload), the mood
  calendar, sticky headers, Back buttons, and 12 pages at phone width.
- The accessibility checker on every page, at phone and desktop widths.
- For the mockups: a second browser test (75 checks) of the Path menus'
  pages, Hare World's board, a person's card, notes, blocking and unblocking,
  Your profile's new fields, the photo (a 900 by 600 picture arrives as a 512
  by 512 JPEG in the person's own folder), changing the email address, pausing
  and resuming (on the live database, with the test account restored), the
  Path's paused banner, and deleting. What STEP 64 and 65 add was answered by
  the test, since they aren't applied yet; nothing was deleted and no email
  was sent. axe's WCAG 2.2 AA rules on each of those screens: no issues.
