# Backend route audit: sign-in and ownership (8 October 2026)

Every HTTP route in the FastAPI backend, as of this branch: `fix/route-auth-audit`
on top of `fix/backend-route-auth`. The audit asked two questions of each:
- Does it require a signed-in user?
- When it is given a person's id, or the id of something they own, does it
  check that the caller is that person or their guardian?

The sign-in column was read from the code itself, from each handler's
dependencies. Callers come from searching the main app, ResourceHub,
`mobile/` and `desktop/`.

**The headline:**
- 37 routes: 15 require sign-in, 3 accept it but don't require it, and 19
  have none.
- `fix/backend-route-auth` closed 5. This branch closes 3 more and tightens
  2, all clear-cut.
- 11 routes still fail and need your decision. Most are messaging, calls and
  memes, which trust a `?user_id` in the address and whose only caller sends
  no token.

**Status, 11 October 2026**, with every review branch merged:
- Messaging, calls and memes need a session, act only as the caller, and
  only between connected people (commit 3d78f99,
  `api/routes/social_access.py`).
- `GET /api/onboarding/jobs/{job_id}` answers only the job's owner or their
  guardian; anyone else gets the 404 of a job that doesn't exist. Setup sends
  its token on each poll.
- The login and register stubs are removed. The app's login route that sent
  passwords to them was already gone.
- `CRON_SECRET` is set in both Vercel projects (checked), and every scheduled
  job now needs it in production (`lib/cronAuth.ts` in both apps). The
  `x-vercel-cron` header is no longer accepted.
- Unchanged on purpose: signed-out reflections and the assistant, within the
  anonymous budget. The self-hosted model is listed but not switched on in
  production, so the model server without a key isn't in use.

## Every route

**Status** says where each route stands:
- **fixed (route-auth)** or **fixed here**, with the branch;
- **open on purpose:** static or shared data, nobody's personal data;
- **decision:** see the next section.

