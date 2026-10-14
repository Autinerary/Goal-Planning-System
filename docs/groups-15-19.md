# Riipen Labs Groups 15 to 19, September 2026

Five Riipen Labs reports from September 2026, all about the first visit:

- **Group 15**, "Onboarding & First-Time Experience Strategy": a research
  plan with personas for each kind of person, the five ways people arrive
  (Facebook groups, TikTok, Reddit, X, in person) and what each expects,
  success markers for the first 7 to 14 days, emails on days 1, 7 and 14,
  a usability risk map, and language principles: let people choose
  identity-first or person-first, no deficit framing, calm copy.
- **Group 16**, "Onboarding and First-Time Experience Optimization": setup
  took one tester over 30 minutes, the screen after setup "does not explain
  what a path even does", the colours are bright, and the AI notes after
  setup are scattered. Fewer steps, fewer colours, colour options, the AI
  apart from ResourceHub, and which colour options people choose.
- **Group 17**, "Customer Experience Brief": unclear goal questions ("dream
  for the other person", "ideal relationship with ally"), the biggest-dream
  question before trust is built, "norms" never explained, "Cluster A, B
  and C" with no plain words, and the bunny cut off at the edge of setup's
  progress rail.
- **Group 18**, "Beyond the Tech: Building Trust in Neurodivergent Digital
  Onboarding": the app looks "visibly AI-generated", with "heavy emoji
  usage", features labelled "AI recommendations", a long survey before any
  use, and a "Too many requests" error at the last step of setup. Say AI
  only where it works, a visual audit and a design guide.
- **Group 19**, "Team 19": too many features at once, "milestone" and
  "path" never defined, small icons, and the ADHD and autistic experiences
  compared separately.

They tested the app in September, when setup was nine steps. By 12 October
setup was already two questions with the rest in the app (Groups 25 to 30,
[groups-25-30.md](groups-25-30.md)), and the first visit was paced (Groups
20 to 24, [groups-20-24.md](groups-20-24.md)). This page says what
Autinerary does for each point as of 14 October 2026, slide by slide. The
onboarding version is now `clear-2026-10`, so the funnel report compares it
with `paced-2026-10`.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Words for autism and ADHD | The AI chose | Settings, **Words we use**: identity-first ("autistic person"), person-first ("person with autism") or no preference. The plan and the assistant write that way (`backend/core/llm.py`); the app's own pages say "neurodivergent" where they can. Start here tells allies, family and people who teach or work with someone to ask which words a person prefers |
| The first two weeks | One choice: a daily email about the next step, which stops after two weeks (Group 29) | A second choice, offered first: **three emails**, the day after joining, after a week and after two weeks, each from what the person did. Day 1 links to the step they are on; day 7 recaps what they did (days opened, steps finished, places saved, journal entries) with one thing to try in Tidbits; day 14 asks "Is Autinerary useful so far?", one tap and no sign-in. Only when asked for, with the words agreed to kept; between 10:00 and 19:59 where the person lives; never sent late; stopped in one click (`lib/firstWeeks.ts`) |
| The daily reminder | "Your goals for today 🎯 ... keep your streak going 🔥" | "Your next step for today ... Do as much or as little as fits today." |
| Asking for emails and notifications | On the page after setup, before anything had been used | From the day after joining, on the "Complete your profile" card, and always in Settings, under Emails |
| The questions after setup | Five at once | One, with the other four folded under "Four more about setup". "Where did you hear about Autinerary?" adds a support group or meetup, an event, and a doctor, therapist or clinician; a group, school or event can be named "so we can thank them" |
| AI labels | An "AI-Generated" badge by the plan, "AI suggestions for your steps", "AI Insights", sparkle icons | Named for what people get: "Suggestions for each step", "What stood out (written by AI)". One plain line where AI wrote something: "Your plan's steps were written with AI from your answers. How Autinerary uses AI". All places has a **Help from AI** group (the assistant, the suggestions, how AI is used), apart from people and places. The AI's notes after setup are folded under "How your plan was made" |
| Emoji and sparkles | 48 emoji and 18 sparkle icons on the screens people meet first | 14 and 5; the tour, the voice intro, the reminder email and notification, and setup use plain icons. The rules are in [design-guide.md](design-guide.md) |
| The app's own words | "Path", "milestone" and "norms" were never explained where they appear | "What is a path?" in setup, after setup and on the Path before a plan; "What is a milestone?" on the Path and after setup; "What are norms?" on the profile card. Each opens one line beside the word, the same as the glossary (`lib/terms.ts`, `components/Define.tsx`) |
| Setup's goal step | "Dream for the other person", "Ideal relationship with ally", "Obstacle", and "Beyond all your goals, what's your biggest dream?" | "What do you hope this leads to for them?", "How would you like things to be between you and them?", "What might get in the way?", with examples. The biggest dream is on the Ideal Self page, and the next plan still uses it |
| Who you're here for | One answer, with no word on people who are more than one | "More than one fits? Pick who this first plan is for. You can make another plan for the other later", in setup and Start here |
| Start here by where people came from | One welcome line each | Facebook and parent groups: a list to share with the group in one tap. Reddit: why we ask and where the lists come from, before the first question. X: a look at the app with a sample plan, no account and no email. TikTok and Instagram: two taps, no forms. In person: a welcome, and the chance to say who pointed them here. A shared list opens on the list |
| Sharing | None | "Share this list" on every Start here list (the phone's share sheet, or the link copied); counted |
| The home page | Nothing on who makes it | **Who makes Autinerary**, in the team's words from autinerary.ca, and what happens to feedback. A line that Autinerary is for people of every background, "including people of colour, women, LGBTQ+ people, newcomers and people on a tight budget" |
| Display | Light or dark, contrast, motion, text size | And **Soft colours**: every colour on the page less bright, emoji and pictures included, from the first moment of the page. Which choices people turn on is counted |
| The top bar on a phone | 16-pixel icons with 11-pixel names | 20-pixel icons with 12-pixel names, each control at least 44 pixels, on one row on phones 375 pixels wide and wider |
| Coming back | The Path always opened at the next step | "Pick up where you left off", to the page from the last visit (a step, the Calendar, a kit), kept only in that browser |
| A missing page | Signed out, it sent people to sign in | "This page isn't here", nothing saved is lost, and links to the Path, Start here and the glossary; counted as a navigation error |
| Tidbits | A Report button and pseudonyms | **Community guidelines**, readable before signing in: who sees a post, what moderators remove, how to report, content notes, who to call now. "Moderated by people on the Autinerary team" above the feed; "Before your first post" when asking; **content notes**: readers see the note and choose whether to open the post (after STEP 75) |
| "Cluster A, B and C" | The clinical names alone | Plain words under each, in the app and ResourceHub: "Unusual or withdrawn patterns", "Intense or changeable patterns", "Anxious or fearful patterns" |
| Making a plan | A call over the AI's per-minute limit failed the whole plan | It waits for a free slot, up to 75 seconds (`LLM_RATE_WAIT_SECONDS`), for a signed-in person. The limit is unchanged |
| The funnel report | | Group 15's success markers by who people are here for; display choices; setup and returns by norms (autism, ADHD, both); visitors who left from the first page; pages not found; the first two weeks' emails; lists shared and visits from them |

### Found and fixed while doing this

- **"Too many requests" was the AI's per-minute limit.** A plan is many AI
  calls in a row, and the limit refused one part way through, so the whole
  plan failed. 223 of the 296 plans asked for from 31 August to 9 October
  failed this way, all before 26 September and almost all with three or more
  goals (the Path Planning audit, 13 October). A signed-in person's call
  now waits for the next free slot instead; the daily limits, and people
  who are not signed in, are refused at once as before.
- **A missing page sent signed-out visitors to sign in**, which looked like
  a wall, not a wrong link. They now see the not-found page.
- **The QR code generator skipped channels whose names need quotes**, such
  as `in-person`, so no code was made for them. It reads them now; the X
  and in-person codes are in `docs/campaign/qr/`.
- **Setup's code held an unused list of roles with emoji**, from the
  nine-step setup. Removed.
- **Reset said it clears "your AI portrait".** It says "your Dream Self
  picture", which is what it is called everywhere else.

## Group 15

Group 15's deck is a research plan: "Every claim in this deck is either
grounded in Autinerary's own brief and public materials, or flagged as a
proposed hypothesis to validate." Each proposal is below.

### Who they designed for (slides 3 and 7 to 10)

| They proposed | Now |
| --- | --- |
| "A deliberate focus on intersecting identities: e.g. neurodivergent people who are also visible minorities, women, or LGBTQ+", who each "carry a different relationship to disclosure, trust, and community safety" | The home page says Autinerary is for people of every background, and "you choose what you share". Every question about identity and norms is optional (Groups 25 to 30) |
| The Self-Advocate: "Show me you actually get it, fast"; risks: "No clear signal of who built the product or with what lived input", "Community space feels moderated for optics rather than safety" | Who makes Autinerary; Tidbits' guidelines, moderation line and content notes |
| The Supporting Parent: "Tell me what to do today"; "who wrote this, is it current, does it apply to my situation"; by day 7, "found one immediately-useful action ... and saved or shared it" | Start here and the starter kits (Group 24), which say who wrote them, from which sources and when they were checked; **new**: share the list |
| The Ally: "I'm worried about saying the wrong thing"; by day 7, "one short, practical action (a language guide, a 'how to support' article)"; risk: "No easy way to get quick answers without a heavy sign-up commitment" | **New**: an ally's Start here list opens with "Worried about saying the wrong thing?": both forms are used, ask the person, and use the words they use. Start here needs no account |

### Where people come from (slide 12)

| Channel | They proposed | Now (`lib/campaign.ts`) |
| --- | --- | --- |
| Facebook groups | "Lead with a concrete, shareable first win" | "Two quick questions, then a short list of places to start that you can open now, and share with your group in one tap", and "Share this list with your group" at the top of the list |
| TikTok | "Match the video's energy in-app; no dry forms first" | "Two taps, then real places to start. No forms, and no account." |
| Reddit | "Show the 'why' and sourcing before asking for data" | Before the first question: "Why we ask, and where the lists come from": the answers only choose the list and stay in the browser; the lists are real ResourceHub listings chosen by fixed rules, not AI; the kits come from the Government of Ontario's pages; not advice |
| Twitter/X | "One-tap preview before any sign-up commitment" | "Look around first: no account and no email", with "See the app with a sample plan". Links use `utm_source=x` |
| In-person groups | "Let them name who invited them; personalize opening screen" | "Welcome. Someone you met in person shared this." Links use `utm_source=in-person`. After setup, "Which one?" names the group, school or event. People are never asked for a private person's name |

The questions stay the same for everyone: the cohort report asked for "the
same onboarding spine across channels", and warned that "channel should not
be used as a proxy for identity or need". What changes is the welcome and
one thing beside it.

### Success in the first two weeks (slide 13)

"Proposed success markers to validate through the funnel review":
the report's new section counts, for each kind of person, something useful
on day 1 (a step, a resource, ResourceHub or Tools opened, or a resource
saved), the app opened on two or more days in the first week, and opened
again in the second. Their day-14 marker for parents, "trusts the source
enough to share it in their own group", is counted as lists shared and
visits from them.

### The touchpoint map (slide 15)

| They proposed | Now |
| --- | --- |
| Sign-up: "ask only for role ... nothing else yet" | Sign-up asks for a name, a date of birth (for the age rules), an email and a password; setup's first question is who you're here for |
| Personalize: "Route by role and, where offered, by entry channel context (e.g. 'referred by a friend')" | By role since Groups 3 to 5 and 24; by channel, the welcome above, and "Someone shared this list with you" |
| Guided First Action: "One concrete task in under 2 minutes" | Start here's list after two taps, the kits, or the plan's first step |
| Day 1-2 email: "Confirms the win, links back to the exact spot they left off" | Day 1: "Pick up where you left off", with their goal and a link to the step they are on |
| Day 5-6 nudge: "a second, slightly deeper action tailored to their role" | Folded into day 7, to keep to the three emails they recommended (slide 20) |
| Day 7: "recap of what they've explored; invites a community action" | Day 7: the recap, and one thing to try in Tidbits, by who they are here for. In the app the Path already counts steps done |
| Day 14: "Asks for feedback and introduces the paid/expanded tier where relevant" | Day 14: "Is Autinerary useful so far?", answered in the email's link without signing in. On a paid tier it says what the home page says: everything is free during the beta, and paid extras may come later, mainly for organisations ([free-and-paid.md](free-and-paid.md)); people who teach or work with someone are asked what their organisation would need |
| "Amber markers = moments to A/B test first" | Not done, below |

### The usability risk map (slide 16)

| Risk | Now |
| --- | --- |
| "Value proposition isn't clear within the first screen" | The home page's first screen says what it is, who it is for and that it is free (Group 22) |
| "No visible signal of who built this and with what lived-experience input" | Who makes Autinerary, on the home page and in its "On this page" list |
| "Asking for too much information before demonstrating any value" | Two questions; one question after setup, four folded; no email or notification asks on the first day |
| "Role/focus-group selection is confusing, binary, or feels exclusionary" | "Not sure yet" is an answer; **new**: "More than one fits?" |
| "Content isn't tailored to the selected role" | Quick Links in the order that suits who you're here for (Group 32), a parent's plan about the child (Group 24) |
| "No obvious 'next best action'" | The Path's next step; **new**: "Pick up where you left off" |
| "No sensory/pace customization (density, motion, notification frequency)" | Density: Simplified View or Full View, and four looks. Motion: Calm motion. **New**: Soft colours. Display is on every page, before an account too. Emails: three, one a day, or none, in Settings |
| "Community space feels unmoderated or unsafe for a first post" | Guidelines, the moderation line, "Before your first post", content notes |

### Their recommendations (slides 20 and 21)

| They recommended | Now |
| --- | --- |
| "Role-based onboarding path" | Done (Groups 3 to 5, 24, 32) |
| "A 2-minute first win": "Guarantee one concrete, useful action before any friction (forms, upgrade prompts, notifications asks)" | Start here's list first; the email and notification asks moved off the page after setup (above) |
| "Milestone-based emails, not a newsletter: Day 1, Day 7, and Day 14 emails tied to what the user actually did" | Done (above) |
| "Visible safety signals in community spaces: Clear moderation policy, content warnings, and an easy report path, especially for first-time posters" | Done (above). Hare World's messages link the same guidelines |
| "Sensory/pace customization ... early" | Display before an account, with Soft colours (above) |
| "Channel-aware landing experiences" | Done (above) |
| "Let users choose identity- vs. person-first language" | Words we use (above) |
| "Avoid deficit-framed language": no "suffers from", "despite" | [voice.md](voice.md), rule 8; the app's copy was checked for both |
| "Plain language by default", "Predictable structure across pages" | voice.md rule 1; the definitions above; design-guide.md rule 8 |
| "Calm, non-manipulative UI copy: No countdown timers, guilt-based prompts, or artificial urgency" | voice.md rule 9; the streak and the 🔥 left the reminder; the two-week check-in notification says "and that's okay" |
| The six-week research plan: a heuristic walkthrough, a channel audit, moderated testing with "5+ sessions per focus group, including intersecting-identity participants", intercept surveys, a funnel review | For the team, below. The funnel review exists (`backend/scripts/onboarding_funnel.py`) |

## Group 16

### What they found (slides 2, 5 and 7)

| They found | What it was | Now |
| --- | --- | --- |
| "Account creation alone includes 9 sections"; "over 30 minutes to complete an in-depth profile" | Nine steps when they tested | Two questions since early October; the rest on the "Complete your profile" card |
| "The homepage with multiple navigation bars and tons of upfront content not hidden behind categories" | The Path's menus were merged into All places and Quick Links (Groups 31 to 33) | And Simplified View is the default |
| "The screen after setup ... does not explain what a path even does, and just has a button to create the path" | The Path before a plan | It says what a path is, with "What is a path?" |
| Skipping "seems [to affect] the future path creation" | Nothing was lost, but nothing said so | "Skipping setup lost nothing: answers you gave are kept on the device you used." |
| "Bright, vibrant icons which may not be friendly for certain individuals with specific needs/triggers" | Four looks, from Plain to Fun | And Soft colours, which makes icons, emoji and pictures less bright too |
| "The UI layout for the AI resources after the final setup step is overwhelming ... a note and some information, then a box of options, followed by more text" | Two AI notes after setup | Folded under "How your plan was made", with AI said plainly inside |
| The set-up steps are clearly laid out, with suggestions for most fields | | Kept: goal ideas for the area chosen |

### Their recommendations (slides 2 and 10 to 12)

| They recommended | Now |
| --- | --- |
| "Shorten account creation to a simple questionnaire" | Done (Groups 25 to 30) |
| Gather "more details later based on user behaviour rather than user input" | **New**: "Pick up where you left off" from the last visit. Quick Links follow who you're here for. Changing the plan from check-ins is on a branch, not live yet |
| "Separate the AI agent and resource hub into different sections" | All places: **Help from AI** is its own group; ResourceHub's places are in their own groups |
| "Adopt a drop down menu or applet option similar to programs like Google Workspace"; mentorship as "a separate applet" | All places is the one list of every place, on one level (Groups 31 to 33 found nested menus hard); Mentors is in it. Not a launcher, below |
| "Remove / move personalization options like avatars, icons, dream animal, and dream self to separate tabs" | Done (Groups 25 to 30): on the card, Your profile and the Ideal Self page |
| "Reduce colors and adopt a more simplistic / minimalist design philosophy"; "neurodivergent friendly colour schemes" | One accent colour (design-guide.md rule 4), the Plain look, and Soft colours |
| "Give different options for the UI design changes in terms of colours and display of app" | Display: light or dark, higher contrast, Soft colours, calm motion, text size, the accent colour, four looks, two views |
| "See which colour options are most popularly being chosen by users" | **New** in the report: each display choice, as the number of browsers that turned it on |
| "Monitor user flow, retention, and time spent on app" | Setup steps, returns and time spent in setup are in the report. Time on the app is not measured, below |
| "Consult design experts with experience in designing for neurodivergent users"; "Consult current beta testers" | For the team, below; the beta sessions ([beta-test-plan-2026-10.md](beta-test-plan-2026-10.md)) |

## Group 17

### What they found (slides 3, 5 and 7)

| They found | What it was | Now |
| --- | --- | --- |
| Onboarding "previously reached about 10 pages" | Nine steps | Two questions |
| "Errors in the icon (rabbit being cut off)" | The bunny on setup's progress rail was centred on its point, so half of it was outside the rail at the start and at the end | Kept inside the rail at both ends |
| "Misplaced buttons" | | One filled button per screen, named for where it goes (Groups 31 and 33) |
| "Dream for the other person" and "ideal relationship with ally" unclear | Setup's goal labels | Plain questions with examples (above). The answers are kept as before |
| Setup "front loads personal questions like 'Beyond all your goals, what's your biggest dream?' before trust is established" | The last question of the goal step | On the Ideal Self page, optional, "Only you see this"; the next plan uses it |
| "Undefined terms like 'norms'" | Norms left setup in October | "What are norms?" on the profile card, and in the glossary |
| Cluster A, B and C "are clinical shorthand most users will not recognize"; "keep the clinical terms visible but pair them with plain language" | | Done, in the app and ResourceHub (above) |
| The calendar's Low Energy, Balanced and High Energy days, and the character's choices, work well | | Kept |

### Their recommendations (slides 2 and 9 to 12)

| They recommended | Now |
| --- | --- |
| "A personalized branching survey based on user type" | Who you're here for decides what comes first and what the plan is about (Groups 3 to 5, 24, 32) |
| "Ask only essential questions at the start and move less important information to later stages" | Done (Groups 25 to 30) |
| "Clearer wording, consistent layouts, and clearer required or optional fields"; "definitions for unfamiliar terms" | Optional fields say "(optional)"; the plain goal questions and the definitions above |
| Test designs "with a limited number of new users, each design with its own testing group" | Not done, below; compared by version instead |
| "Perform a survey with each testing group"; see whether people "stay longer ... and have a higher return rate" | The questions after setup, and returns by version in the report |

## Group 18

### What they found (slides 2, 5 to 7 and 9)

| They found | What it was | Now |
| --- | --- | --- |
| Features "explicitly labeled as 'AI recommendations'", and "generic AI-prompted visual structures (such as heavy emoji usage and cluttered layouts)" | The "AI-Generated" badge, "AI suggestions", "AI Insights" and sparkles; setup's "AI Recommendations" step had already gone (Group 26) | AI named where it works, once (above); the emoji and sparkle audit (above) |
| "The current design choice for Autinerary is visibly AI-generated" | | The audit and the design guide; the game-like screens are next, with a designer (below) |
| "Customers need to identify if the platform is legitimate and safe before openly sharing sensitive information" | | Who makes Autinerary; the trust line ("We don't sell your information, show ads, or use it to train AI") |
| "A more explicit representation of intersecting identities" | | The home page's line (above) |
| A "quite lengthy" survey "presented immediately after signing in with no actual use of the product" | Five questions and two opt-ins after setup | One question, four folded, no opt-ins on the first day |
| "The platform front page, though opened in browser, failed to scroll during sign-up" | Groups 25 to 30 reported the same | Checked on production on 12 October at nine sizes: the page scrolls ([groups-25-30.md](groups-25-30.md)) |
| "A team member experienced a 'Too many requests' error during the final onboarding stage" | The per-minute AI limit | Fixed (above) |
| "A more positive focused position as opposed to a deficit focused resource" | | Kept, and written down (voice.md rules 2 and 8) |

### Their recommendations (slides 2, 10 and 12 to 15)

| They recommended | Now |
| --- | --- |
| Replace "AI recommendations" with "human-centered phrasing like 'personalized resource paths' or 'tailored guidance'", "introducing AI transparently only at the specific step where it functions"; "renaming 'AI recommendations' to 'personalized guidance'" | "Suggestions for each step", "How your plan was made", and one plain line where AI wrote something, linked to "How Autinerary uses AI". "Personalised" is not used: the page says what the suggestions are |
| Option 3, "Optimize Onboarding": "Simplify the signup journey and resolve technical friction" | The "Too many requests" fix; the shorter questions after setup |
| "Redesign the platform's UI to eliminate the generic AI 'vibecoded' aesthetic using a website builder (Wix, Squarespace, Wordpress)" | Not a website builder, below. The visual audit and the design guide instead |
| "Audit any elements ... to flag generic or AI template components (emojis, avatars, images)"; an "inventory of generic UI elements to be replaced" | The audit in [design-guide.md](design-guide.md): emoji and sparkles on first-visit screens before and after, and what stays and why |
| "Establish a design guide so any future features maintain the same feel" | [design-guide.md](design-guide.md), with [voice.md](voice.md) for the words |
| "Follow existing neurodivergent/cognitive design frameworks (W3C COGA, Microsoft Guide)" | The design guide links W3C's COGA guidance; `scripts/qa/check-accessibility.mjs` before a release |
| "UI/UX designer (on your team) to lead the redesign and visual audit" | For the team, below |
| "Conduct another evaluation with another cohort to score the updated app on its credibility, clarity, and visual appeal" | For the team, below |
| "Monitor bounce rates, user drop off at specific stages of onboarding, track time spent on site, measure conversion rates from new to active users" | **New**: visitors who left from the first page (the home page or Start here) without a second page or an account. Drop-off by setup step and new to active were already in the report. Time on site is not measured, below |

## Group 19

### What they found (slides 2, 5 to 9)

| They found | What it was | Now |
| --- | --- | --- |
| New users "encounter the full load of platform's features simultaneously ... with no staging" | Simplified View by default, one life area first (Group 20), the card one question at a time (Groups 25 to 30) | Unchanged |
| "The current 10-page personalization" | Nine steps | Two questions |
| "Terms like 'milestone' and 'path' are not clearly defined" | | Defined beside the word (above) |
| "The interface also uses small icons and navigation tools" | 16-pixel icons and 11-pixel names in the top bar on a phone | 20-pixel icons and 12-pixel names (above); the touch targets were already 44 pixels |
| "The intersection of neurodivergence with other communities, including visible minorities, women, LGBTQ+, newcomers, and economically vulnerable groups" | Being an immigrant or refugee, and limited income, were already norms people could share | The home page's line names them |

### Their recommendations (slides 2 and 11 to 15)

| They recommended | Now |
| --- | --- |
| "Staggered feature reveals": core features first, extra features "revealed later on for more experienced users" | Simplified View (the default, which never changes by itself), with "Show more" offered from the second day; Full View one tap away; nothing locked |
| Users "can choose between a simpler interface and something more detailed once they are used to the app" | Simplified View and Full View, in Display and Settings |
| "Start a test between different groups of users" | Not done, below |
| "Targeted focus group testing across different neurodivergent subgroups (those with ADHD vs autism)" | **New** in the report: setup and returns for people who shared autism, ADHD, both, other norms or none. The focus groups are for the team |
| "While new features are being integrated, navigation of them should be expressly communicated" | The page guide, under "How it works" (Group 23) |
| Success: "reduced time needed to complete tasks, more users completing the onboarding process, fewer navigation errors, increased completion of user actions, and positive feedback" | Time in setup, setup completion and steps done were in the report; **new**: pages not found. The day-14 "useful so far?" answers join the report's usefulness answers |

## Not done, on purpose

- **A/B tests (Groups 15, 17 and 19).** About 50 people are in the beta;
  split in two, neither half could show a difference. Each change gets a new
  onboarding version (`clear-2026-10`) and is compared before and after.
- **Rebuilding the app in a website builder (Group 18).** Wix, Squarespace
  and WordPress make websites; the app is a web app with its own server and
  database, which they cannot run. Their point, an app that does not look
  generated, is taken up by the audit, the design guide and a designer (for
  the team). The website, www.autinerary.ca, could use one.
- **A launcher like Google Workspace's (Group 16).** All places already
  lists every place on one level, and Quick Links put the most useful first;
  a second menu of the same places would be one more thing to learn.
- **Questions when a page is first opened (Group 16).** Setup asks two
  questions; the rest are on the "Complete your profile" card, one at a
  time, from the day each is useful (Groups 25 to 30). Every page can be
  looked at without answering anything first.
- **Time spent on the app or the site (Groups 16 and 18).** Measuring it
  means timing every page someone looks at. The report counts what people
  do (steps, returns, saves) and the time spent in setup.
- **Locking features until people want them (Group 19).** Nothing is
  locked: Simplified View hides, Full View shows, and the choice is one tap.
  They noted the risk themselves: "users who may want full control may feel
  frustrated".
- **A day 5-6 email (Group 15's touchpoint map).** Three emails, as their
  own recommendation said; the day-7 email carries the next action.
- **"Over 200 interviewees" (Group 17).** Group 17 credits Autinerary's own
  research with it, but it is not on autinerary.ca, so the app does not say
  it (voice.md rule 5).

## For the team

- **STEP 75** (`backend/database/migrations/2026_tidbits_content_notes.sql`):
  the content note on Tidbits posts. Until it is applied, posts are saved
  without a note and nothing else changes. STEPs 72 to 74 are on the agent
  branches, not yet merged, so this one comes next on main.
- **A designer (Groups 16 and 18).** Group 18: "a UI/UX designer ... to lead
  the redesign and visual audit"; Group 16: "design experts with experience
  in designing for neurodivergent users". The next pass is Races, Pit Stop
  and Hare World, which hold most of the app's 400 or so emoji
  ([design-guide.md](design-guide.md)).
- **Another evaluation (Groups 15 and 18).** Group 15's moderated testing,
  "5+ sessions per focus group, including intersecting-identity
  participants", and Group 18's "another cohort to score the updated app on
  its credibility, clarity, and visual appeal". Group 19's ADHD and autistic
  focus groups fit the same sessions; the report's new norms section gives
  the numbers to compare with.
- **Channel audit and intercept surveys (Group 15).** How each platform
  talks about Autinerary, and short surveys there before sign-up. The
  campaign's links already count arrivals by channel
  ([campaign/README.md](campaign/README.md)).
- **QR codes for in-person groups and X (Group 15).** `docs/campaign/qr/in-person.svg`
  and `x.svg`. Hand the in-person one to partner groups; whoever arrives
  through it is welcomed as someone met in person, and can name the group
  after setup.
- **The website, www.autinerary.ca.** Group 18's builder suggestion and
  Group 15's "who built this" both apply there too. The app's home page now
  quotes the About page, so keep the two in step. If the research behind
  "over 200 interviewees" is published there, the app can point to it.
- **SibChat (Group 15).** It is on the website, but nothing in this
  repository says where it lives or whether it is open. If it is, it can go
  in All places and in the day-7 email for siblings.
- **The day-14 email and paid extras.** It says what the home page says. If
  organisation accounts are planned, update [free-and-paid.md](free-and-paid.md)
  first, then the home page and the email.
- **The first two weeks' emails and CASL.** Like the setup reminders, they
  go only to people who asked, keep the words agreed to, name Autinerary
  Corp. with its postal address, and stop in one click or from any email.

## Checks

- `scratchpad/browser/g15.mjs` (local build, real backend; 76 checks).
  Signed out: who makes Autinerary and the identities line; no sparkles on
  the home page; Soft colours on at once, counted, and kept on the next page
  without moving fixed parts; the glossary's path, Words we use and
  community guidelines; each of the five doors in Start here; the role
  question's "More than one fits?"; sharing a list, and a shared list
  opening on the list; an ally's language note, and none on a parent's
  list; the not-found page, counted; ResourceHub's guidelines and its
  Cluster A words. A throwaway account: the bunny inside its rail; the plain
  goal questions; a real plan made with no "Too many requests", with Words
  we use sent; the calmer page after setup; the Path's AI line, "Suggestions
  for each step" and "What is a milestone?"; "Pick up where you left off";
  All places' Help from AI; no reminders asked on the first day, then both
  kinds, with the consent kept; "What are norms?"; Words we use, Soft
  colours and the biggest dream saved; the three emails rendered from what
  the account did; the email links (a bad signature refused, an open noted
  once, no way to another site, one-click stop) and the day-14 question;
  Tidbits' moderation line, content notes hiding a post until chosen, and
  the first-post notes. The account is deleted at the end; Tidbits data is
  mocked in the browser, never posted.
- Every local suite after the changes: Groups 20 to 24 80/80, 25 to 30
  72/72, 31 to 33 43/43 and 34/34, Group 34's eight suites (56, 75, 17, 10,
  5, 42, 27 and 11 checks, all passing), `races_default` 2/2, `loopguard`
  5/5, and the accessibility checker on every page: nothing serious. Six
  checks were updated for changes made on purpose (All places' new group,
  the home page's new section, "path" for "plan", the folded questions, the
  three emails offered first, Display's "colours"). The first run also
  found the top bar on two rows at 390 pixels with the bigger names; fixed
  above.
- The top bar on a phone, measured at 360, 375, 390 (at 1× and 2×) and 414
  pixels: one row from 375 up, every control at least 44 pixels.
- Backend: 346 tests, including `tests/test_llm_pacing_and_style.py` (the
  wait for a free slot, the daily limits and anonymous callers still
  refused, and both language rules) and the report's new sections
  (`ClearVersionTests`), in a clean copy with no secrets.
- Unit tests: `lib/terms.test.mjs`, `lib/campaign.test.mjs`,
  `lib/firstWeeks.test.mjs` and `lib/lastPlace.test.mjs`, and new cases in
  `lib/profileItems.test.mjs`.
- STEP 75 on a local Postgres: applied twice, and the check refuses a note
  outside the list.
