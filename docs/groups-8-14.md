# Riipen Labs Groups 8 to 14, September 2026

Seven Riipen Labs reports from 25 September 2026:

- **Group 8**, "Customer Experience Brief | Team 8": ResourceHub's own
  sign-up, from Welcome to a first resource. Five steps before anything
  useful, a location that said "optional" but was required, an impact slider
  asked twice, and a location that changed nothing (Surrey, BC got Montreal).
- **Group 9** (one member; "other team members were largely unresponsive"):
  the nine-stage setup shows too much at once, it froze, and "the frequent use
  of emojis, bright colours, and game-like visual elements" made it feel less
  polished.
- **Group 10**, "Customer Experience Optimization Report": progressive
  onboarding: welcome, user type, immediate goal, a useful path, micro-prompts
  when relevant, and check-ins that "adjust path with feedback and
  engagement".
- **Group 11**, "Customer Experience Optimization Report": value before the
  account, an AI guide on the goal step, and bringing people back, in three
  stages of numbered proposals (1.1 to 3.4) and a page on readability.
- **Group 12**, "Customer Experience Brief": no "Start here" feeling, nothing
  to try before committing, and no way to tell how Autinerary differs from the
  Geneva Centre for Autism or Autism Ontario. A short guided demo that people
  pace themselves, a 14-day trial, and micro-surveys on day 3 and day 7.
- **Group 13**, "Marketing Campaign Analysis": big blocks of text on the home
  page and in setup, a progress area that takes about half a phone screen and
  has to be scrolled past at every step, and sections of different sizes.
- **Group 14**, "Customer Experience Optimization": nine crowded steps, "Step
  1 of 9" that never moved, bright colours, and no clear first action. "Who
  are you? What matters most to you? Here's your first action", with a first
  action for each kind of person.

