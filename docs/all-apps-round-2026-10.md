# The All Apps round (October 2026)

The team's notes for this round:
- **Info Mode** and **All Apps**: welcome emails, Eliyana's question, a
  gamification review, the sky, and an audible site.
- **A trusted adult** approving an account, as a paid feature.
- **Onboarding**: sections in any order, speaking and non-speaking,
  personality, goal and dream examples.
- **Dream Self**, **spirit animals**, and **AI recommendations**.

This page says what was built, what is switched off and why, what needs
someone on the team, and the answers to the questions the notes asked.
Written 19 October 2026.

Several notes describe setup as it was before 12 October, when it became two
steps. Norms, the Dream Self and spirit animals moved to "Complete your
profile" then, and the old AI-recommendations step was dropped. Each note
below is matched to where that feature lives now.

The database change is **STEP 84**
(`backend/database/migrations/2026_trusted_adults.sql`, at the end of
`setup/all_migrations.sql`).

- It was tested locally: 13 checks, `.qa-local/pgtest/step84_test.py`.
- It is **not pasted yet**, and only trusted adults (off) use it.

## What needs someone on the team

| What | Where | Why it waits |
| --- | --- | --- |
| Paste STEP 84 | [2026_trusted_adults.sql](../backend/database/migrations/2026_trusted_adults.sql) | Migrations are pasted by the team |
| Send the welcome email to the 58 people who finished setup before it existed | The app's `/admin/emails` (team only): it shows the count and asks twice | It emails real people |
| Turn on trusted adults for under-18s | `NEXT_PUBLIC_TEEN_REQUESTS=on` in the app, after the terms and privacy page say how under-18s join | Under-18s' accounts are a legal question first |
| Answer the questions below | Eliyana, Madhureema, Odosa | Product decisions |

## Info Mode

The ? button with its title was already in the app's top bar, and its Info
and Info + Action modes behaved the same. Now each mode is distinct:

| Mode | First click | After that |
| --- | --- | --- |
| **Action** (to start) | Acts | Acts |
| **Info** | Says what it is ("Tap it again to use it") | The next click on it acts; then it explains again next time |
| **Info + Action** | Says what it is, the first time only | Acts with one click from then on (remembered on this device) |

- **The cycle:** Action, Info, Info + Action, then back to Action.
- **Hear it:** every explanation has a "Hear it" button.
- **All Apps:** ResourceHub has the same ? button, in its navbar, with
  descriptions on its links (`servicehub-mvp/lib/infoMode.ts`).
- **Kept in step:** CI checks that the two apps' copies stay the same.

## All Apps

### Welcome emails

The welcome email is sent once, after setup, and works: the three people who
finished setup from 1 to 8 October each got one. No one new has finished
setup since. **58 people** finished setup before it existed and never got
one; 4 have.

The team-only page `/admin/emails` shows that count and sends it to each of
them, once, after a second "Yes, send". Nothing has been sent.

### Eliyana: "has this gotten easier?"

