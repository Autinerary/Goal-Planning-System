# Goal 1: the service directory, October 2026

The team's note, "Goal 1: Service Directory", worked through on 17 and 18
October 2026: a continuous loop that adds services, reviewed by Spot Guides
(agents for now); new tags and fields for services; free or paid on every
service; distance from you; funding resources; new to the area; the age of a
service; life categories renamed and added (Education with education
navigation, Career, Adulting, Parenting); and services and searches the team
named. This page says what was done for each, and what is left.

It needs **STEP 78** (`backend/database/migrations/2026_service_directory_tags.sql`,
also at the end of `setup/all_migrations.sql`).

## What changed

| Asked for | Now |
| --- | --- |
| Continuous service-adding loop with Spot Guides (agents for now) | **The service-adding loop** (`frontend/lib/serviceLoop.ts`, run by the app's scheduler four times a day, at 00:15, 06:15, 12:15 and 18:15 UTC, `/api/cron/service-loop/0` to `/3`; Vercel's plan allows each scheduled job once a day, and the first version's single every-six-hours job stopped the app deploying until 18 October): each run takes up to six slices of Ontario from OpenStreetMap, one kind of place in one piece of the map, in turn, about a month to go round, and adds what ResourceHub lacks. The agent checks each place first: a name, a point inside Ontario's outline, not closed or private, not already listed (the same place, or the same name within about 100 m). What it adds waits for a **Spot Guide** at ResourceHub's `/spot-guides`, batch by batch (`loop-YYYY-MM-DD`): look at the places, approve or hide one, or the whole batch. Spot Guides are rows in `spot_guides` (admins count too). Setting `SERVICE_LOOP_AUTO_APPROVE=on` makes the agent's checks the approval |
| Education tags from daycare to a PhD; post-secondary beyond university and college; continuing education; mature student options | Tags (`servicehub-mvp/lib/filters/tags.ts`): daycare, kindergarten (junior, senior), elementary, middle, secondary, standardized testing, trade school, apprenticeship, undergraduate (college, university, certificates, bachelor), graduate (masters), further (PhD), continuing education, mature student options. Choosing one finds those under it |
| "Already in user's support team", "Already owned by user", "Already read by user" | On each card for the person who is signed in: **In your support team** (signed on), **Already owned** (a shop item in one of their orders), **Already read** (an article they opened; kept in `resource_reads`, which only they can read) |
| Free and Paid on every resource; a cost field in the location's currency; sort by cost only after "Paid" | `cost_type` (free or paid) on every service, with `currency` (CAD in Canada, JMD for the Jamaica listings) and the amount in `price`. STEP 78 fills free or paid in for every place there now: from its price when it has one, otherwise from what that kind of place usually is (parks, libraries, doctors in Ontario, employment and support services free; therapists, pools, cafés, restaurants, hotels, colleges paid), marked as usual (`cost_source`), and a service's page says "Usually free for this kind of place". Cards say **Free**, **Paid · $12.50** or **Paid**. Search has **Free or paid**; sorting by cost appears only once **Paid** is chosen |
| "Self-diagnosed" under "Diagnosed" in Connection Type to Norm | Under Diagnosed. Ratings now record how the rater is connected to their norms (from their norms, their diagnostic profile in the app, and who they are here for), which the filter reads: before, nothing wrote it, so the filter found nothing |
| "Requires diagnosis", with "make sure you have it, as we don't do diag directly on our site (yet)!" | A tag, with that note in the filter and on a service's page: "For services that require a diagnosis, make sure you have one: Autinerary does not diagnose directly (yet)." |
| Distance from you: "55 km from you", "Online 0 km", "Location denied"; sort by distance only when there is one | Each card: the distance, or **Online · 0 km**, or **location not shared**. Sorting by distance appears only when the person's place is known |
| Funding resources | A tag, and checked listings of programs and the help to apply across Ontario and Canada (below) |
| New to the area: country and city | Tags **New to the country** and **New to the city**, and checked listings of newcomer services across Ontario (below) |
| Personality vs Norm | Personality (the personality patterns, clusters A to C) is its own section in the filters, apart from Norms, so either can be chosen alone. The note gave no detail: the team should say if it meant something else |
| Age of service: just launched today, 1 week, 1 month, 1 year, 5 years | **Age of service** in the filters: how long ago it started (`started_on`, when known) or was added |
| "After school & activities" to "Education", with education navigation: level, domains (law, medicine, engineering and up to 40 more), programs and options, adjusting to the location's school system | **Education**, and once chosen, **Education navigation**: Level of education, **Domains of post-secondary education** (43: law, medicine, engineering and 40 more), **Programs and options** (after-school programs, special education, accessibility and accommodation services, mature student options, mentorship, tutoring, events, social clubs, awareness clubs), and **Match the school system where I live**, which shows the United States' levels (preschool, pre-K, junior high, community college) to someone whose profile says they live there |
| "Workplace - fitting in" to "Career", with workplace life and career level | **Career**: Workplace life, and Career level (training, internships, jobs) |
| Large-scale resource centre, Community's choice, Job opportunities, Community groups (local, in person, online), Charity, Advocacy, Provides medical diagnosis, Respite care, Recreational activities | Tags, under **Kind of service**. **Community groups** opens Local, In person and Online; Local means in the person's city (within about 30 km of their place) and asks for their location when it is not set. Community's choice is there for Goal 5 |
| Adulting (taxes, finances, cooking, living by yourself, finding friends) and Parenting (by age group) | Life categories, each with those choices |
| A gentler name for "After-death planning" that still says what it is for | **Future planning (wills, trusts, guardianship)**. "Secure Future" did not say what it was for |

STEP 78 also tags what every existing place's kind and name make plain:
daycares, kindergartens, elementary, middle and secondary schools by their
names (an Ontario "Senior Public School" is grades 7 and 8, so middle), the
province's colleges and universities, employment services (job
opportunities), support groups (community groups), and parks, pools, riding,
zoos, amusement parks and museums (recreation). Places on the map are in
person. Nothing else about them changes.