| Method | Path | Sign-in | Owner check | Callers (token sent?) | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | none | — | none | open on purpose |
| GET | `/health` | none | — | `frontend/lib/wakeBackend.ts` (no) | open on purpose (shows the commit and model names) |
| GET | `/config` | none | — | none | open on purpose |
| POST | `/api/auth/register` | none | — | none | stub, see below |
| POST | `/api/auth/login` | none | — | `frontend/app/api/auth/login/route.ts` (no) | stub, see below |
| POST | `/api/onboarding/` | required (age and approval gate) | body userId must be the caller | onboarding page (yes) | ok |
| POST | `/api/onboarding/jobs` | required (gate) | same | onboarding page (yes) | ok |
| GET | `/api/onboarding/jobs/{job_id}` | none | none | onboarding page polling (**no**) | **decision** |
| GET | `/api/onboarding/jobs/latest/{user_id}` | required | self or guardian | none | **fixed here** |
| PATCH | `/api/onboarding/{user_id}` | required, now with the age and approval gate | self or guardian | none | fixed (route-auth); gate **added here** |
| GET | `/api/onboarding/path/{path_id}` | required | owner from the plan | path page, AgentPathContext, serverPaths (yes) | fixed (route-auth) |
| GET | `/api/onboarding/user/{user_id}/path` | required | self or guardian | path page, AgentPathContext, mobile (yes) | ok |
| GET | `/api/onboarding/user/{user_id}/paths` | required | self or guardian | serverPaths (yes) | ok |
| POST | `/api/onboarding/user/{user_id}/paths/{path_id}/activate` | required | self or guardian | serverPaths (yes) | ok |
| DELETE | `/api/onboarding/user/{user_id}/paths/{path_id}` | required | self or guardian | none | ok; cache delete **fixed here** |
| POST | `/api/onboarding/goal-helper` | required (gate) | — | GoalHelper, ChatSetup (yes) | ok |
| GET | `/api/onboarding/questions` | none | — | none | open on purpose (static) |
| GET | `/api/paths/{path_id}` | required | owner of the in-memory plan | none | fixed (route-auth) |
| POST | `/api/paths/{path_id}/adapt` | required | owner of the in-memory plan | none | fixed (route-auth) |
| GET | `/api/paths/milestones/{milestone_id}/common-mistakes` | none | — | CommonMistakes (no) | open on purpose (totals across people, at least 5) |
| POST | `/api/reflections/` | optional (anonymous allowed) | uses the verified id only | journal pages (yes, when signed in) | **decision** |
| GET | `/api/reflections/user/{user_id}` | required | self or guardian | journal history (yes) | fixed (route-auth) |
| GET | `/api/reflections/questions/{context_type}` | none | — | none | open on purpose (static) |
| POST | `/api/messaging/send` | none | trusts `?user_id` as the sender | pit stop (**no**) | **decision** |
| GET | `/api/messaging/conversations` | required | the caller's own; `?user_id` ignored | none | **fixed here** |
| GET | `/api/messaging/conversation/{other_user_id}` | none | trusts `?user_id` | pit stop (**no**) | **decision** |
| POST | `/api/calls/start` | none | trusts `?user_id` | pit stop (**no**) | **decision** |
| POST | `/api/calls/{call_id}/end` | none | checks the participant against `?user_id`, which anyone can set | pit stop (**no**) | **decision** |
| GET | `/api/calls/history` | none | trusts `?user_id` | pit stop (**no**) | **decision** |
| POST | `/api/memes/share` | none | trusts `?user_id` | pit stop (**no**) | **decision** |
| GET | `/api/memes/feed` | none | trusts `?user_id` | pit stop (**no**) | **decision** |
| POST | `/api/memes/like` | none | trusts `?user_id` | pit stop (**no**) | **decision** |
| GET | `/api/memory/{user_id}` | required | self or guardian | none | **fixed here** |
| POST | `/api/assistant/chat` | optional | — | the app's own `/api/assistant/chat` proxy (yes, when signed in) | **decision** |
| GET | `/api/models`, `/api/models/` | none | — | settings page (no) | open on purpose (model list) |
| GET | `/api/models/usage` | optional | the caller's own totals | settings page (yes) | ok |

Every route that touches the database does so with the service-role key, so
these checks in the code are the only protection. Row-level security never
applies to backend queries.

## Fixed on this branch (no caller would notice)

1. **`GET /api/memory/{user_id}`.** It returned anyone's past goals and
   conditions to whoever had their account id. `agent_memory` holds 107 rows.
   Now: the person, or their guardian.
2. **`GET /api/onboarding/jobs/latest/{user_id}`.**
   - It returned anyone's latest generation status, path id and error text.
   - The error can be the crisis message shown when a goal mentions
     self-harm; today all 223 stored errors are "too many requests".
   - The path id it returned also opened `/api/onboarding/path/{id}`
     before `fix/backend-route-auth`.
   - Now: the person, or their guardian.
3. **`GET /api/messaging/conversations`.** It listed who anyone had messaged.
   Now it lists the caller's own conversations and ignores `?user_id`.
   Nothing calls it.
4. **`PATCH /api/onboarding/{user_id}`.** It now uses the same gate as
   creating a plan (`onboarding_user_id`: age and guardian approval). It can
   run a whole new generation.
5. **Deleting a path** dropped any path id from the server's in-memory cache
   before checking whose it was. The database delete was already scoped to
   the caller. It now drops only the caller's own.

Tests are in `tests/test_route_auth.py` (8):
- each guarded route depends on a session;
- signed out gets 401;
- someone else gets 404;
- the owner and a guardian get through;
- the conversation list ignores `?user_id`;
- the cache delete keeps other people's paths.

## Needs your decision

