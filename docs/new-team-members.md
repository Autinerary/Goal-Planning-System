# New to Autinerary? Start here

For anyone joining the team (developers, designers, Riipen students,
advisors). It says what Autinerary is, how the code is laid out, how to run
it, how changes reach users, and where everything else is written down.
Written 18 October 2026; check anything important against the code.

## What Autinerary is

A planning app for neurodivergent people (autism, ADHD and more) and people
facing other barriers, and for the parents, teachers and supporters around
them. Two apps, one account:

- **Autinerary** (app.autinerary.ca, `frontend/`): set goals, get a path of
  steps (written with AI), a calendar, check-ins, reflections, Hare World
  (connecting with people), and starter resources without an account.
- **ResourceHub** (servicehub-six.vercel.app, `servicehub-mvp/`): a
  directory of services, products and articles (about 10,100 published,
  with 25,725 more in Ontario waiting to be published, and checked services
  in every province and territory), ratings from people who have
  used them, Tidbits (questions and answers), Build a Team, Community's
  Choice, and the Spot Guides who review new listings. Services manage their
  own listing through a Resource Account (app.autinerary.ca/business).

It is free during the beta.

## How the code is laid out

| Folder | What | Runs on |
| --- | --- | --- |
| `frontend/` | Next.js 14 (app router), the main app | Vercel, project goal-planning-app |
| `servicehub-mvp/` | Next.js 14, ResourceHub | Vercel, project servicehub |
| `backend/` | FastAPI and the AI agents (path planning and five more) | Render |
| `backend/database/migrations/` | Each database change, a "STEP" | pasted into Supabase |
| `setup/all_migrations.sql` | Every STEP in order (the runbook) | |
| `scripts/` | Importers (OpenStreetMap, checked services), QA checkers | run by hand |
| `docs/` | What was built, round by round, and why | |

Both apps share **one Supabase project** (Postgres with row-level security,
auth, storage). Signing in to one signs you in to the other.

## Running it on your computer

- The main app: `cd frontend && npm install && npm run dev` (port 3000).
- ResourceHub: `cd servicehub-mvp && npm install && npm run dev` (port 3001).
- The backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`.
- Environment files (`frontend/.env.local`, `servicehub-mvp/.env.local`,
  `backend/.env`): ask Aayush. **They point at the live database**, so
  anything you write locally writes to production. Use the QA accounts
  (`test.account+...@test.com`), never real people's accounts.
- More detail: [SETUP.md](../SETUP.md) and [frontend/README_ENV_SETUP.md](../frontend/README_ENV_SETUP.md).

## How a change reaches users

1. Commit to `main`, and **push to both remotes**: `git push aayush main`
   (Vercel and Render build from this one) and `git push origin main` (the
   public Autinerary repo).
2. Vercel builds both apps on every push; Render rebuilds only when
   `backend/` changes.
3. **Check each Vercel project's result**, not just one: `gh api
   repos/Aayush-Bhan123/Goal-planning-app/commits/<sha>/statuses` lists
   "Vercel – goal-planning-app" and "Vercel – servicehub". A green ResourceHub
   does not mean the app deployed (see [debugging.md](debugging.md)).
4. A database change is a new STEP file in `backend/database/migrations/`,
   added to the end of `setup/all_migrations.sql`, tested locally (the local
   test copies Supabase's default privileges), then **pasted into Supabase's
   SQL editor by Aayush**. Code must keep working until it is pasted.

## Checking your work

- CI (`.github/workflows/checks.yml`) runs types, unit tests
  (`frontend/lib/*.test.mjs`) and builds of both apps on every push.
- The accessibility checker: `node scripts/qa/check-accessibility.mjs`
  (WCAG 2.1 AA with axe; both apps, phone and desktop).
- The link checker: `node scripts/qa/check-links.mjs`.
- Browser suites live outside git (`.qa-local/`); ask for them.

## How we write and design

- **Plain language.** Short sentences, everyday words, no jargon, no "AI
  magic". See [voice.md](voice.md) and [design-guide.md](design-guide.md).
- **Accessible by default**: contrast of at least 4.5:1, keyboard and screen
  reader friendly, colour themes (Earthy by default) and colour strength,
  text size, reduced motion.
- **Honest**: nothing is called autism-friendly unless the place says so or
  people who used it say so; listings say where their facts came from; AI is
  labelled.
- **Privacy**: we don't sell information or show ads; the
  [privacy page](../frontend/app/privacy/page.tsx) is kept true to the code.

## Where things are written down

- The latest rounds: [planning-note-2026-10.md](planning-note-2026-10.md)
  (theme, three clicks, Ontario), [service-directory-2026-10.md](service-directory-2026-10.md)
  (Goal 1), [contracting-2026-10.md](contracting-2026-10.md) (Goal 2),
  [ratings-and-community-choice-2026-10.md](ratings-and-community-choice-2026-10.md)
  (Goal 5), [goals-6-11-2026-10.md](goals-6-11-2026-10.md) (Goals 6 to 11) and
  [subscriptions-2026-10.md](subscriptions-2026-10.md) (paid plans).
- Riipen students' feedback, round by round: `groups-*.md`.
- Operations: [release-checks.md](release-checks.md), [data-residency.md](data-residency.md),
  [admin-role.md](admin-role.md), `setup/RUNBOOK.md`.
- Pitch numbers and what makes Autinerary different: [pitch-facts.md](pitch-facts.md).
- When something breaks: [debugging.md](debugging.md).
- Every Markdown file: [MARKDOWN_INDEX.md](../MARKDOWN_INDEX.md).