## Services added

Found by research agents, one per list. Each service is checked on its own
website: every quote, phone number, email and address is matched word for
word against the page, and the page is fetched again just before saving. Each
is described in its own terms, never as autism-friendly unless it says so.
They are in `scripts/data/services/`, and `node
scripts/import-curated-services.mjs --apply` saved them on 17 October,
approved, one batch per list (`curated-<list>-2026-10`) so a Spot Guide can
hide any of them: **364 services**. The 52 with a street address are on the
map; the rest are online or serve a whole province or campus, and search
lists them after the places near the person, their own province first.

| List | Services | What is in it |
| --- | --- | --- |
| Funding resources (`funding`) | 25 | Ontario's and Canada's programs (Ontario Autism Program and AccessOAP, ACSD, Special Services at Home, Passport, DSO, ODSP, the Assistive Devices Program, the Canada Disability Benefit, the Disability Tax Credit, the RDSP, the Child Disability Benefit, Jordan's Principle), and the help to apply: Benefits Finder, Prosper Canada's Disability Benefits Compass, Inclusion Canada's Barrier-Free Benefits navigators, Pathway to Benefits, the Disability Planning Helpline, free tax clinics, community legal clinics, and charities' funds (Autism Ontario, Easter Seals, March of Dimes, Jennifer Ashleigh) |
| New to the area (`newcomers`) | 35 | Settlement services across Ontario, from Toronto, Ottawa and Peel to Thunder Bay and Sudbury (COSTI, CultureLink, ACCES Employment, OCISO, the YMCAs' immigrant services, Reception House, ...), Settlement.Org, 211 Ontario, libraries' newcomer centres, cities' and regions' newcomer pages, and ones for autistic and Deaf newcomers (SAAAC Autism Centre, Bob Rumball Centre, LDA Toronto's S.P.L.A.S.H.) |
| Young children (`early_years`) | 42 | Ontario's children's treatment centres and SmartStart hubs, preschool speech and language programs, infant and child development, autism diagnostic hubs, and the Ontario Autism Program's early-years and entry-to-school programs |
| Neurodivergent mentoring, tutoring and events (`nd_mentoring`) | 30 | Mentoring (Jake's House; York's is under universities), transition programs (Queen's On-Line to Success, Windsor's BUILD), the Learning Disabilities Associations' tutoring and social groups, Kerry's Place, Geneva Centre, CADDAC's groups and conference, Autism Ontario's events, camps (Camp Kirk, Camp Winston), and schools that teach students with learning disabilities or autism (the Provincial Demonstration Schools, Arrowsmith, Fraser Academy, Foothills Academy, Landmark East, Giant Steps) |
| Siblings (`siblings`) | 20 | Sibling groups in Ontario (Holland Bloorview, ErinoakKids, Community Living Toronto, Grandview Kids, the Young Carers Program, Autism Ontario's Sib Squad, Kerry's Place), Siblings Canada and Savvy Siblings for adults, Autism Nova Scotia and Autism Society Alberta, and online groups and guides (SibNet, Sib20, SibTeen, the Organization for Autism Research) |
| Universities (`universities`) | 89 | Accessibility services, mentoring, tutoring and learning help, and events at 20 major universities across Canada (Toronto, McGill, UBC, Alberta, McMaster, Waterloo, Western, Queen's, Ottawa, Calgary, Montréal, York, Toronto Metropolitan, Simon Fraser, Dalhousie, Manitoba, Saskatchewan, Victoria, Carleton, Guelph), and their groups for neurodivergent students where they have them (Calgary's Neurodiversity Support Office, York's Autism Mentorship Program, Queen's Autism Group, Waterloo's NeuroMinds, McMaster's Neurodivergent Minds, Carleton's neurodiversity group, McGill's group for neurodivergent students and those with chronic conditions, Toronto's social association for students with ASD, the ADHD groups at Toronto, UBC and Queen's) |
| Ontario colleges (`colleges_on`) | 62 | Accessibility services, tutoring, mentoring and events at 23 Ontario colleges, Algonquin to Sheridan, French ones included (Boréal, La Cité) |
| Other colleges in Canada (`colleges_ca`) | 55 | The same at 22 colleges in British Columbia, Alberta, Saskatchewan, Manitoba, Quebec and the Atlantic provinces |
| The team's named services (`named`) | 6 | Below |

The research's web searches ran out partway through each list; after that,
the agents followed the organisations' own websites, so some local services
may be missing. What they found but could not confirm on an organisation's
own page (a past session, a page that would not load, a mention only on
someone else's site) is listed in each file under `unverified`, and was left
out. When a page gives no price, free or paid is what that kind of service
usually is (publicly funded children's centres are free; residential camps
and private schools are paid), and its page says so. Staff members' own email
addresses are left out; the organisation's phone and website are there.

**The team's named services:**

- **Learn Smart Academy**, Montego Bay, Jamaica: a school for children 2 to 6
  (its own page). The founder's name is spelled Winsome **Stewart** in a
  Gleaner article (December 2018). Nothing shows whether it is still open, and
  it publishes no address or phone: the team can confirm.
- **"Yes I Can" Nursery**: none found in Jamaica. **Yes I Can! Nursery
  School** in Toronto (a registered charity and licensed child care centre
  with "specialized communication classes" for children with autism or social
  communication delays) is listed; the team should say if they meant another.
- **Inglewood Heights Junior Public School** (Toronto District School Board,
  Scarborough). For 2026–27 it is not on the board's autism Intensive Support
  Program map, but is on its Developmental Disability one; the listing does
  not claim an autism program.
- **Rachael Macdonald** and **Georgia Rose** (Jamaica): not listed. No public
  practice was found under those names (a Georgia Rose is a senior clinical
  psychologist with Jamaica's Western Regional Health Authority, with no
  preschool or practice named). The team has their details and can send them.
- **Henson trusts**, under Future planning: Steps to Justice's page on
  inheritances (CLEO), ODSP's directive on funds held in trust (ontario.ca,
  March 2026), and Partners for Planning's Henson trust explainer and free
  webcasts.

## STEP 78

Applied on 17 October 2026, and checked on the live database (below). It
adds the tags, cost, currency,
delivery and start columns and fills them for what is there now, the
"read" list, Self-diagnosed, Spot Guides (`spot_guides`, `is_spot_guide()`,
`spot_guide_batches()`), and search for tags, free or paid, online and age.
Run after STEP 77. Idempotent: applied twice in the local test, with 33
checks.

To make someone a Spot Guide:

```sql
INSERT INTO public.spot_guides (user_id, granted_by, note)
SELECT id, 'aayush', 'Spot Guide' FROM auth.users WHERE email = '<their email>';
```

## For the team

- **Personality vs Norm**: shown as its own filter section; say if you meant
  something else.
- **Rachael Macdonald and Georgia Rose**: send their details (and that they
  agree to be listed), and they go in with the rest.
- **"Yes I Can" Nursery**: the Toronto one, or one in Jamaica?
- **The loop's approval**: Spot Guides approve what it finds. Turning on
  `SERVICE_LOOP_AUTO_APPROVE` lets the agent's checks approve it.
- **Free or paid for places nobody priced** comes from what the kind of place
  usually is, and says so; a price from the place replaces it.
- **Getting ratings from the people the services came from**: the note says
  they can rate straight away; Build a Team and the rating form are ready.

## Checks

- **STEP 78 in a local Postgres**: applied twice, 33 checks.
- **STEP 78 on the live database** (reads only, the public key, as ResourceHub
  signed out), 19 of 19: every one of the 9,564 approved places is free or
  paid (8,079 free and 1,485 paid, all from what that kind of place usually
  is: none had a price), Ontario's are in Canadian dollars, places on the map
  are in person, and tags are filled in from each place's kind and name
  (113 daycares, 465 elementary and 163 secondary schools, 22 college and 50
  university sites, 12 employment services, 28 support groups, 3,819 places
  for recreation). Search by a tag (either within a family, both across two),
  free, paid sorted by cost, online and age answers; a malformed date is
  ignored; "already read", the Spot Guide list and the review batches give
  nothing to someone signed out; pending places stay hidden; self-diagnosed
  counts as lived experience.
- **The researched services**: every website loaded again just before saving
  (the three that turn scripts away were kept), and 364 were saved. On
  production, search finds them: siblings 21, funding 26, new to the country
  35, new to the city 6, online 139, tutoring 82, mentorship 36, requires a
  diagnosis 7, provides a diagnosis 8, respite care 11.
- **The service directory in the browser** (ResourceHub, signed out and as a
  QA account), 28 checks: free or paid, every kind of service the note named,
  "Requires a diagnosis" and its note, online and the five ages of service,
  Personality apart from Norms, Self-diagnosed under Diagnosed, the renamed
  and new life categories with Education navigation (every level, 43 domains,
  programs and options, the school system choice), Career, Adulting and
  Parenting, cost sorting only after "Paid", free or paid on cards and in "At
  a glance", the tag filters, and Spot Guides refusing someone who is not one.
  On production the first run found shop items listed under the new filters
  (a tag, Free, Online, the age of a service): fixed (b291fe0), and 28 of 28
  on production since.
- **The loop, against real map data, writing nothing**: every kind of place in
  every piece of the map in turn (616 slices), six a run and the next run the
  next six, Ontario's outline (Toronto in, Gatineau and Detroit out), and real
  slices counted what they found and what was new (therapists 19 found and 3
  new in one piece, pools 50 and 10, riding 27 and 3); a map server that does
  not answer in time is reported for that slice, and the run goes on.
- **The earlier rounds on production, after this one deployed**: Groups 31
  and 31b (43 and 34), 25 (72), default races (2), Group 34's live and admin
  checks (27 and 11), and the planning note's search and team (42), all
  passing. The accessibility check (every page of both apps, phone and
  desktop, signed out and in) found one problem: on ResourceHub's home page,
  the price badge on "Cheapest Resources", white on a green under 4.5:1, which
  had never shown before services had prices. Fixed (1625a3a): 92 page views since, with no serious or critical problems.
