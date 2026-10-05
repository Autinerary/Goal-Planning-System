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

One question at a time, with the steps done and still to come shown above
it, and "Change" next to each answer. The home page's main button, "Find
starter resources", leads here; "Create your free account" is still next to
it.

**Save this path:** for a visitor, this is the free account. Setup then
starts with the same answers (who for, and the matching "What are you
looking for today?"), saves the path to the account, and the page after
setup opens with it. Signed in, it saves straight to the account. Either
way it reopens from **Quick Links > Starter resources** on the Path.

## What each pathway shows

Everything comes live from ResourceHub, so names and counts stay current.
Searches anyone can open show how many places they find; shop items and
Tidbits are marked "Free account" for visitors.

| Need | Resources |
| --- | --- |
| Starter information | Autism organisations and services (search) · two books from the shop · Ask a question in Tidbits |
| Services | Autism organisations and services · Therapists and counsellors · Doctors and health centres · Community centres and libraries |
| People with similar experiences | Ask a question in Tidbits · Autism organisations and services · Community centres and libraries · Sports and activities |
| School or work support | Help with work · Autism organisations and services · Ask how others handled school or work. **For parents:** autism organisations · After-school activities · Schools and daycares · Tidbits |
| Sensory tools | Five shop items for noise, light and touch (earplugs, headphones, a weighted blanket, a sleep mask, fidgets). **For parents:** headphones, fidgets, the blanket, a visual timer, chewable pencil toppers |
| Not sure yet | Autism organisations and services · Therapists and counsellors · Ask a question in Tidbits · a book |

To change a pathway, edit `frontend/lib/startHere.ts`. Keep each item's
`id` the same when you reword it: the report counts opened resources by
`id`.

## What the data showed (October 2026)

These gaps shaped the pathways, and are the best places to add content:

- ResourceHub's **Support Group** category (712 places) is mostly housing and
  care homes, so it is left out. Recategorising it would give the pathways
  real support groups.
- Only **4 places** mention autism, and **none** mention ADHD or
  "neurodivergent". Adding local autism and ADHD organisations would help
  every pathway.
- **Employment** has 3 places; the "Help with work" search (39 places) finds
  them and more.
- **Tidbits** has 2 questions and 1 answer, so it is offered as a place to
  ask, not as a library of answers.
- Group 4's sample pathway began with a "plain-language article". ResourceHub
  has no articles yet; the pathway's own explanation does that job for now.
- Only signed-in people can set a location in ResourceHub, so for visitors
  the counts cover every place it lists, wherever it is.

## Campaign links

`/start?for=<who>&need=<need>` opens part-way through: `for=` is `self`,
`child`, `family`, `work` or `ally`; `need=` is `learn`, `services`,
`community`, `school_work` or `sensory`. Add the usual `utm_source` and
`utm_campaign`. The links for this October's beta are in
[beta/outreach.md](beta/outreach.md).

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