Groups 8 to 11 were first worked through on 5 and 6 October
([resourcehub-first-session.md](resourcehub-first-session.md),
[first-visit-to-return.md](first-visit-to-return.md), and the Group 9 and 10
changes in setup and the report). Since then setup became two questions
(Groups 25 to 30) and the first visit was paced (Groups 20 to 24), so on 15
October all 32 of their items were checked again against the app: every one
is still there, one was replaced and six changed, and ten things had slipped
or were never right (below). Groups 12 to 14 are new. This page says what
Autinerary does for each point as of 15 October 2026, slide by slide. The
onboarding version is now `guided-2026-10`, so the funnel report compares it
with `clear-2026-10`.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| A look inside (home page) | Four screenshots at once, taken on 6 October: they still showed the "AI-Generated" badge, an icon-only top bar and a card the Path no longer has | **One screen at a time, chosen by the visitor**: the Path, a step, the Calendar or ResourceHub, each with what you do there, "Next: …", and at the end "That is all four" with Start here and sign-up. Tabs work with arrow keys, Home and End. Retaken on 15 October with a sample plan ("Learn a new language"), and `scripts/qa/preview-shots.mjs` retakes them next time. Each screen opened is counted, so the report shows how many went through it and where they stopped |
| How Autinerary differs | Nothing on organisations like the Geneva Centre for Autism or Autism Ontario | A question in "Why Autinerary": "How is this different from Autism Ontario or the Geneva Centre for Autism?" They run programs and services, and Autinerary does not replace them; Autinerary is where you plan, around your energy, with the services that can help, theirs among them, in ResourceHub. Both are in ResourceHub (checked) |
| Start here, supporting someone | Three optional questions after the list | Four: **"How old are they?"** first (Under 6, 6 to 12, 13 to 17, 18 or older), asked only of parents, family and people who teach or work with someone. It puts the list in order (schools and therapists first for the youngest, after-school activities for school ages, work for adults) and the starter kits: school support first for 6 to 17, the assessment first under 6, and neither for 18 or older, since both are about children. Counted like the others |
| Check-ins | "Is it useful so far?" after five days of use, or in the second week | **Day 3 to 6**: "How is it going so far? (optional)": it's going well; there is too much to take in; I'm not sure what to do next; I can't find what I'm looking for; it isn't what I need; something else. Each answer that is a problem offers a change, as Group 10 asked ("not sure what to do next" offers just the next step, and what things are called). **From day 7**: "Is it useful so far?", never on the same day. Group 12's day 3 and day 7. The answers need STEP 76; until then they are kept as text, marked as day 3, and the report counts them either way |
| First action after setup, for yourself | The Path | **"Read or ask a question in Tidbits"** (Group 14: "Neurodivergent Adult: Explore or join a community thread"). Parents get the starter kits, people who teach or work with someone ResourceHub's search |
| Setup on a phone | The welcome, the progress rail and a three-line box of skip buttons came before the first question on each step; the AI helper came before the goal ideas; "Continue" left the page where it was, and focus was lost | The skip line is one line with its two buttons side by side; the rail is shorter; the AI helper comes after the goal ideas; "Continue" opens the next step at its card with focus on its heading. On a 390 by 844 phone the first question moved from 735 to 605 pixels down, "Who are you here for?" from 955 to 825, and after "Continue" the goal ideas start 574 pixels down instead of more than a screen below |
| Words | The home page's longest paragraphs were 48 and 55 words; the goal step said "can come later" twice | 35 and 45 words; the goal step's opening is 12 words |
| The Path | "Getting started" and "Complete your profile" could show together | One card at a time again: a check-in, then the offer of more features, then "Getting started", then "Complete your profile". Things to do before things to fill in (Group 15). While "Complete your profile" waits, the tour's "Show me" says where it is |
| Settings, how lively it looks | Four looks drawn with emoji | Plain icons (Group 9) |
| The norms page | About 80 choices in nine groups, all of which could be open at once | One group open at a time, "Picked so far" above them, and how many are picked in each (Group 9, as setup did before the norms left it) |
| ResourceHub's display | Soft colours did not reach it; its own Accessibility Settings page kept separate choices that applied only while that page was open | Soft colours come over from the app with the rest of Display. The settings page uses the same settings (text size, high contrast, dark mode, soft colours, reduce motion, dyslexia-friendly font, underline links) and they stay on every ResourceHub page |
| ResourceHub's sign-up | The menu's "Sign up" made a ResourceHub-only start, while the sign-in page's "Create your free account" made an Autinerary account | Both make an Autinerary account, one account for both (Groups 22 and 24). ResourceHub's own three-step setup is still at `/signup` for anyone already there |
| ResourceHub's profile | "Role: Not chosen yet" for anyone who signed up in the app; a location could be set or changed but not removed; signing in from it came back to the home page | The role comes from the app's "Who are you here for?" ("From who you're here for in Autinerary. Edit to choose here instead."). It is only read: the database's role also holds the team's roles (STEP 68). **Remove** takes the location off, as the privacy page promises ("optional and removable"). Signing in comes back to the profile |
| ResourceHub's list for you | With a location, titled "Recommended by AI Agent"; when empty, "No recommendations yet … from our AI agent", with nowhere to go | "Places near you", or "Places matched to you": "Chosen with AI from your norms, and from people who share them". When empty, "Nothing matched yet", with links to add a topic or location and to search |
| ResourceHub on a 320-pixel screen | The header was 38 pixels too wide, so the page scrolled sideways (WCAG 1.4.10) | Under 360 pixels the house stands alone; the link keeps its name |
| The funnel report | | "A look inside": how many opened each screen, and how many screens each browser saw. "Day 3: how is it going?" with each answer. Start here's age answers |

### Found and fixed while doing this

- **The home page's screenshots were nine days out of date**, and as a
  sample of the app they no longer matched it. Retaking them by hand had been
  left to the team; the new script retakes all four from any account with the
  sample plan.
