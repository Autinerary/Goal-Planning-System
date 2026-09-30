# Data residency — where Autinerary's user data actually lives

**Status:** report only. Nothing was changed. Checked 2026-09-30.

## Short answer

**Real user data is not in Canada.** The Supabase database is in **AWS `us-east-2`
(Ohio, USA)**. Three other systems that process the same data are also outside
Canada or unverifiable from the repo. Moving only the database would not, on its
own, make the product Canadian-resident.

## How the region was determined

Supabase's dashboard shows the region, but the repo has no management token, so
this was established from the network side instead — which is verifiable by
anyone and does not depend on a setting someone could misremember:

1. The database host `db.<project-ref>.supabase.co` resolves to
   `2600:1f16:111a:af01:…` (IPv6).
2. AWS publishes every IP range it owns with its region, at
   `https://ip-ranges.amazonaws.com/ip-ranges.json` (file dated 2026-09-30).
3. That address falls inside `2600:1f16::/34`, which AWS lists as
   **`us-east-2`**, service `EC2`.

The public API host (`<ref>.supabase.co`) resolves to Cloudflare edge IPs and
says nothing about the origin, which is why the database host was used.

To confirm in the UI: Supabase dashboard → Project Settings → General → Region.

## Every system that holds or processes user data

| System | What it holds / sees | Location | Verified how |
|---|---|---|---|
| Supabase Postgres | All tables: profiles (email 379/379), conditions, paths, embeddings, ratings | **AWS us-east-2, Ohio, USA** | DNS + AWS IP ranges (above) |
| Supabase Storage (`resource-images`) | Uploaded images, portraits | Same project → **us-east-2** | Storage lives in the project's region |
| Backend API on Render (`goal-planning-app-mup2.onrender.com`) | Every onboarding request, including the full profile | **Not verifiable from the repo** — no `render.yaml`, region is a dashboard setting | NOT YET VERIFIED |
| Vercel functions (Goal Planning + ResourceHub) | All authenticated API routes | **Not pinned** — `frontend/vercel.json` has no `regions` key, so the project default applies (Vercel's default is `iad1`, Washington D.C.), unless it was changed in the dashboard | Repo config checked; dashboard NOT YET VERIFIED |
| OpenAI API | Embedding text for every user (see below), path-planning prompts, bulk-import parsing, photo extraction, portrait generation | **USA** | Provider |

### What goes to OpenAI today

Worth stating plainly because it is broader than the deck currently says. The
Pattern Recognition embedding text is built as:

```python
f"barriers: {', '.join(barriers)}. goals: {', '.join(goals)}. profile: {profile}"
```

and `profile` is the whole onboarding dict (`backend/api/routes/onboarding.py:353`),
which includes **`email`, `id`, dreams, current challenges, and seven free-text
support fields** (therapy types, strategies that worked/didn't, school and
workplace accommodations). So every indexed user's email address has been sent to
OpenAI inside their embedding request. Item #2 addresses this; this report only
records it.

Other routes that send user content to OpenAI: `bulk-import/parse` (gpt-4o /
gpt-4o-mini), `calendar/extract-photo` (gpt-4o, photos of calendars),
`me/ideal-self` (image generation), and the backend LLM agents via
`backend/core/llm.py`.

## What migrating to a Canadian region would involve

Supabase cannot move a project between regions. Migration means **creating a new
project in `ca-central-1` and moving everything into it.**

1. **New project** in Canada (Central). Enable `vector` and `pg_trgm`.
2. **Schema** — reproducible from the repo: the base schemas, then
   `setup/all_migrations.sql` (STEPs 01–41). This is a real advantage; the
   schema does not have to be reverse-engineered.
3. **Data** — `pg_dump` / restore of `public`. Row counts to check afterwards
   are already scripted: `backend/scripts/vector_deck_pull.py` (fully paginated)
   gives a before/after comparison.
4. **Auth users** — the `auth` schema has to move too, including password hashes,
   or every user must reset their password. Supabase documents a migration path
   for this; follow it rather than improvising.
5. **Storage** — copy every object in `resource-images`; the URLs change, so
   `resources.image_url` and portrait URLs need rewriting.
6. **Keys and secrets** — the new project has a new URL, anon key, service-role
   key and JWT secret. Update Vercel (both apps), Render, and every `.env*`.
   **Every user is signed out once** at cutover.
7. **Auth settings** — redirect URLs, email templates, SMTP, any OAuth providers.
8. **Cutover window** — freeze writes, final sync, switch env vars, verify counts.
9. **The processors** — this is what the database move does not fix:
   - Render has no Canadian region (its regions are Oregon, Ohio, Virginia,
     Frankfurt and Singapore — confirm against Render's current list). A
     Canadian backend means a different host.
   - Vercel functions would need a region pinned in `vercel.json`; Vercel's
     region list should be checked for a Canadian option.
   - OpenAI processes in the USA. Keeping personal data in Canada would mean
     either sending it only after anonymisation (item #2) or running models
     locally (item #6).

Rough effort: the database move itself is a day or two of careful work plus a
maintenance window; the processor changes are the larger decision.

## The part that is not an engineering decision

PIPEDA does not itself require personal information to stay in Canada. It
requires accountability for information transferred to a third party for
processing, including across borders, and transparency with users about it.
Quebec's Law 25 is stricter: it requires a privacy impact assessment before
personal information is communicated outside Quebec. Whether Ontario's PHIPA
applies depends on whether Autinerary or a partner is a health information
custodian, which is the same open question already on the governance slide.

**Those are questions for counsel, not code.** Nothing here should be read as a
recommendation to migrate or not to migrate.
