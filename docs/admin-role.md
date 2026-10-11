# Admin role

Until STEP 55 there was no admin role. Admin work meant holding the
`service_role` key, which bypasses every RLS policy, and ResourceHub and
Tidbits treated `profiles.role = 'admin'` as admin.

`profiles.role` is also the "who are you" answer people set themselves (self
advocate, parent, and so on), and the profiles policy lets a signed-in person
update their own row. So nothing in the database stopped someone setting their
own role to `admin` with the public anon key and their own session. Tested on
a local Postgres with the repo's policies: before STEP 55 it works; after, it
is refused. **Not yet verified against production**, which may differ from the
repo; no profile has role `admin` today (8 October 2026).

## What STEP 55 adds (`backend/database/migrations/2026_admin_users.sql`)

- `public.admin_users`: who is an admin. Rows are added only in the SQL editor:

  ```sql
  INSERT INTO public.admin_users (user_id, granted_by, note)
  SELECT id, 'aayush', 'team' FROM auth.users WHERE email = '<their email>';
  ```

- `public.is_admin()`: whether the signed-in caller is an admin. Usable in RLS
  policies and from the apps (`supabase.rpc('is_admin')`). It answers only for
  the caller.
- A guard on `profiles`: a signed-in session can no longer set `role` to
  `admin`. Every check below that still reads `profiles.role = 'admin'` is
  therefore only as reachable as `admin_users`, until it moves to `is_admin()`.
- The worked example: path model review (below).

## Service-role use that is an admin action

| Where | What it does | Gate today | Status |
| --- | --- | --- | --- |
| `frontend/app/api/path-models/[id]/approve` | Approve or reject a community path model | `ADMIN_EMAILS` (not set in Vercel, so nobody could) | **Migrated**: `rpc('is_admin')`, then an update under RLS that only admins pass, on the `status` column only |
| `servicehub-mvp/app/api/community/posts/[id]` (PATCH, DELETE) | Edit or delete anyone's Tidbits post | `profiles.role = 'admin'` | To migrate |
| `servicehub-mvp/app/api/community/posts/[id]/lock` | Lock a post | same | To migrate |
| `servicehub-mvp/app/api/community/answers/[id]` | Edit or delete anyone's answer | same | To migrate |
| `servicehub-mvp/app/api/community/admin/reports` and `/reports/[id]/resolve` | Read and resolve reports | same | To migrate |
| `servicehub-mvp/app/api/community/profiles/[id]` (PATCH) | Edit someone else's community profile | same | To migrate |
| `servicehub-mvp/app/api/embeddings/batch-generate` | Embed every resource in bulk (OpenAI spend) | same | To migrate |

All the Tidbits rows write through `getCommunityServiceClient()`
(`servicehub-mvp/lib/community/client.ts`), with the admin check from
`getCommunityViewer()`. Moving them is one change: `is_admin` from
`rpc('is_admin')` in `getCommunityViewer()`, then RLS policies for the
moderation writes, as for path models.

Related admin checks that do not use the service role, listed for the same move:

- ResourceHub's `/api/admin/*` routes and `/admin` pages check `profiles.role`
  but then use the person's own session, where RLS grants admins nothing, so
  parts of them (for example the user list) only see what any user sees.
- The `moderation_queue` read policy checks `profiles.role = 'admin'`.
- The Tidbits accept-answer function (SECURITY DEFINER) checks
  `profiles.role = 'admin'` for a `p_acting_user_id` passed in by its caller.
- Role model approval has no route; it is done in the database.

## Service-role use that is legitimate server-only work

Left as it is: these act for the system or for the signed-in person on rows
that are deliberately closed to the API, not as an admin.

- Sign-up, sign-in and completing a profile (`frontend/app/api/auth/*`,
  `servicehub-mvp/app/api/auth/signup`): creating accounts and setting
  `app_metadata`, which only the server may write.
- Scheduled jobs: reminders, newsletter, inactive check-in, Life Stats
  snapshot (`frontend/app/api/cron/*`, `frontend/lib/reminderRun.ts`).
- Event and check-in intake (`/api/events` in both apps, `/api/checkin`),
  push subscriptions, stories, the newsletter, text verification
  (`/api/me/sms/*`), the welcome email: tables or metadata with no API policy,
  written after the server checks who is asking.
- Family accounts (`frontend/app/api/family/*`, `/api/me/guardian-approval`):
  a guardian managing a child's account.
- `frontend/app/api/me/data`: a person downloading or erasing their own data
  across tables.
- Collaboration groups, organisation membership and vouching, verification
  links (`frontend/app/api/collab-groups`, `servicehub-mvp/app/api/organizations/*`,
  `/api/peers/vouch`, `/api/verification/*`): changes that involve two people,
  checked in code.
- Aggregates and background work: condition filters in search
  (`servicehub-mvp/app/api/search/barriers`), embeddings and agent memory
  (`servicehub-mvp/lib/embeddings/*`, `lib/agents/*`, `lib/supabase/vector-queries.ts`),
  trust labels (`lib/trust/authorRelationship.ts`).
- The FastAPI backend: every query uses the service role and is scoped to the
  verified caller in code (`backend/api/auth_guard.py`). It has no admin-only
  routes.
- ResourceHub's seed route and page: refused in production (`NODE_ENV`).
