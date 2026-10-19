# Autinerary's product portfolio

What Autinerary makes, one product at a time: what each is, who it is for,
what works today, what is switched off, and where to read more. For anyone
new to the team, and for pitches (the Tidbits round's planning note, Goal 9:
"Edit up Product Portfolio … easy for new ppl to understand whats going on,
makes pitches easier"). Numbers are in [pitch-facts.md](pitch-facts.md);
how the code is laid out is in [new-team-members.md](new-team-members.md).
Last updated 19 October 2026.

**In one line:** Autinerary turns "what do I need?" into a plan and a team.
It is a planning app and a service directory built for neurodivergent people
and the families and supporters around them, free during the beta.

Autinerary is a Mitacs project (the Category Split, October 2026).

## The products at a glance

| Product | What it is | For | Status |
| --- | --- | --- | --- |
| [The Autinerary app](#the-autinerary-app) | A life plan, written with AI from your goals and norms: steps, a calendar, check-ins, reflections | Neurodivergent people, and parents planning for a child | Live (app.autinerary.ca) |
| [ResourceHub](#resourcehub) | A directory of services, rated by people who used them | Anyone looking for help | Live |
| [Tidbits](#tidbits) | Short pieces (500 or 1000 words) and questions from people who have been there | The community | Questions live; Tidbits open with STEP 83 |
| [The shop](#the-shop) | Products people recommend, with the qualities that matter (tagless, fragrance-free, no time pressure…) | Families and neurodivergent adults | Live; buying through it is off |
| [Hare World](#hare-world) | Friends, mentors and role models; messages and calls | People who want connection | Live |
| [Resource Accounts](#resource-accounts-for-services-and-vendors) | Services and vendors manage their own listing | Services, vendors | Live; sponsored listings and selling are off |
| [Emails](#emails) | A weekly newsletter, the first weeks, reminders | Subscribers | Live, sent by the team |

## The Autinerary app

**What it is:**

- You say your goals and, if you want, your norms (autism, ADHD, Tourette…).
- Six AI agents write a plan in steps across four life areas, with the tools
  that help.
- The plan comes with a calendar that has low-energy days, check-ins and
  reflections.
- The plan adapts as you go.

**Who it's for:** neurodivergent people, and parents or supporters planning
for someone. A **simple view** shows just the next step, four Quick Links
and one card.

**Paths and Path Market:**

- Start from a path such as Medicine & Science, Education or Career, with
  its goal ideas.
- Since 19 October, each path also has **checked resources of its own**: for
  medicine, AFMC's admission requirements, OMSAS, MCAT and Casper
  accommodations.

**Off or later:**

- **Paid plans**: a free first month without a card, then monthly or
  yearly, and free access through organizations (`NEXT_PUBLIC_PAYMENTS`,
  `NEXT_PUBLIC_PAYWALL`; [subscriptions-2026-10.md](subscriptions-2026-10.md)).
- **Sponsored services** among a step's suggestions (`NEXT_PUBLIC_SPONSORED`).

**Code:** `frontend/` (Next.js) and `backend/` (FastAPI, the agents).

## ResourceHub

**What it is:**

- **36,024 places and services** in Canada, most from Ontario's open data.
- **757 checked by hand** on their own websites, in every province and
  territory.
- Search in a sentence ("a quiet pool for my son near Kitchener").
- Filters for norms, cost, waits, ages, support for parents and funding.
- Ratings only from people who used a service, a monthly sweep that warns
  and then hides services rated low, and Community's Choice each month.
- Pages for 47 campuses.

**Who it's for:** anyone looking for help. The directory, ratings and
Tidbits stay free.

**New this round:**

- "Help that's hard to find" on the home page.
- How long the wait is, on every listing.
- 86 more checked services, for the conditions that had almost none and for
  parents.

**Code:** `servicehub-mvp/` (Next.js), on the same database as the app.

## Tidbits

**What it is:**

- Short, solution-oriented pieces: a **Tidbit** is up to 500 words, a
  **Tadbit** up to 1000.
- Alongside them, the community's questions and answers.
- In groups (Parents, Autistic adults, ADHD, Siblings…), with Bites (reads)
  and Well-Dones (ratings).
- Moderated automatically (slurs refused, swearing bleeped, the rest flagged
  for a person) and by the team.

**Status:**

- Questions are live.
- Tidbits open when STEP 83 is pasted.
- Ten articles by "Autinerary" are ready as drafts.

**Read more:** [tidbits-round-2026-10.md](tidbits-round-2026-10.md).

## The shop

**What it is:**

- **243 products** people recommend, in 40 categories.
- Each quality is checked on the maker's own pages: tagless, fragrance-free,
  turns down noise, chewy, no chat with strangers…
- Users' Choice, and Community's Choice for the year.
- A taste profile for what you like and avoid.

**Off:**

- **Buying through ResourceHub**: Stripe Connect, the vendor is the seller,
  ResourceHub keeps a fee.

**Read more:** [products-round-2026-10.md](products-round-2026-10.md).

## Hare World

**What it is:**

- Connections: friends, mentors and role models.
- Messages only between connected people. Any message can be reported to the
  team, and anyone can be blocked.
- Video calls, shared tasks and updates.

**Code:** `frontend/app/hare-world`, `frontend/app/pit-stop`.

## Resource Accounts (for services and vendors)

**What it is:** a service or vendor claims its listing (a code sent to the
listing's own email), keeps it up to date, and states its wait. It sees how
its listing is used (counts, never who) and offers discounts.

**Off, each ready for the team to turn on:**

- **Sponsored listings**, paid by the click from a prepaid budget, in search,
  Tidbits and Paths. Always labelled, never chosen from a profile of the
  person, and never shown to people who pay.
- **Selling** through the shop.

**Read more:** [goals-6-11-2026-10.md](goals-6-11-2026-10.md) and
[tidbits-round-2026-10.md](tidbits-round-2026-10.md#goal-7-sponsored-listings-off).

## Emails

- The weekly newsletter, with Community's Choice voting.
- The first two weeks' emails (day 1, 7 and 14).
- Setup reminders.
- Every one ends with what our survey told us (the 5Qs report), as four
  tiles linking to what helps.
- Each goes only to people who asked for it, and every one has a way to stop.

## How Autinerary is paid for (the plan)

- **Free**: ResourceHub's directory, ratings and Tidbits, and the app during
  the beta.
- **Paid plans** for the app after the beta, with free access through
  universities, workplaces and governments (#FundAutinerary): off.
- **Sponsored listings** from services: off.
- **A fee on sales** through the shop: off.

## What is next

- **v1.5 (Tidbits)**: questions and requests, Chef Requests, Suggestions,
  Bake-Offs. Consider IP for the industrial designs first.
- **v2.0**: culture and location, languages, professional partnerships, and
  Premium (writers' analytics, annotations for researchers, no ads).
- **Products v2.0 and v3.0**: an AI shopping assistant, in-store navigation,
  culture and other conditions.

Round by round: [tidbits-round-2026-10.md](tidbits-round-2026-10.md),
[products-round-2026-10.md](products-round-2026-10.md).
