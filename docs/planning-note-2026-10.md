# The team's planning note, October 2026

A planning note from the team, worked through on 17 October 2026:

> **Overarching goal: "Everything in 3 clicks MAXIMUM - especially with AI
> searchbar".** Ex. Preferred Service: click 1, "What I Want → Enter → List of
> matching services"; click 2, "Which one do I like → Adds to Team → Schedules
> a meet with them"; click 3, "Sign Them On → Done".
>
> **Unknowns / To Discuss:** Self-Therapy Courses ("critical assumption that
> other parents can stay home", "make even less money for something that won't
> even work"); Job Partners: Auticon, Specialisterne, SpectrumWorks.
>
> **Colors & Theme:** Earthy (Earthy Green & Watery Blue). "And add a general
> option in Settings to customize the colors, and dull or brighten the
> colors!!!"
>
> **Goal 0: Mass Uploading of Domain-Specific & General Purpose Services.**
> Find and upload services that match the norms, starting with neurodivergent
> conditions (autism, ADHD, OCD) in Ontario; domain-specific (therapy,
> accessibility services) and general purpose (study spots, coffee shops, zoos,
> amusement parks, restaurants, hotels, banks). "UP TO 50K ADDITIONAL
> SERVICES", on both ServiceHub 1.0 and the ServiceHub MAX instance, the same
> in each. Focus: diagnosis, therapists, autism-friendly doctors, equestrian and
> other animal therapy or programs, swimming, job training and hiring,
> neurodivergent-friendly jobs, and services near universities and colleges
> (as a partnership package).

This page says what was done for each part, and what is left for the team.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Colours | Indigo and violet in the app, blue and purple in ResourceHub; no way to change them except an accent for checkboxes, and a Soft colours switch | **Earthy** by default in both apps: forest green where indigo was, watery blue where blue and cyan were, moss and sage for the purples, clay for the pinks, and a recoloured sky behind the app. Three more themes (Ocean, Sand, and Classic, the original colours), and **colour strength** from Softest to Brightest. In Settings ("Colours", the general option the note asked for), in the Display panel, in Settings → Accessibility, and on ResourceHub's settings page. The theme follows the account; the strength stays on the device, like the rest of Display. Both reach ResourceHub |
| Finding a service and signing them on | 9 clicks: Search, a card, Save, Resource Manager, Schedule Call, Request Contact, "+", a checkbox, Add to Team. The search took words, so "a quiet pool for my son near Kitchener" found nothing, then anything with "son" in it | **3 clicks.** 1: type it the way you'd say it and press Enter; the page says what it understood (Swimming · Near Kitchener · For a child · "quiet"), each part can be taken away, and the list starts near Kitchener. 2: "Add to my team" on the one you like: on the team, with "book a first meeting" in the Autinerary calendar on the next weekday at 10:00, and Call, Email and Website right there. 3: "Sign them on". Each can be undone |
| Search with 60,000 places | Every match read into the app's server and sorted there, capped at 20,000 in id order | In the database, a page at a time (**STEP 77**), with the same filters, order and counts. 36 to 110 ms at 60,000 places on a laptop's Postgres, before the new text index. Until STEP 77 is applied, search works as before |
| Ontario services | 9,561 places, from 20 city boxes across Canada (about 500 of each kind per city) | **An importer for all of Ontario** ([counts below](#goal-0-up-to-50000-ontario-services)), insert only, tagged as one batch, published with one statement after a look at a sample |
| Job partners | None | auticon Canada, Specialisterne Canada and the Spectrum Works career fair, each checked on its own website, as listings in ResourceHub ("Employment", for adults), and a brief for the partnership conversation |
| Self-therapy courses | An open question | A short note with what the evidence and Ontario's free programs say, and a recommendation |
| Near a college or university | Nothing | "Near a campus" in search (a link can give the point), the campus pages, and a partnership package for the team |

### Found and fixed while doing this

- **Saving a team member again took them off the team.** ResourceHub's Save
  wrote the row again as "wishlist", so saving from "For you" demoted someone
  already on the team. Saving now keeps a saved row as it is.
- **"Saved" on a service's page deleted a team member.** The button is a
  switch, and pressing it removed the row, team and all. On the team, it is
  now "On your team", a link to Build a Team.
- **Build a Team pointed to a "+" that was not there**: its steps said to tap
  "+" on a service, and no card had one. The steps are now the three clicks.
- **The team columns were never in the migration runbook**
  (`servicehub-mvp/scripts/add-build-team-fields.sql`), so a new database had
  no Build a Team. STEP 77 adds them where they are missing.
- **The accent never coloured selected text**, though Settings said it did: a
  second rule later in the stylesheet always won. Removed.
- **Reset to defaults left dark mode and colour strength on**, because saving
  merges and the defaults leave those out. They are named now.
- **The trending badges' gradients were never built** on ResourceHub,
  because Tailwind did not read `lib/`. It does now.
- **ResourceHub's category list read 1,000 places at a time** up to 20,000;
  with 60,000 small categories would have dropped off it again. STEP 77's
  `resource_categories()` lists every category.

## Colours and theme

The note asked for an earthy look, "Earthy Green & Watery Blue", and a
general option in Settings to change the colours and "dull or brighten" them.

**How it works.** Both apps write their colours as Tailwind classes, about
4,000 of them (`bg-indigo-700`, `text-blue-600`). The families that carry the
brand (indigo, violet, purple, fuchsia, pink, blue, sky and cyan) now read CSS
variables, which a theme sets (`frontend/app/themes.css` and
`servicehub-mvp/app/themes.css`, built by `scripts/themes/build-themes.mjs`).
Greens, ambers, reds and greys keep their meaning (done, careful, wrong, text)
and are not themed.

| Theme | Buttons and links (indigo) | Blues (blue, sky, cyan) | Purples and pinks |
| --- | --- | --- | --- |
| **Earthy** (default) | Forest green `#1b5d30` | Watery blue `#0c618c`, lake, river | Moss and sage; clay |
| Ocean | Deep sea `#185194` | Open water and shallows | Blue-slate; coral |
| Sand | Umber `#6d492b` | Dusty blue | Brown; clay |
| Classic | The original indigo `#4338ca` | The original blues | The original purples and pinks |

**Contrast is kept by construction.** Every new shade has the same lightness
(WCAG relative luminance) as the shade it replaces, rounded towards more
contrast: shades 50 to 400 never get darker, 500 to 950 never lighter. The
build checks every pairing text uses (a deep shade on white or a pale shade, a
pale shade on black or a deep shade) and reports the worst as a share of
Classic's: 100.00%. So anything that passes the accessibility checker in the
original colours passes in every theme.

**Colour strength** is a slider with five steps: Softest, Softer, Usual,
Brighter, Brightest (`saturate()` 0.25, 0.5, 1, 1.3, 1.6 on the page's root).
Softer is what the Soft colours switch was, so anyone who had it on keeps it,
and it is still counted as `display_soft`. `saturate()` keeps each colour's
lightness, so text stays as easy to read. With dark mode, both filters are in
one rule.

**Where it is.** Settings has a new **Colours** section first under display
(the four themes, each drawn in its own colours, and the strength); the old
"Colours & artistic design" was about motion and decoration, so it is now
"How lively it looks". The Display panel (on the Path, setup, the kits and
every page before an account) and Settings → Accessibility have the same
control; the Soft colours switch is gone from both. ResourceHub's settings
page has the four themes and five strengths as choices. The app's hand-off to
ResourceHub carries both (`theme-ocean`, `soft` and so on), and both are set
before the first paint, so nothing flashes.

**The sky.** The app's background picture was a pastel blue and pink
watercolour. Each theme has its own version, recoloured with lightness kept
(`scripts/themes/build-clouds.mjs`): Earthy's is a watery blue sky with sage
clouds.

The browser's colour for the app (`themeColor`, the manifest) and the emails'
buttons are Earthy's green. Which themes and strengths people choose is
counted (`display_theme_*`, `display_softest`, `display_bright`,
`display_brightest`) and in the funnel report's "Display choices".

## Three clicks

### Click 1: say what you want

ResourceHub's search box asks for it the way you'd say it ("Say what you need,
e.g. a quiet pool for my son near Kitchener"). The search is read
(`servicehub-mvp/lib/search/understand.ts`) into:

- **the kind of place**: 23 kinds, each with the words people use and the
  words listings use (swimming is swim, pool or aquatic in the listing);
- **where**: one of 502 places (Ontario's 344 cities, towns, larger villages
  and districts, and the other provinces' bigger cities, from OpenStreetMap). A
  city or town counts on its own; a village or district only after "near",
  "in" or "around". The list starts near it, whatever the profile says;
- **who for** (a child, a teenager, an adult...) and **norms** (autism, ADHD,
  OCD...): shown, and offered as filters ("Only places rated by people with
  Autism", "Only places that say they serve a child"), never applied without
  asking, because most listings do not say;
- **other words** ("quiet"): they put matching listings first.

It is read from the words every time. When the search is a sentence and the
person pressed Enter, it is also read with AI (OpenAI, `gpt-4o-mini`), which
can only choose from the same lists, so it cannot invent a kind of place, a
norm or a town; if it is slow (over 4 seconds) or off, the reading from the
words is used. The results say so once, plainly: "Read with AI from what you
typed", with a link to how Autinerary uses AI (the design guide's rule 3).
Each part can be taken away, and "Search the exact words instead" turns the
reading off. The sentence is not saved; the privacy page and the glossary say
this.

### Click 2: "Add to my team"

On every search result and every service's page. One click:

- puts the service on the team (Build a Team, being arranged);
- puts **"Contact <service> to book a first meeting"** in the Autinerary
  calendar, on the next weekday at 10:00 in the person's own time, as a
  15-minute task they can move or tick off;
- shows the service's phone, email (with a short "booking a first meeting"
  message ready) and website.

Nobody else's calendar is touched and nothing is sent to the service: the
meeting is booked by the person, with what they need in front of them.
Signed out, it goes through the one Autinerary sign-in and comes back to
finish.

### Click 3: "Sign them on"

Once they have met and agreed to work together. One click, with Undo; the
meeting task is ticked off. It replaces "+", a checkbox ("I confirm that I've
had calls with this service and we've mutually agreed on the contract") and
"Add to Team", which also needed both "Schedule Call" and "Request Contact"
pressed first.

### Other tasks, counted

Clicks from where the person is to done, not counting typing.

| Task | Before | Now |
| --- | --- | --- |
| Find a service and sign them on | 9 | **3** |
| Add a service to the team from its page | 4 (Save, Resource Manager, Schedule Call, Request Contact) | **1** |
| Change the app's colours | Not possible | **2** (Settings or Display, then a theme) |
| Make every colour duller or brighter | 2 (Display, Soft colours), one step only | **2** (Display, the slider), five steps |
| Find job programs for autistic adults | No listings | **1** (search "jobs for autistic adults", Enter) |
| Services near a campus | Not possible | **2** (a campus page, a kind of place) |
| Change text size | 2 (Display, Larger) | 2 |
| Undo signing someone on | Not possible | **1** |

## Goal 0: up to 50,000 Ontario services

### What is imported

`scripts/import-ontario-services.mjs` reads all of Ontario from OpenStreetMap,
one kind of place at a time, in the note's order of priority:

| Kind of place (category) | From OpenStreetMap | Usable (named, not closed, once each) |
| --- | --- | --- |
| Therapists and counselling (Therapist) | 222 | 219 |
| Doctors and clinics (Doctor) | 2,614 | 2,419 |
| Swimming pools, named and not private (Swimming) | 407 | 362 |
| Riding centres (Horseback Riding) | 154 | 64 |
| Employment services (Employment) | 245 | 232 |
| Colleges and universities (School) | 327 | 314 |
| Libraries, for study spots (Community Center) | 918 | 897 |
| Cafés (Café) | 5,100 | 5,001 |
| Museums (Museum) | 488 | 461 |
| Zoos and aquariums (Zoo & Aquarium) | 46 | 43 |
| Amusement parks (Amusement Park) | 93 | 65 |
| Banks (Bank) | 2,833 | 2,799 |
| Hotels (Hotel) | 1,777 | 1,672 |
| Restaurants (Restaurant) | 12,711 | 12,451 |
| **All** | | **26,999** |

**Written on 17 and 18 October: 25,725 new places, pending, in batch
`ontario-2026-10`; published on 18 October 2026** (docs/goals-6-11-2026-10.md). The other 1,274 (therapists to zoos) were already in
ResourceHub and were left exactly as they are. With STEP 78 in, each has free or paid (from a
fee a mapper recorded, otherwise what that kind of place usually is), Canadian
dollars, in person, and the tags its kind makes plain (recreation for museums
and zoos, job opportunities for employment services, college or university
for campuses).

The dry run reads everything and writes nothing; places already in
ResourceHub are left out when it writes. Riding centres are often mapped
without a name, so most are left out.

What a listing says: its name, address, map point, phone, website, hours and
any step-free tags a mapper recorded, and "Imported from OpenStreetMap. Nobody
has reviewed what it is like inside yet." Never that a place is
autism-friendly, quiet or suitable: that data does not exist, and inventing
it from the kind of place would be wrong. What a place is like inside comes
from ratings and sensory scans, as for the 9,561 places already there. Every
row credits "© OpenStreetMap contributors (ODbL)".

Not in OpenStreetMap well enough to import: **diagnosis** (no tag says a
clinic diagnoses autism) and **autism-friendly doctors** (no tag says so).
Search reads "diagnosis" and "assessment" and finds psychologists, clinics and
developmental services by their words; the job partners and Ontario's own
programs are added by hand, checked on their websites.

### How it is published, and undone

- **Insert only.** A place already in ResourceHub (same OpenStreetMap id) is
  left exactly as it is. The September importer, run again, would have sent
  9,541 approved places back to pending and undone the support-group re-sort
  and the school-link fixes.
- **One batch.** Every row carries `import_batch = 'ontario-2026-10'`
  (STEP 77). Written before STEP 77, the rows share the run's exact
  `last_verified_at` instead, and the importer prints the statement that tags
  them once STEP 77 is in.
- **Pending first**, as the September import's rule says ("Nothing reaches the
  public directory without a human approving it"). Pending places are seen by
  no one. **In this order**: STEP 77 first (so search is ready for 60,000
  places), then, after a look at the sample, one statement publishes the
  batch:

  ```sql
  UPDATE public.resources SET status = 'approved'
   WHERE import_batch = 'ontario-2026-10' AND status = 'pending';
  ```

  and one hides it again, deleting nothing:

  ```sql
  UPDATE public.resources SET status = 'rejected'
   WHERE import_batch = 'ontario-2026-10';
  ```

  A Spot Guide (an admin counts) can do either at ResourceHub's
  `/spot-guides` instead, the whole batch or one place at a time
  (`docs/service-directory-2026-10.md`).

- **No photos looked up** (50,000 Wikidata calls); the category's icon stands
  in, as for most places now.
- **No embeddings.** The AI reading and the database search do not need them;
  semantic search only adds to keyword results, and an imported place without
  one still shows. Making 120,000 embeddings would take two to three hours of
  computing, and the batch job cannot page past 1,000 places yet.

### ServiceHub 1.0 and ServiceHub MAX

There is no "ServiceHub MAX" in this repository: no code, branch, setting or
document by that name. ResourceHub (the ServiceHub app, `servicehub-mvp`) and
Autinerary read one Supabase database, and the import writes to its
`resources` table, so **any ResourceHub that reads this database, MAX
included, shows the same services**. If MAX is a separate deployment with its
own database, it needs this importer pointed at that database (and STEP 77
applied there); the team should say which.

### Search with 60,000 places (STEP 77)

Search read every matching place into the app's server and sorted there,
capped at 20,000 matches in id order. With about 60,000 places, a broad
search would have ranked and counted an arbitrary third of them, and nearby
places could have been missing. STEP 77 moves it into the database:
`search_resource_page(p jsonb)` does the same filters, the same order (near
first, then the chosen sort) and the same counts, one page at a time, with the
caller's rights so row-level security still applies; a trigram index covers
the text; and `geo_lat`, `geo_lng` and `geo_province` are worked out when a
row is written. On a laptop's Postgres with 60,000 places, without the
trigram index: browsing everything near Toronto 110 ms, one word 47 ms, a
kind of place with three words 96 ms, no location 36 ms. The app uses it as
soon as it exists, and searches the old way until then (asking again every
five minutes). Checked against the app's own ordering on 3,000 places: the
same totals, the same pages, the same distances, near counts, price,
category, condition and rating filters, and pending places hidden.

### The campus package

Search can measure "near" from any point a link gives, so each Ontario
college and university has a page of what is near it (ResourceHub's
`/campus`, linked from its home page and footer): study spots and libraries,
cafés, counselling and therapists, doctors and clinics, swimming, job
programs, support groups and restaurants, one click each, nearest first. The
province's 47 public colleges and universities, with 130 campuses from
OpenStreetMap (`scripts/places/build-campuses.mjs`; an institution mapped as
one outline over several campuses, like the University of Waterloo, is split
into its campuses; NOSM University has none mapped yet). The partnership
package for the team:

- **For a college or university**: a page for their students, with places
  near each campus rated by neurodivergent students, the campus's own
  accessibility office first, and their events in Tidbits. Their students
  rate places; Autinerary gives them a planning tool shaped around energy,
  which suits the first year's transitions.
- **What we would ask**: the accessibility office's name and link for each
  campus, permission to list it, and a way to reach their students (orientation,
  the office's newsletter).
- **What we can offer**: anonymous counts of what their students look for and
  rate (the funnel report's groups, never fewer than 5 people), and a page
  with their name.

## Job partners

Checked on 17 October 2026, each on its own website, and added to ResourceHub
as "Employment" for adults (`backend/scripts/add_job_partners.py`):

| Partner | What it is (from its site) | For people | For employers |
| --- | --- | --- | --- |
| **auticon Canada** ([auticon.com/ca-en](https://auticon.com/ca-en/)) | A technology consulting company that employs autistic adults as consultants | Jobs in data, quality assurance and testing, and software development ([careers](https://auticon.com/ca-en/careers/)); info@auticon.ca, +1 888-286-4826 | Autistic technologists for projects; neuroinclusion assessments, training and coaching |
| **Specialisterne Canada** ([ca.specialisterne.com](https://ca.specialisterne.com/); specialisterne.ca no longer resolves) | A charity "building a bridge between neurodivergent job seekers and employers" | A talent pool for people who identify as neurodivergent (autism, ADHD, a learning disability, OCD, Tourette syndrome and more) and have found it hard to get or keep a job ([join](https://ca.specialisterne.com/job-seekers/)) | Awareness, inclusive hiring and management, and connections to its talent pool; partner hiring programs (Co-operators, KPMG, PSPC have run them) |
| **Spectrum Works** ([spectrumworks.ca](https://spectrumworks.ca/)) | A career fair for autistic job seekers, employers and service providers; Substance Cares, of Toronto, is listed among its partners | Online across Canada and in person in Ottawa and Toronto; job preparation tools | Meeting autistic candidates; past employers include TD, Rogers, IBM, Microsoft, CIBC and auticon |

Spectrum Works' site lists the 2025 fairs (26 September online, 7 October
Ottawa, 17 October Toronto) and no 2026 date yet, so its listing says to check
the site.

**A brief for the partnership conversation.** The three fit at different
points: Spectrum Works brings people and employers together once a year;
Specialisterne prepares people and supports them for their first twelve weeks
in a job; auticon employs people directly, in technology. What Autinerary can
offer each:

- a way for their candidates to plan the job search around their energy (the
  Path, the calendar), with their programs as steps;
- their programs in ResourceHub, found by "jobs for autistic adults" and by
  the job and training kinds of place, and in the work life area of Start
  here;
- ratings of workplaces by neurodivergent people, which none of them has.

What to ask them: whether they would like their programs listed (they are,
from their public sites; they can correct the wording), a contact for
referrals, and, for Spectrum Works, the 2026 dates.

## Self-therapy courses

The note's worry is that courses for parents to deliver therapy at home
assume a parent can stay home, cost families who already earn less, and may
not work.

**What the evidence says.** Parent-mediated interventions for autism have
modest, mixed evidence. The 2013 Cochrane review (Oono, Honey and McConachie)
found they may help a child's understanding of language and autism severity,
but not children's adaptive skills or parents' stress, and judged the
evidence low quality. A 2021 meta-analysis of 37 studies of parent-directed
interventions found small effects on parenting confidence and mental health,
and none on caregiving burden or stress. So the note's two concerns hold:
these programs add work for a parent, and they do not reduce the load.

**What Ontario already offers, free.** The Ontario Autism Program's
**foundational family services** are free to registered families: caregiver
workshops with coaching afterwards, family mentoring and short consultations,
some online. Its **caregiver-mediated early years programs** are free, for
children 12 to 48 months, for up to six months, by invitation after
registering.

**Recommendation.** Do not build or sell self-therapy courses. Instead:

1. List the free Ontario programs in ResourceHub (the providers are on
   ontario.ca), so a family finds them without paying.
2. If the team ever offers learning for parents, make it free, short, at any
   hour (recorded, captioned, evenings and weekends), and honest about what it
   can and cannot do.
3. Plan around work, not instead of it: the Path and the calendar already pace
   a plan to the energy someone has, which is the opposite of assuming a
   parent at home.

Questions for the team: who the courses were for, who would pay, and what
outcome would count as working.

## STEP 77

`backend/database/migrations/2026_resource_search_scale.sql`, also at the end
of `setup/all_migrations.sql`. Paste it into Supabase's SQL editor. It adds:

1. `search_resource_page(p jsonb)` and `resource_categories()`, with the
   caller's rights;
2. a trigram index over each approved place's name, description and category;
3. `resources.import_batch`;
4. `resources.geo_lat`, `geo_lng`, `geo_province`, worked out by the database
   when a row is written;
5. the team columns on `saved_resources`, where missing.

Run after STEP 76. Idempotent: applied twice in the local test. Until it is
applied, search works as before, Build a Team keeps working (the meeting is
kept in the calendar if the team columns are missing), and the importer
refuses to write.

## For the team

- **Apply STEP 77**, then run the importer with `--apply`, look at the sample,
  and publish the batch with the statement above.
- **ServiceHub MAX**: if it has its own database, say which; this round
  writes to the shared one.
- **Earthy for everyone**: the default changed for every account. Anyone who
  wants the old colours picks Classic in Settings.
- **Job partners**: whether to approach them, and who; the listings are from
  their public sites.
- **Self-therapy courses**: the recommendation above.
- **The campus package**: which college or university to try first.

## Checks

On the local build (app :3100, ResourceHub :3101, backend :8000), 17 October:

- **The new suite** (`plan10.mjs`, 42 checks): Earthy from the first visit,
  the main button's colour in Earthy, Ocean and Classic, the samples drawn in
  their own themes, a theme counted, the theme before the first paint on the
  next page, colour strength at both ends and with dark mode; Settings'
  Colours section and the account keeping the theme; Settings →
  Accessibility; the theme and strength reaching ResourceHub, and ResourceHub's
  own settings; the home page's search; "a quiet pool for my son near
  Kitchener" read as swimming, near Kitchener, for a child and "quiet", the
  list starting 1.1 km from Kitchener with a pool first, parts taken away, and
  the exact words; "Add to my team" on a result, the saved row and the
  calendar task (a weekday, 10:00, "Contact Memorial Pool to book a first
  meeting"), "Sign them on" with the task ticked off, the service's page
  saying "On your team", both Undos; Build a Team's three steps; signed out,
  the one sign-in and back.
- **The reading, without AI**: 18 cases (the note's search; a speech
  therapist in Ottawa; jobs for autistic adults; "autism" and "Autism Ontario"
  still searching their words; a name and a city; "Spanish-speaking";
  St. Catharines with a dot; Niagara-on-the-Lake; "near me"; taking parts away).
- **Every earlier suite**: Groups 8 to 14 (57), 15 to 19 (76), 31 to 33 (43
  and 34), 25 to 30 (72), 20 to 24 (80), Races (2), the loop guard (5),
  Groups 34 to 36 (56, 75, 17, 10, 5, 42, 27 and 11). A network outage on the
  test machine stopped most of the first run; they were run again, and three
  that failed on timing in that run passed alone.
- **The accessibility checker**, every page signed out and signed in in both
  apps, phone and desktop, now with the search read as said and the campus
  page: no serious or critical problems.
- **STEP 77** on a local Postgres with the whole schema: applied twice; 31
  checks against the app's own ordering on 3,000 places; timings at 60,000.
- **Unit tests**: the app's (with the colours' new ones), and the backend's
  436, including that the funnel report knows every display choice the app
  sends.
- **Contrast**: every theme keeps 100% of Classic's contrast on every pairing
  text uses (the theme build's check).