| Routes | What anyone can do today | Data today | Fix, and why it isn't done here |
| --- | --- | --- | --- |
| Messaging (`send`, `conversation/{id}`), calls (`start`, `end`, `history`), memes (`share`, `feed`, `like`) | Read the messages between any two people, send messages, start and end calls, share and like as anyone, and read anyone's call log and meme feed | 0 messages, 0 calls, 1 meme, 0 meme likes | Take the caller from `current_user_id`, not `?user_id`, and have the pit stop page send `backendAuthHeaders()` on its 13 calls. That changes a live page, and these features may not be staying. |
| `GET /api/onboarding/jobs/{job_id}` | Read any job's status, path id and error, given its id (a random UUID) | 295 jobs | Check the job's `user_id` against the caller, and send the token from the onboarding page's poll (the headers are already built a few lines above). It changes the live onboarding flow. |
| `POST /api/reflections/` | Signed-out callers run the whole reflection pipeline, which costs LLM calls | 0 reflections | Anonymous use is deliberate (comment in the route). Both callers already send a token when signed in, so requiring sign-in would be easy. |
| `POST /api/assistant/chat` | Signed-out callers use the assistant, within a shared anonymous budget (30 requests a minute, 300k tokens a day) | — | Open on purpose. Requiring sign-in is one line in the proxy and the route. |

## Other things the audit found

- **Spend not tied to the caller.** `PATCH /api/onboarding/{id}`,
  `POST /api/paths/{id}/adapt` and `POST /api/reflections/` don't set the
  caller's LLM selection. Their LLM spend lands in the shared anonymous
  budget, not the person's own.
- **API docs are public.** FastAPI's `/docs`, `/redoc` and `/openapi.json` are
  on, which lists every route above for anyone. They can be turned off in
  production with `docs_url=None, redoc_url=None, openapi_url=None`.
- **The login stub receives passwords.** `/api/auth/login` and `/register` are
  leftovers that return a mock token. The app's own login route
  (`frontend/app/api/auth/login/route.ts`) still sends each person's email
  and **password** to the stub before signing in with Supabase. The backend
  doesn't need them. Remove the call, then the stubs.
- **The Modal model server has no key.** `backend/scripts/modal_app.py` defines
  a GPU endpoint, and the backend calls it with "local-no-auth". If it is
  deployed, anyone who finds the address can spend GPU time.

## Vercel cron: what a proper check looks like

`servicehub-mvp/app/api/embeddings/batch-generate/route.ts` lets in a request
carrying `x-vercel-cron: 1`. Anyone can send that header. Vercel's
documentation doesn't use it. The one mechanism it gives is
[a secret](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs):
- set `CRON_SECRET` in the project;
- Vercel then sends `Authorization: Bearer <CRON_SECRET>` on every cron call;
- the route compares the two.

The only cron header Vercel documents, `x-vercel-cron-schedule`, says which
schedule fired and proves nothing. Nothing schedules batch-generate:
ResourceHub has no `vercel.json` crons. So the header check only helps
outsiders.

A proper check fails closed when the secret is missing:

```ts
const secret = process.env.CRON_SECRET
if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

For batch-generate, that means:
- drop the `x-vercel-cron` line;
- keep the bearer check;
- keep the admin path, through `is_admin()` once `feat/admin-role` is in.

The same review of the main app's cron routes:

| Route | Check today | Problem |
| --- | --- | --- |
| `frontend/app/api/cron/life-stats-snapshot` | `x-vercel-cron: 1`, or the bearer | The bare header lets anyone run it |
| `frontend/app/api/cron/newsletter` | The bearer, **only if `CRON_SECRET` is set** | Fails open: with no secret, anyone can send the newsletter |
| `frontend/app/api/cron/inactive-checkin` | Same | Fails open: anyone can send the check-in emails |
| `frontend/app/api/cron/reminders` (`frontend/lib/reminderRun.ts`) | Same | Fails open: anyone can send the reminders |

Whether `CRON_SECRET` is set in both Vercel projects is **NOT YET VERIFIED**.
Confirm it first. If it isn't set, making these fail closed would stop the
scheduled jobs. That ordering is why none is changed here.