**Yes, the first steps have.** Since 12 October:
- **Setup** is two steps (who you're here for, and one goal).
- **The Path** opens in a simple view: your next step, four Quick Links and
  one card.
- **The extras** (norms, Dream Self, spirit animals, and now personality)
  come later on "Complete your profile", one at a time, and none is
  required.

**What the numbers say (4–19 October):**
- Nobody has opened their first step yet.
- Nobody finished the tour (11 started, 2 closed it early).
- The "Complete your profile" card was shown twice and answered by no one.

So people still don't get from the plan to doing something. These are very
small numbers; see the [gamification review](gamification-review-2026-10.md).

**Suggestions:**
1. **After setup, open the first step itself**, not the Path overview. One
   tap less, and the next thing to do is the only thing on the screen.
2. **Introduce people later.** Hare World matching (friends, mentors, role
   models) could show from day 7 or after a first finished step, like
   spirit animals.
3. **One new idea a day**, the way "Complete your profile" already works: the
   roadmap on day 1, the calendar on day 2, people on day 7.
4. **Info Mode** for "what is this?" at the moment someone wonders, rather
   than a tour up front.

None of these is built; they change how the app unfolds, which is the
team's call.

### The gamification review

See [gamification-review-2026-10.md](gamification-review-2026-10.md):
- how fun each part is;
- where people drop off;
- what is real and what is only decoration.

### The sky, fully adjustable

In Settings → Accessibility, and the Display panel:

- **Sky:** Night, Dusk, Cloudy, Day or Bright.
  - **Night** is a deep sky with stars (stars can be turned off).
  - **Bright** is the daytime sky with more colour.
- **Clouds:** on or off.
- **Cloud colour:** from blue and pink (as designed) to white and grey.
- **Night and dusk turn on dark mode**, so the words stay light on a dark
  sky. Going back to day turns it off again (if the sky turned it on). On a
  device where dark mode is off, night shows as a cloudy day rather than
  dark text on a dark sky.
- **The usual sky draws nothing new:** someone who never touches it sees the
  same page as before.

`lib/sky.ts` and `components/SkyBackdrop.tsx`, tested in `lib/sky.test.mjs`.

### An audible app

**How do you see the screen?** A new question at the top of Settings →
Accessibility: no changes needed, low vision, or blind.

- **Low vision or blind** turns on, at once and out loud:
  - **voice commands**;
  - **Listen to this page**;
  - **spoken descriptions** of whatever you click or focus, unless you tick
    "I use a screen reader", which already says them.
- **Nothing is turned off** by this question.

**Voice commands** (the microphone in the top bar), rewritten:
- It **keeps listening** while it's on, instead of one command per press.
- **What you can say:**
  - "go to calendar", "go to my next step", "open ResourceHub", "open
    Tidbits";
  - "go back", "scroll down", "scroll to the top";
  - "read this page", "stop", "where am I";
  - "click" and any button's or link's name;
  - "search for" anything (ResourceHub's search);
  - "ask" a question: the assistant answers, and the answer is read aloud.
- **"Help"** says the whole list.
- **Tests and privacy:** the parser is tested in `lib/voiceCommands.test.mjs`.
  The privacy page now names the browser's speech service, which hears what
  is said while the microphone is on; Autinerary keeps no recordings.

## A trusted adult approves an account (off; STEP 84)

A parent or legal guardian could already add a child from their own account
(the Family page). Someone under 18 who tried to sign up was turned away.

**Now:**
- **Signing up:** with `NEXT_PUBLIC_TEEN_REQUESTS=on`, someone under 18 can
  name a trusted adult. The adult must already have an adult account.
  - The teen's account is made **locked**, and the adult gets an email.
  - The answer is the same whether or not that email has an account, so it
    can't be used to find out who has one.
- **The adult decides:** they sign in and see the request on the Family
  page, with the teen's name, email and age.
  - To approve, they say whether they're the **parent** or **legal
    guardian**, and tick that they reviewed the details and agree.
  - Approving links the accounts and unlocks the teen's. Declining leaves it
    locked; nothing is deleted.
  - The teen gets an email when they're approved.
- **A paid feature:** once paid plans are on, approving a teen or adding a
  child needs a plan, free access or the team. Until then it's free, like
  everything else.
- **Who can read a request:** only the teen and that adult. Only the server
  writes, after checking both ages.

**Before turning it on:**
1. Paste STEP 84.
2. Have the terms ("Who can use Autinerary") and the privacy page say how
   under-18s join and what is kept.
3. Run `.qa-local/browser/step84_live.mjs` (see Checks).

## Onboarding

- **Sections in any order, and what's missing:** done already.
  - Setup's two steps can be opened in any order from the rail, and a
    missing one is named with a link to it.
  - "Complete your profile" has "See all", with every question, done or not.
  - Personality joins that list.
- **Verbal or non-verbal:** see
  [Madhureema's question](#madhureema-autism-only-or-a-whole-category).
- **Goals and dreams examples:**
  - Education's goal example is now "Graduate", and its dream example
    "graduating".
  - Healthcare & Wellness: "Eat healthier" and "eating healthier".
  - Every area has its own dream example.
- **Dream for yourself too:** someone here for a child, friend or family
  member can tick "I have a norm too", and their own dream is asked as
  well. Yours comes first and theirs second, except for a parent or
  guardian, where theirs comes first.

### Madhureema: autism only, or a whole category?

**A whole category, asked of everyone.** People don't speak, speak a little,
or speak only some of the time for many reasons: autism, but also apraxia,
cerebral palsy, Down syndrome, selective mutism, or a stroke. A plan needs
to know either way: a step that needs a phone call or a spoken interview
doesn't work for someone who doesn't speak.

**Built:**
- "How does communication work?" in the norms and support profile, for
  everyone, with four answers:
  - **Speaks**;
  - **Speaks some of the time, or a little**;
  - **Doesn't use speech** (AAC, sign, writing, pictures or gestures);
  - **Prefer not to say**.
- "What helps" (an AAC app, sign, typing) when they don't speak or speak a
  little.
- **The planner gets it:** every step must work without speech, and no
  phone calls or spoken interviews are required.

**The words:** "non-speaking" and "minimally speaking" rather than
"non-verbal". Many people who don't speak use language every day, by AAC,
sign or writing, and many autistic people prefer these words.

## Personality, optional

- **A new item on "Complete your profile":** "Your personality (optional)",
  at `/profile/personality`.
  - **The statements:** twenty short statements (the Mini-IPIP), any of
    them skippable, with "Not for me" (which also counts as answered).
  - **The result** comes in plain words, for example "Where your energy
    comes from: recharges with quiet and time alone".
  - **A type label:** a four-letter type can be added, as a label only.
- **How it changes plans:**
  - New plans get a "working style" written from the answers, such as solo
    steps first, short steps with reminders, or a plan for harder days.
  - Where an answer meets a norm, they say how the two shape steps together.
    For example, autism and a quieter style: small, predictable social steps
    with a script or an online option first.
  - **A personality is never guessed from a norm.**
- **Monitoring (the agent):**
  - Pattern Recognition now matches people on their norms and personality
    together.
  - `backend/scripts/personality_norm_report.py` describes each group of a
    norm and a personality level (only groups of 10 or more): how many have
    a plan, and steps done.
  - Today: fewer than 10 people have answered, so it shows nothing yet.

### The answers the note asked for

**Which list of personality categories?** The **Big Five** (extraversion,
agreeableness, conscientiousness, emotional sensitivity, and openness).

- **The research uses it:** it is the model the research on personality and
  norms uses.
- **It's free:** the 20-statement Mini-IPIP version is in the public domain
  ("The items and scales are in the public domain … one can copy, edit,
  translate, or use them for any purpose without asking permission and
  without paying a fee", [ipip.ori.org](https://ipip.ori.org/)). We use it.
  The longer BFI-2 is for non-commercial use only
  ([its authors' page](https://ocf.berkeley.edu/~johnlab/bfi.html)).
- **Four-letter types** (INTJ and the like, from the Myers-Briggs) are
  popular but less reliable. Critics report that a small change on a retest
  can flip someone's whole type, because the test sorts continuous traits
  into categories
  ([a measurement critique](https://casrai.org/psychology-research/mbti)).
  The publisher [defends it](https://myersbriggs.org/research-and-library/validity-reliability/).
  "INTJ-P" isn't one of them: the suffix used is -A or -T.

**Are there established personality × norm connections?** Some, as
averages across groups. They say nothing about one person:

- **Autism:** a meta-analysis of 14 studies (Lodi-Smith and colleagues,
  *Autism*, 2019) found autism and autistic traits linked to lower levels of
  every Big Five trait. The largest difference was in extraversion, and the
  smallest in conscientiousness
  ([the paper](https://journals.sagepub.com/doi/full/10.1177/1362361318766571);
  [summary](https://www.canisius.edu/node/1712)). Studies of openness
  disagree.
- **ADHD:** a meta-analysis (Gomez and Corr, *Clinical Psychology Review*,
  2014) found ADHD, especially inattention, linked to lower
  conscientiousness and higher neuroticism; extraversion and openness
  weren't consistent ([the paper](https://openaccess.city.ac.uk/15859)).

That is why the app uses each person's own answers and never fills one in
from a norm.

**Supervised or unsupervised learning?** **Unsupervised first.**

- **Why:** there is nothing to learn from yet. Few people have answered,
  and plans take weeks to show outcomes.
- **Now:** Pattern Recognition's similarity search and the group report are
  both unsupervised: they find and describe groups without labels.
- **Later:** once enough plans have outcomes (steps done, milestone
  ratings), the same groups become the labels for a supervised model of
  which ways of writing steps help whom.
- **The privacy floor stays:** groups of 10 or more.

## Dream Self

- **Dreams for the person you support:** for someone here for a child,
  friend, family member or the person they support, the Ideal Self page
  has "Dreams for …", with:
  - where you see them;
  - how you'd like things to be between you;
  - their Dream Self look, made with the same editor as your own character.
- **Order:** theirs comes first for a parent or guardian, and after yours
  otherwise.
- **No AI pictures:** "Replace the AI image generation with the
  customization of look" is done.
  - The look editors are the only way now, and AI pictures are switched
    off (the route answers "gone" and never calls OpenAI).
  - Earlier pictures stay stored but aren't shown.
  - The privacy page no longer says OpenAI makes them.

## Spirit animals

- **One choice decides how many:** one, two (fast and slow days) or seven
  (the week). The separate count and mode caused both bugs in the note.
- **The labels:**
  - One animal is just "Choose your spirit animal".
  - Fast and slow are always (1/2) and (2/2).
  - The week is always (1/7) to (7/7).

## AI recommendations

- **"This straight up doesn't work":** the suggestions came from the first
  500 places in the database, in no order, out of about 36,000 (mostly
  Ontario's open data). They rarely included the services checked by hand.
  - They now come from the **757 checked services** (534 of them free) and
    everything people have rated.
- **"Populate the data with more synthetics":** not needed, and best not.
  - The 521 ratings in the database sit on 105 resources, 104 of them
    rejected demo listings, so they never helped.
  - Made-up ratings would mislead people. Real ratings come from the "Help
    us rate" page and the monthly sweep.
- **Free first, then the cheapest (Chi):**
  - Each step's best matches are ordered free, then by price, then cost
    unknown. The agent never swaps in a worse match to do it.
  - Suggestions show "Free" or the price, and the suggestions page sorts
    "Free first" by default.
- **"Welcome to Dreamland" at the beginning:** that screen is now "Opening
  your Path", and shows only after the plan is made.

## Checks

| Check | Result |
| --- | --- |
| STEP 84, locally (`.qa-local/pgtest/step84_test.py`) | 13/13 |
| Backend unit tests (new: personality matching, free first, the personality report) | 443 pass |
| The app's unit tests (new: personality, sky, voice commands, Info Mode, spirit animals, vision) and ResourceHub's | pass |
| The two apps' shared code (sponsored listings, Info Mode) matches | pass |
| Types, lint, production builds of both apps | pass |
| This round's browser suite (`.qa-local/browser/plan16.mjs`) | 31/31 locally, and **31/31 on production** (7b0124e) |
| STEP 83 on the live database (`step83_live.mjs`) and the Tidbits suite on production with it (`plan15.mjs`), again after this round | 26/26, and 37/37 |
| Accessibility, signed out and in, phone and desktop, with this round's pages (personality, norms, Ideal Self, suggestions, Family) | 108 page checks on production, none serious or critical (the suggestions page's sort menu had no name; fixed) |
| STEP 84 on the live database, once pasted (`.qa-local/browser/step84_live.mjs`) | Ready; it stops before the paste and writes nothing |