- **The Path's heading used a name only the app's own sign-up writes.** A
  test account made another way showed "test.account+…'s Path". Every real
  sign-up writes both name fields, so no one was affected; the screenshots'
  account was given both.
- **ResourceHub's Accessibility Settings did nothing outside that page**
  (above). Its "screen reader optimization" switch changed nothing a screen
  reader uses, so it is gone.
- **ResourceHub's signed-in pages were never checked for accessibility**:
  the checker opened ResourceHub only signed out. Signed in, three serious
  problems showed: the account menu's button was named "User menu", with none
  of the words on it (WCAG 2.5.3; it now says the person's name, then
  "Account menu"); the profile's rows were a definition list holding buttons
  and editors (now rows with a small heading each); and "Find Services" on an
  empty My resources was white on light green, 3.8 to 1 (now 5.5). The
  checker now signs in to ResourceHub through the app's link and checks its
  profile, settings, My resources, notifications and home page.
- **Two outside links are dead.** A retirement residence's website (Revera
  Grand Wood Park, `reveraliving.com/en`) no longer exists. And a plan keeps
  the tools suggested when it was made, so one made before a school's address
  was fixed on 5 October can still list the old one
  (`tvdsb.ca/SirIsaacBrock.cfm`; the QA account's does). ResourceHub has the
  current address. For the team, below.

## Group 8

Group 8 reviewed ResourceHub, not the app. Their guiding question: "does
each screen ask something proportionate to the value the user has received
so far, or does it ask for trust before earning it?"

### What they found (slides 2, 3, 11 to 13 and 22)

| They found | Now |
| --- | --- |
| Five steps (Welcome, Location, Norms, Impact, Context) before a first resource | Three since 5 October: who you are, one topic and what you hope to find, then real places to start, each saying why it is there ([resourcehub-first-session.md](resourcehub-first-session.md)) |
| Location "private and optional" with three required fields | Not asked in setup; optional everywhere it is asked. **New**: it can be removed |
| Impact repeated the Norms slider | Gone from setup; asked on the profile per topic, optionally and in words |
| Surrey, BC got Montreal results, 3,675 km away | Places within 50 km first, nearest first, with each distance; "Broader options" after; a plain message when few or none are near |
| Two-letter placeholders on cards | An icon for the kind of place |
| "A clear, early signal of why this platform is different from a Facebook group or a generic search" | ResourceHub's home: "Find resources rated BY people like you, FOR people like you"; the app's home page: "Why Autinerary" and, **new**, how it differs from Autism Ontario and the Geneva Centre (Group 12) |
| Parents "navigating on someone else's behalf" | ResourceHub's step 2 says matches are about the person they support. **New**: the role from the app's "Who are you here for?" shows on ResourceHub's profile |

### Their recommendations (slides 3, 4 and 15 to 19)

| They recommended | Now |
| --- | --- |
| "Role → one topic → first personalized resource" | Done 5 October. **New**: ResourceHub's menu "Sign up" no longer leads to a second kind of account; both sign-up links make an Autinerary account |
| "Fix the backend location-filtering logic" | Done 5 October; the report shows the share of results within the radius |
| "Progressive, trigger-based customization", e.g. "suggesting a new topic after a user saves several related resources" | Three prompts since 5 October: a searched topic, three saves of one kind, a week after joining; each counted |
| A simple "Add more to your profile" page, before fields leave setup | The profile's "More about you (optional)" |
| "Colour schemes, fonts, visual components ... softer to account for people who may experience increased sensibility to screens" (slide 4) | **New**: Soft colours reach ResourceHub, and its own settings page has them with the rest |
| Success measures: setup completion, "time from landing to first resource viewed", the share of results within the radius (slide 19) | In the report since 5 October |
| The feedback form sent to Western's neurodivergent clubs (slide 35) | For the team, below |

## Group 9

### What they found (slides 2, 4, 5, 14 and 15)

| They found | Now |
| --- | --- |
| Nine stages, many of them "information-heavy", before any recommendation | Two questions, then the plan (Groups 25 to 30). Everything else is on "Complete your profile", one at a time |
| "The freezing I experienced during testing" | The plan failing to be made: one generation per person since 5 October, and since 15 October a call over the AI's per-minute limit waits for a free slot instead of failing (Groups 15 to 19) |
| "Several stages present many choices, categories, visual elements, and customization options at once" | The goal step shows one area (Groups 9 and 20). **New**: the norms page, where the norms went when they left setup, shows one group at a time again with what is picked above |
| "The frequent use of emojis, bright colours, and game-like visual elements" | A slim progress bar since 5 October; the design guide and the emoji audit (Groups 15 to 19). **New**: the look options in Settings use plain icons |
| "A generic or template-like appearance" (slide 15, an alternative they did not choose) | The design guide ([design-guide.md](design-guide.md)); a designer is for the team |

### Their recommendations (slides 7 to 10)

| They recommended | Now |
| --- | --- |
| "Present essential questions first and move optional customization to later stages" | Done: two required questions; the rest asked in the app ([onboarding-questions.md](onboarding-questions.md)) |
| "Compare how many users complete onboarding and where users stop before and after the changes" | The report, by onboarding version |
| "Track whether users can successfully reach and open their recommended resources and Life Paths" | "Reached something useful" and time to first value (Group 10) |

## Group 10

| They recommended (slides 2, 5 to 11 and 13) | Now |
| --- | --- |
| Welcome, user type, immediate goal, a useful path | Setup's two questions; Start here without an account |
| "Micro-prompts: deeper preferences when relevant" | "Complete your profile", one question at a time, each saying what it changes |
| "Check-ins: adjust path with feedback and engagement" | Since 5 October each answer that is a problem offers a change. **New**: the day-3 check-in, with "I'm not sure what to do next", which offers just the next step and what things are called |
| "Audit current onboarding questions: essential now, useful later, or optional" | [onboarding-questions.md](onboarding-questions.md) |
| Risk 2, "Users may not know whether to start with resources, pathways, community, AI, or support" | Setup's first question decides where people start; **new**: a first action for each kind of person after setup (Group 14) |
| Siblings and connected users (slide 4) | "Another family member (for example a sibling, partner or parent)" in setup |
| Success measures: completion, time to first value, 7 to 14 day return, path engagement, drop-off points, feedback (slide 11) | All in the report |

## Group 11

Every one of their proposals 1.1 to 3.4 is in the app
([first-visit-to-return.md](first-visit-to-return.md)). Going back over them:

| Their proposal | Found on 15 October | Now |
| --- | --- | --- |
| 1.4 "A short visual tour on the homepage" | The four screenshots were out of date | Retaken, one at a time (Group 12), and a script to retake them |
| 1.6 "Show proof of impact" | "So far in the beta" is hidden until the trial has measured something | Unchanged: it shows when results are added (for the team) |
| 1.7 Testimonials, 1.8 podcasts | Both are built and hidden: no story is published and no episode exists | For the team, below |
| 2.2 "Need a break?" with an email reminder | Up to three reminders now, each with finish now, later or stop (Groups 20 and 24) | Unchanged |
| 3.2 Reminders by text | Built; off because Twilio is not set up | For the team |
| 3.3 "A 'how to use the app' video and starter checklist" | The video's narration says "Replay the tour any time from How it works, in the top bar"; on a phone that button is "Guide" | The recording stays (its captions must match it); for the next recording |
| 3.3 The checklist "in the one-card slot" | Since 12 October "Complete your profile" showed beside it | One card at a time again |
| 3.1 and 3.4 GA4 events | Built; off until a measurement ID is set | Unchanged; the app's own events cover the report |
| "One main action per screen" (slide 20) | The Path broke it (above) | Fixed; setup's skip line is smaller than its main button too |

## Group 12

### What they found (slides 2, 5 to 7)

| They found | Now |
| --- | --- |
| "There is no as such 'Start Here' feeling on the website" | The app's home page opens with "Find starter resources": Start here, two taps and no account (Groups 4 and 24). The website, www.autinerary.ca, is for the team |
| "Not able to successfully create an account after multiple attempts" | Sign-up is one screen (Groups 25 to 30), and signing up on a phone and a laptop is a release check ([release-checks.md](release-checks.md)) |
| "It isn't immediately clear how Autinerary differs from established providers like Geneva Centre for Autism or Autism Ontario" | **New**: the home page answers it, and says their services are in ResourceHub |
| They "present clearly structured programs by age group and need right away" | **New**: Start here asks the age of the person someone supports, and orders the list and the kits by it |
| "Onboarding doesn't currently offer flexible pacing or content broken into manageable steps" | Setup asks how much energy there is today and stops at the essentials if it is low (Group 23); Start here first; a look inside one screen at a time |
| "A few features and links do not work" (slide 13) | **New**: every page of both apps checked on 15 October, signed out and signed in, at desktop and phone sizes: 124 page loads and 274 links, no broken link to our own pages and no button that does nothing (`scripts/qa/check-links.mjs`, now with the pages added since 4 October). Two outside links are dead (above) |
| "Users knowing members of the Autinerary team have experienced autism would be more inclined to trust" (slide 13) | "Who makes Autinerary" on the home page, in the team's own words (Group 15) |

### Their recommendations (slides 2, 10 to 12 and 14)

| They recommended | Now |
| --- | --- |
| "A short, guided demo paired with a more flexible, self-paced onboarding flow, allowing one to choose what they want to explore" | **New**: a look inside, one screen at a time, the visitor's choice of which and when. With the two short videos and Start here, all before an account |
| "Prompt users at sign-up to pick their focus group (parent, educator, individual)" | Setup's first question, "Who are you here for?" |
| "... and automatically unlock 14 days of tailored premium AI and community features" | Not done: nothing is paid (below) |
| "Trigger quick micro-surveys on Day 3 and Day 7" | **New**: the day-3 question, and "Is it useful so far?" from day 7 |
| "How many users went through the demo, where it drops off" (slide 12) | **New**: in the report |
| "If they visit social media outlets" (slide 12) | Arrivals from each channel are counted ([campaign/README.md](campaign/README.md)); visits from the app to social media are not followed |
| "Launch this demo as part of Autism awareness month in October" | For the team |
| "Defining an actual product" and a pricing structure (slides 12 and 13) | Free during the beta; paid extras may come later, mainly for organisations ([free-and-paid.md](free-and-paid.md)) |

## Group 13

### What they found (slides 2, 6 and 8)

| They found | Now |
| --- | --- |
| "Big blocks of text creating a blockade for new users", on the home page and in the Norms and Goals sections | **New**: the two longest paragraphs on the home page and the goal step's opening are shorter (above). The norms are not in setup any more; the norms page's longest paragraph is 22 words |
| "Loading the customized profile" at the end of setup | The plan failing to be made (Group 9's freeze): fixed 5 and 15 October |
| "About 50% of the screen is taken up by the progress bar form section completion", scrolled past "each time they submit a section" | **New**: measured on two phones and shortened (above); the next step now opens at its card |
| "Inconsistent sizing of each section of the onboarding interface" on a phone | Measured on 390 and 375 pixel phones: every part of a step has the same width and left edge |
| "The progress bar may cause irritation due to its misalignment and inconsistent tracking" | Two steps, and the bar moves only when the step does (Groups 9 and 17) |
| The character creator "should definitely be something optional" | Not in setup since Groups 25 to 30: a default character until someone designs one, where it is used |

### Their recommendations (slides 8 to 12)

| They recommended | Now |
| --- | --- |
| "Remove extras and make them part of profile set up" | "Complete your profile" |
| "A simple and clean layout which rewards a users progress" (slide 6) | A step's circle turns into a tick, and "About you is done. This is the last question." (Group 29) |
| "Onboarding ... as if it is a quiz with a question presented and only 4-7 options displayed" | Setup's questions are buttons with three to seven answers; the seven for "Who are you here for?" are in three short groups |
| "Label the buttons clearly and provide a explanation for why personal information is being requested" | "Why we ask:" under each question (Group 28); buttons named for where they go (Group 33) |
| "On the homepage, provide clear instructions and include one main action" | One filled button on the first screen, "Find starter resources", with "Create your free account" beside it as an outlined one |
| "Make the sensory preferences clear from the beginning" | Display on the first screen of the home page, sign-up and setup (Group 22), now with Soft colours |
| "Test the revised messaging with users"; "keep record of users' onboarding completion, the rates at which they abandon ... and their feedback on the clarity" | The report by version, and "Was making your account clear and quick?" after setup (Group 25) |
| A dedicated UI tool such as Figma; "work with those with neurological conditions to design and improve UI" | For the team |
| "Incentives like a sticker" for referrals | Not done (below) |

## Group 14

### What they found (slides 2 and 7)

| They found | Now |
| --- | --- |
| "The current onboarding has 9 steps with many options and a lot of information at once" | Two steps |
| "The onboarding progress indicator remained on 'Step 1 of 9' during testing instead of updating" | "Step 1 of 2", then "Step 2 of 2" (checked); the rail ticks each step off |
| "Some text is difficult to read and colours can feel too bright" | Display: Soft colours, dark mode, high contrast, text size; darker text across the app (Groups 31 to 34) |
| "Images and text are not always aligned" | No one place was named; setup's parts were measured on two phones and line up |
| "Navigation is not straightforward" | A named top bar, "Your plan" tabs, All places and a Back that never loops (Groups 31 to 33) |
| "After creating an account, the interface can also feel crowded" | The Path's simple view; **new**: one card at a time again |

### Their recommendations (slides 9 to 12)

| They recommended | Now |
| --- | --- |
| "Who are you? What matters most to you? Here's your first action." | Who you're here for, one goal, then "Start here" after setup |
| "Parent: Save a useful resource" | The starter kits, whose places can be saved |
| "Neurodivergent Adult: Explore or join a community thread" | **New**: Tidbits first |
| "Educator: Preview a toolkit" | ResourceHub's search, to find tools and services to recommend. A toolkit for educators is for the team to write |
| "Consider accessibility options such as dark mode or reduced brightness" | Dark mode and Soft colours, in the app and now in ResourceHub's own settings |
| "Users do not need to learn everything during onboarding. They can be introduced to features as they use the app" (slide 5) | The Path starts in its simple view and offers more from the second day of use (Group 6); each page has a short guide under "How it works" ("Guide" on a phone) |
| "Too many customization options could create more complexity" (option 3) | Display keeps to a handful (light or dark, contrast, soft colours, calm motion, text size, how lively); the rest are in Settings |
| "Track onboarding completion, where users leave onboarding, whether users complete their first action, and which features they use afterward" | The report: setup by step, Group 15's day-1 markers by who people are here for, and features used in each of the first four weeks |

## Not done, on purpose

- **A 14-day premium trial (Group 12).** Nothing in Autinerary is paid, so
  there is nothing to unlock: everything is free during the beta
  ([free-and-paid.md](free-and-paid.md)). A look inside and Start here are the
  "low-risk, low-commitment way to experience value early" they asked for.
- **A/B tests (Groups 11 and 13).** About 50 people are in the beta; split in
  two, neither half could show a difference. Each change gets a new onboarding
  version and is compared before and after.
- **Stickers for referrals (Group 13).** Autinerary does not post things to
  people or ask for addresses; they noted it "would need more testing".
  Sharing a Start here list is counted, as are visits from shared lists.
- **A 3-step setup in the app as well (Group 8's flow, for the app).** The
  app's setup is two questions, and Start here gives a first resource in two
  taps without an account.

## For the team

- **STEP 76** (`backend/database/migrations/2026_early_checkin.sql`) lets
  check-in answers be the day-3 kind, with "It's going well" and "I'm not sure
  what to do next". Apply it after STEPs 72 to 74. Until then the day-3
  answers are kept as text and counted.
- **Outside links.** Revera Grand Wood Park's website (`reveraliving.com/en`)
  is gone; check the residence and update or clear the website in
  ResourceHub's admin. A plan made before 5 October can list Sir Isaac Brock
  Public School's old address among its suggested tools; a new plan has the
  current one.
- **The screenshots and videos.** Retake the screenshots with
  `scripts/qa/preview-shots.mjs` when the Path, a step, the Calendar or
  ResourceHub's home change. The next recording of "How to use your Path" can
  say "Guide" for phones.
- **Built and waiting.** Reminders by text (Twilio), Google Analytics (a
  measurement ID), "In their words" (a published story), podcast episodes, and
  "So far in the beta" (measured results): how to switch each on is in
  [first-visit-to-return.md](first-visit-to-return.md).
- **Autism Awareness Month (Group 12).** October: a good time for the
  campaign to point people at the home page's look inside and Start here.
- **The feedback form for Western's neurodivergent clubs (Group 8).**
  `https://forms.gle/hRNpUKtBsA8B8RacA` was sent and not answered; they say it
  "can be reused". Its answers would add to the beta's.
- **A designer and Figma (Groups 9 and 13),** working with neurodivergent
  people (Group 13), as Groups 16 and 18 asked too.
- **A toolkit for educators (Group 14).** The two starter kits are for
  parents; one for people who teach or support someone at work would give
  them a first action of their own.
- **The website, www.autinerary.ca (Group 12's "Start here").** The app's
  home page has one; the website could link to it.

## Checks

- `scratchpad/browser/g8.mjs` (local build, real backend; 57 checks).
  Signed out: a look inside one screen at a time, by click and by keyboard,
  counted only when opened; the Autism Ontario question, and both
  organisations found in ResourceHub; Start here's age question for a parent
  and not for yourself, the kits' order for each age and none for adults, the
  answers counted; ResourceHub's sign-up link, its header at 320 pixels, and
  its profile coming back after sign-in. As the QA account: the look options
  without emoji; the norms page one group at a time, by mouse and keyboard;
  Soft colours reaching ResourceHub and turning off; ResourceHub's own
  settings applying at once and staying. A throwaway account, deleted at the
  end: setup on a phone (the first question on screen, the skip buttons on
  one line, "Continue" opening the goal step with focus on its heading, "Step
  2 of 2", the AI helper after the ideas); the events' version; the first
  action for yourself; the Path's one card and the tour's note; the day-3
  answers kept (as text before STEP 76); ResourceHub's role from the app, the
  location removed, and the role left as it was.
- Every earlier browser suite on the local build (`run_all_local.sh`), and
  the accessibility checker with every page of both apps, signed out and
  signed in (86 page views, nothing serious).
- `scripts/qa/check-links.mjs` on the local build: 124 page loads, 274 links.
- The backend's tests (435, in a copy without keys) and the app's library
  tests, with `lib/checkinDue.test.mjs` (when each check-in is due) and
  `lib/startHere.test.mjs` (the age question) new.
- **On production** (02594b1, 15 October 2026), after Render and both Vercel
  projects deployed and CI passed on both repositories: g8 57/57, g15 70/70,
  g31 43/43, g31b 34/34, g25 72/72, g20 77/77, Races 2/2, and the
  accessibility checker with every page of both apps, ResourceHub signed in
  included: 86 page views, nothing serious. Each throwaway account was
  deleted, with its check-in answers.
