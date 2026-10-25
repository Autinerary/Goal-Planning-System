# One-click Apply (October 2026)

The ask (25 October 2026): people should sign up for resources with one click,
without going to the service's own website or app. The task view should show
the resources for that task, with an **Apply all** that applies to that page's
resources only.

The choices made with the account holder:
- **How Apply reaches a service:** with one click; nobody visits the service's website.
- **What Apply all covers:** all the resources on the task's step, which are the same five the Milestone view shows.
- **Checking:** "check once, then one click". The person checks their details the first time. After that, Apply sends after 5 seconds in which it can be undone, and Apply all asks once before it sends.

## How it works

1. A person presses **Apply** on a service. It's on the task view's "Resources for this task", on each tool card in the Milestone view, and on `/apply/<id>`, where ResourceHub's Apply button leads.
2. The first time, a dialog asks for:
   - their name;
   - who the application is for: them, their child or someone they support (with a first name and age if they want);
   - what they are looking for, in their own words;
   - a phone number, if they want to give one;
   - how they like to be contacted.

   The dialog shows the exact email the service gets. Saving the details is the consent (`application_details`, their own row).
3. Autinerary emails the listing's address from `APPLY_FROM_EMAIL` (or `REMINDER_FROM_EMAIL`):
   - **Reply-To** is the account's own email, so the service's reply goes straight to the person;
   - the person gets a **blind copy**;
   - the email carries only what they saved. Nothing comes from their plan, profile or norms.
4. **Listings with no email address:** the application is kept as `waiting`. The team gets one note per service (to `APPLY_TEAM_TO`, otherwise heydevs@), with no personal details. At `/admin/applications` the team either:
   - adds the address: it is saved on the listing, and everything waiting goes out; or
   - marks the service unreachable: the person then sees "We couldn't reach them by email", with the listing's phone number.
5. **Nothing to apply for:** places you just go to (restaurants, cafés, parks, banks, hotels, museums, amusement parks, zoos, cinemas, stores), products and articles get no Apply button.

Where each application stands is shown next to the service ("Applied Oct 26", or waiting, which can still be taken back). It also appears in ResourceHub's My Resources, in a new **Applied** tab.

## Rules the server enforces (`app/api/me/applications`)

- **Who can apply:** the person must be signed in, with an email address on their account. Under-18 and guardian-managed (Family) accounts can't send applications; a parent applies from their own account.
- **Which listings:** only approved listings that take applications.
- **One application per person per service.** A second press or a second tab never sends twice: the row is claimed before the email goes, and the email has an idempotency key.
- **Retries:** an application that was cancelled while waiting, or that failed to send, can be applied again.
- **Size limits:**
  - at most 5 at once (one step's resources);
  - at most `DAILY_LIMIT` (10) per person per day, so Apply can't be used to flood services.
- **Who writes the rows:** people can read only their own applications; only the server writes them.

## What's needed to switch it on

- **STEP 89:** `backend/database/migrations/2026_one_click_apply.sql` must be applied. It also appears as STEP 89 in `setup/all_migrations.sql`.
- **The switch:** set `NEXT_PUBLIC_ONE_CLICK_APPLY=on` in both Vercel projects (goal-planning-app and servicehub), then redeploy. Until then nothing shows and the routes answer 404.
- **Optional settings:**
  - `APPLY_FROM_EMAIL`, for example `Autinerary <applications@autinerary.ca>`;
  - `APPLY_TEAM_TO`, the inbox that gets the "needs an email address" notes.
- **The privacy page** gains "If you use Apply" when the switch is on. Bump its `UPDATED` date when turning it on.
- **The waiting list needs an admin** (`is_admin`). As of 25 October nobody is one; see the grant SQL in `docs/all-apps-round-2026-10.md`.

## Numbers behind the design (25 October, read-only)

| | Listings | With an email address |
|---|---|---|
| All approved listings | 36,238 | 1,607 |
| Outside the Ontario places batch | 10,513 | 837 |
| Hand-checked (`curated-*`) | 949 | 482 |
| Top 5 tools across the 30 newest plans | 79 | 22 |

Most of the 79 tools without an address were places from map data (parks, schools and doctors), not hand-checked services.

## Tests

- `frontend/lib/applications.test.mjs` (CI): what can be applied to, Apply all's plan, who may apply, checking the details, the email text (with HTML escaping), and the status words.
- `servicehub-mvp/lib/apply.test.mjs` (CI): the hub's list of places must match the app's.
- `.qa-local/pgtest/step89_test.py`: STEP 89 run twice on the whole schema, 27 checks (own rows only, server-only writes, one per service, the shape checks, cascades).
- **Local tests that send nothing:** set `RESEND_API_URL` to a local stand-in for Resend. `lib/email.ts` posts there instead of api.resend.com.

## Not done (yet)

- **Applications to a Resource Account's inbox** at `/business`, for services that have claimed their listing. None has yet.
- **Finding a waiting service's email address automatically** from its website. It needs a person to confirm it, since a wrong address would send someone's details to the wrong place.
- **A different note per service.** The "what I'm looking for" text is the same for every service.
