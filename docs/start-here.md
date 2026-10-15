# Start here

The guided first step on the home page, and on its own at `/start`. Built
from Riipen Labs, Group 4's "Customer Experience Optimization Report"
(September 2026), which recommended a role- and goal-based "Start Here"
that routes first-time visitors "to an appropriate first set of resources
and one clear next action" before they see the whole app.

## What a visitor sees

1. **Purpose:** "Find neurodivergent-friendly resources that fit your
   situation. Two quick questions, no account needed."
2. **Who are you here for?** Myself · My child · Another family member or a
   friend · Someone I teach, support or work with · I'm an ally, or just
   learning · Not sure yet
3. **What do you need today?** Starter information · Services · People with
   similar experiences · School or work support · Sensory tools · Not sure
   yet
4. **Their starter resources:** a title ("Starter resources for parents:
   services"), one plain-language explanation, 3 to 5 resources, a line
   saying these are not medical or clinical advice, and one primary action,
   **Save this path**. Then "Was this useful? Yes / Not really".
5. **Since Groups 20 to 24 (12 October 2026):** "Help right now" is a need,
   and shows who to call first. Parents, family and people who support
   someone see the two **starter kits** for Ontario (an autism assessment,
   support at school) above the resources. After the resources, **"Make this
   list fit you better: 3 quick questions, optional"**: where you are, how
   soon you need help, how you like to start. Each reorders the list or adds
   a note at once, and none hides anything (Group 21 asked for five
   questions; two come before anything is shown). See
   [groups-20-24.md](groups-20-24.md).
6. **Since Groups 8 to 14 (15 October 2026):** for parents, family and
   people who teach or work with someone, **"How old are they?"** comes
   first (Under 6, 6 to 12, 13 to 17, 18 or older), so there are four. It
   orders the list (schools and therapists first for the youngest,
   after-school activities for school ages, work for adults) and the kits:
   support at school first for 6 to 17, the assessment first under 6, and
   neither for 18 or older, since both are about children. An age answered
   for one role is not used for another (`refineQuestionsFor`, `answersFor`
   and `kitOrder` in `frontend/lib/startHere.ts`). Riipen Labs, Group 12:
   organisations like the Geneva Centre for Autism "present clearly
   structured programs by age group and need right away". See
   [groups-8-14.md](groups-8-14.md).

One question at a time, with the steps done and still to come shown above
it, and "Change" next to each answer. The home page's main button, "Find
starter resources", leads here; "Create your free account" is still next to
it.

**Save this path:** for a visitor, this is the free account. Setup then
starts with the same answers (who for, and the matching "What are you
looking for today?"), saves the path to the account, and the page after
setup opens with it. Signed in, it saves straight to the account. Either
way it reopens from **Quick Links > Starter resources** on the Path.

**After setup, for everyone** (Riipen Labs, Group 5: a personalized "Start
Here" resource right after the short start): people who signed up without
using Start here get a pathway picked from their setup answers. Who it is
for comes from "Who are you here for?". The need comes from "What are you
looking for today?" (services, community, learning), or else from the
goal's category (education or career: school or work; health: services;
relationships: people with similar experiences; norms: starter
information). It leads the page after setup when they came for something
other than a plan, and is listed after the Path otherwise.

## What each pathway shows

Everything comes live from ResourceHub, so names and counts stay current.
Searches anyone can open show how many places they find; shop items and
Tidbits are marked "Free account" for visitors.

| Need | Resources |
| --- | --- |
| Starter information | Autism, ADHD and support organisations · two books from the shop · Ask a question in Tidbits |
| Services | Autism, ADHD and support organisations · Therapists and counsellors · Doctors and health centres · Community centres and libraries |
| People with similar experiences | Ask a question in Tidbits · Autism, ADHD and support organisations · Community centres and libraries · Sports and activities |
| School or work support | Help with work · Autism, ADHD and support organisations · Ask how others handled school or work. **For parents:** Autism, ADHD and support organisations · After-school activities · Schools and daycares · Tidbits |
| Sensory tools | Five shop items for noise, light and touch (earplugs, headphones, a weighted blanket, a sleep mask, fidgets). **For parents:** headphones, fidgets, the blanket, a visual timer, chewable pencil toppers |
| Not sure yet | Autism, ADHD and support organisations · Therapists and counsellors · Ask a question in Tidbits · a book |

To change a pathway, edit `frontend/lib/startHere.ts`. Keep each item's
`id` the same when you reword it: the report counts opened resources by
`id`.

## What the data showed, and what was fixed

Checked on 4 October 2026, fixed on 5 October:

- ResourceHub's **Support Group** category (712 places) was really care
  homes, shelters and food banks imported from OpenStreetMap. Each now has
  the category its own OSM tags give it (Senior Care, Social Services,
  Shelter, Food Support, Supported Housing, Employment, Child Care), and
  "Support Group" holds real support organisations
  (`backend/scripts/resort_support_groups.py`; every change is in
  `docs/data/support-group-resort.csv`, and `--revert` undoes it).
- Only **4 places** mentioned autism and **none** mentioned ADHD. 19 autism,
  ADHD and learning disability organisations were added, each checked on its
  own website (`backend/scripts/add_support_organisations.py`). "Support
  Group" now has 28 places, and the pathways' first item uses it.
- **Tidbits** had one real question. Five starter questions, one per need,
  are posted openly by an "Autinerary team" account
  (`backend/scripts/seed_tidbits_questions.py`).
- 75 of 76 Thames Valley school websites were dead after the board moved
  them; 72 now point at the board's own pages and 3 dead links were removed
  (`backend/scripts/fix_tvdsb_school_links.py`,
  `docs/data/tvdsb-school-links.csv`).

Still true:

- **Employment** has 9 places; the "Help with work" search finds more.
- Group 4's sample pathway began with a "plain-language article". ResourceHub
  has no articles yet; the pathway's own explanation does that job for now.
- Only signed-in people can set a location in ResourceHub, so for visitors
  the counts cover every place it lists, wherever it is.

## Campaign links

Campaign links open Start here with their tracking (`utm_source`,
`utm_campaign`), and everyone answers the same two questions. A welcome
above the first question changes with where they came from, and since
Groups 15 to 19 one thing beside it does what that channel's visitors look
for (Riipen Labs, Group 15, "Five doors in"; `ENTRY_LINES` in
`frontend/lib/campaign.ts`): from a Facebook or parent group, "Share this
list with your group" at the top of the list; from Reddit, why we ask and
where the lists come from, before the first question; from X, a look at the
app with a sample plan; from TikTok and Instagram, "No forms, and no
account"; from someone met in person, a welcome that says so. Until 10 October some links
answered the questions for the people a channel mostly reaches; Riipen Labs'
cohort report asked for one path for everyone, since "channel should not be
used as a proxy for identity or need". A link with `utm_source` never answers
for anyone, so older links still work.

`/start?for=<who>&need=<need>`, with no `utm_source`, opens on that pathway,
and so does the same link with `utm_source=share`: "Share this list" makes
it, so the funnel report can count people who arrive from a shared list.
It is the link to someone's own list: "Send this list to yourself", the
emailed list, and the page after setup make it. The links for this October's
beta are in [beta/outreach.md](beta/outreach.md); short links and QR codes
for print (`/c/comic`, `/c/merch`, ...) are in
[campaign/README.md](campaign/README.md).

## Measures

Group 4's four measures:

- **Clarity:** in sessions, the participant says what Autinerary is for
  after the first screen ([session script](beta/session-script.md)).
- **Completion:** people who reach a pathway.
- **Relevance:** "Was this useful?" answers, and saves.
- **Confidence:** pathways followed by a next action (a resource opened, or
  the path saved).

The last three come from five events (`start_role`, `start_pathway`,
`start_open`, `start_useful`, `start_save`). Each event carries the
answers chosen, never anything typed. They need **STEP 48**
(`backend/database/migrations/2026_start_here_events.sql`); until it is
applied they are dropped. The report is `python -m scripts.onboarding_funnel`
(from `backend/`). Its "Start here" sections split the measures by need and
by who it is for, and list the resources opened most. Groups smaller than 5
show "<5".
