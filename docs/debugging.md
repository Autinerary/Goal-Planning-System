# Debugging Autinerary: what has gone wrong, and how to tell

Problems the team has actually hit, how each looked, and how to check. Add to
it when something new breaks. Last updated 18 October 2026.

## "I pushed, but nothing changed"

- **Pushed to one remote only.** Vercel and Render build from `aayush`, not
  `origin`. Push to both.
- **One Vercel project failed.** Check both: `gh api
  repos/Aayush-Bhan123/Goal-planning-app/commits/<sha>/statuses` should show
  "Vercel – goal-planning-app: success" and "Vercel – servicehub: success".
  From 17 to 18 October 2026 every app deploy failed while ResourceHub's
  worked, so ResourceHub's checks passed and nobody noticed.
- **A cron job that runs more than once a day.** Vercel's plan runs each cron
  job at most once a day, and one scheduled more often (`15 */6 * * *`) fails
  the whole deploy at validation, before any build: it does not even appear in
  `npx vercel ls`. Make several daily jobs instead (the service loop's
  `/api/cron/service-loop/0` to `/3`).
- **Render didn't rebuild.** Render only rebuilds when `backend/` changes;
  `curl -s https://goal-planning-app-mup2.onrender.com/health | jq .commit`
  shows what it runs.
- **curl says 200 but the page is wrong.** app.autinerary.ca answers plain
  `curl` with Vercel's bot check. Check pages with a real browser (puppeteer).

## Database

- **A STEP isn't applied yet.** New columns or functions missing show as
  PostgREST errors `42703` / `PGRST204` (column), `PGRST202` (function),
  `PGRST205` / `42P01` (table). Code should fall back until the STEP is in;
  ask Aayush to paste it.
- **"REVOKE ... FROM PUBLIC" didn't lock a function.** Supabase grants every
  new function and table to `anon` and `authenticated` directly. For a
  SECURITY DEFINER function that writes, revoke `FROM PUBLIC, anon,
  authenticated` by name (STEP 80 fixed this for STEP 79's). After pasting a
  STEP, call its functions with the public key: refused ones answer 401.
- **Row-level security hides rows silently.** A query that "returns nothing"
  may be a policy, not missing data. Admin actions must write with the
  service role (`createAdminClient()`), not the admin's session.
- **Local tests:** `pgserver` in a scratch venv, with a Supabase auth stub and
  Supabase's default privileges copied first (see the migration notes).

## Email

- Nothing sends without `RESEND_API_KEY`; the newsletter also needs
  `NEWSLETTER_POSTAL_ADDRESS` (Canada's anti-spam law). Local env files have
  neither, so local runs never email anyone.
- Don't run the newsletter, reminder, rating-sweep or tally cron routes
  against production by hand; `?dry=1` still emails the team's digest.

## Search and ResourceHub

- **Results look stale**: search, ratings and products are cached for 60
  seconds per server.
- **A new tag doesn't filter**: it must be in `servicehub-mvp/lib/filters/tags.ts`
  (the importers read that file too).
- **Shop items show under a service filter**: the search route decides when
  products join results (`normFilterActive` in `app/api/search/route.ts`).

## AI and the backend

- The backend on Render's free tier sleeps; the first request after idle can
  take a minute.
- AI search in ResourceHub falls back to reading words when OpenAI is slow
  (a 4-second limit) or `AI_SEARCH=off`.

## Who to ask

Aayush (aayush@autinerary.ca) for access, keys and anything production.
heydevs@autinerary.ca reaches the developers.
