# Other people's details in stored plans: filtered on read (8 October 2026)

A stored plan (`user_paths.payload`) keeps the Pattern Recognition result it
was built with. That result lists the people the plan was matched against.
The lists were sent wherever the plan went. This branch removes them from
every place an app returns a plan. Stored data is not changed. Reverting the
branch brings the old responses back.

## What was exposed

| | |
| --- | --- |
| Stored plans holding other people's entries | 81 of 95 |
| Entries | 487, in `similar_users` (each: account id, raw conditions, `journey` = "Goals: … Barriers: … Milestones: N.", success rate, match score), plus their ids again in `retrieved_user_ids` |
| Entries for accounts since deleted | 10 |
| Entries for supervised (child) accounts | 18 |
| Anywhere else in a plan that names another account | Nowhere. A scan of all 95 plans for any other account's id found only these two fields. `patterns` and `models` hold fixed text from older code, not people. |

## Every place a plan is returned, now filtered

| Where | Who receives it | Change |
| --- | --- | --- |
| `GET /api/me/path` (`frontend/app/api/me/path/route.ts`) | The owner. Loaded on every page through `AgentPathContext` | filtered |
| `GET /api/friend/[id]` (also used by `/compare/[id]`) | A connected person | filtered |
| `GET /api/family/children/[id]/path` | The child's guardian | filtered |
| `GET /api/me/data` (backup download) | The owner: every plan row, not just the active one | filtered |
| `GET /api/onboarding/user/{id}/path` (FastAPI) | Owner or guardian. Also the mobile app (`mobile/lib/api.ts`) | filtered |
| `GET /api/onboarding/path/{path_id}` (FastAPI) | Owner or guardian (since `fix/backend-route-auth`) | filtered |
| `GET /api/paths/{path_id}` (FastAPI, in-memory plans) | Owner or guardian | filtered |

**How it works:**
- `backend/core/path_privacy.py` and `frontend/lib/pathPrivacy.ts` apply the
  same rule to a copy of the plan. They remove `similar_users` and
  `retrieved_user_ids` from the `pattern_recognition` entry and add
  `similar_users_count`.
- The banner text ("Found N similar users…") is unchanged.
- Both sides are tested against `backend/tests/fixtures/plan_with_other_people.json`.
  - `backend/tests/test_path_privacy.py`: 6 tests, including the three
    FastAPI routes end to end.
  - `frontend/lib/pathPrivacy.test.mjs`: 4 checks.

**What isn't filtered, and why that's safe:**
- **The loaders that also feed write-backs** (`_load_path_by_user`, and the
  PATCH route that re-saves a plan). Filtering there would have changed
  stored data.
- **Routes that never return a plan:**
  - the onboarding and job responses (ids only);
  - the reflection responses;
  - plan summaries (`/user/{id}/paths`);
  - `/api/me/welcome`;
  - the child list (a count).
- **ResourceHub:** it doesn't read `user_paths`.

### One real plan, before and after

The most recently updated active plan of a real account with 10 matches:

| | `pattern_recognition.result` | Whole plan as JSON |
| --- | --- | --- |
| Before | `similar_users`: 10 entries, each `user_id` (36 chars), `barriers` (list), `journey` (text), `success_rate`, `similarity`. `retrieved_user_ids`: 10 account ids. Also `patterns`, `models`, `confidence`, `explanation` | 362,552 bytes |
| After | `similar_users_count`: 10. `patterns`, `models`, `confidence` and `explanation` are unchanged | 359,948 bytes (2,604 fewer) |

The explanation reads "Found 10 similar users with 0 success patterns" both
before and after. Everything else in the plan is identical, and the stored
row is unchanged.

## Who else reads these fields, and whether anything breaks

Nothing breaks. No browser or mobile code reads either field. The one
component that reads the Pattern Recognition result (`AgentInsightsBanner`)
uses only `explanation`.

| Reader | Uses | Affected? |
| --- | --- | --- |
| `pattern_recognition_agent.py` | Builds both fields; uses the count for confidence | No: generation runs before any filter |
| `orchestrator.py` | Puts the result in the plan; copies `retrieved_user_ids` into `user_latest_context` | No |
| `synthesis_engine.py`, `core/memory.py` | The "Found N similar users" sentence only | No |
| `user_latest_context.retrieved_user_ids` | Written by the orchestrator. Read only by `get_user_latest_context`, whose one caller ignores it. Never returned to anyone | No |
| `backend/scripts/vector_deck_walkthrough.py` (untracked, not mine) | `len(similar_users)`, read from the database with the service role | No: reads stored data |
| `vector_deck_pull.py`, `vector_evaluation_pull.py`, `build_deck_evaluation.py`, the experiment scripts | Plan races, string literals, or `pattern_user_embeddings` directly | No |
| `tests/test_embedding_privacy.py` | The agent's own result | No |
| `GET /api/me/data` backup, then `PUT` restore | A restored backup now has no match lists | **Changes stored data, only when a person restores their own backup.** That restore may already fail: it upserts on `user_id`, but the table's key became `(user_id, path_id)` in `database/user_paths_multi.sql`. |

## What this does not close

1. **Direct reads through the Supabase API.**
   - `database/phase_b_shared_data.sql` gives SELECT on `user_paths` to the
     owner ("Owner can read own path") and to connected people ("Friends can
     read connected path").
   - If those policies are live, anyone signed in can query the table with
     their own session and the public anon key, and get the stored plan whole.
   - `/api/me/path` and the friend view read through the person's session, so
     they only work if the policies exist. That suggests they do, but this is
     **NOT YET VERIFIED**. `setup/checks/user_paths_read_access.sql` is a
     read-only query for the SQL editor that answers it.
   - Closing it without changing data needs a permissions change. One option
     is a view that returns the filtered plan, plus revoking direct SELECT on
     `payload`. The owner's saves (an upsert) must keep working, so that is
     not a one-line change.
2. **Anyone can make themselves "connected" to anyone.**
   - `POST /api/connections` stores the status the client sends: "connected"
     or "matched" with any real account id.
   - The `social_connections` policies check only `owner_id`.
   - `is_connected_to` counts connected or matched rows in either direction.
   - So any signed-in person can grant themselves the friend view of anyone:
     their whole plan, their profile including email, their calendar and
     their progress. The view is now without third parties, but the person's
     own data is still exposed.
   - Production has 4 connections (3 pending, 1 connected).
   - The fix is to accept only "pending" from clients, and let only the
     target's accept flow set "connected". It needs a route change plus a
     policy or trigger, so it isn't in this branch.
3. **Copies already delivered.** Browsers that loaded a plan before this ships
   held it in memory. The backup files people downloaded still contain the
   entries.

## What it would take to stop storing them (not built)

- **At write time:**
  - Strip the two fields, and keep `similar_users_count`, where generation
    assembles the plan (`backend/api/routes/onboarding.py`, the
    `agentResponses` spread before `_save_path`).
  - Keep the matched ids only in `user_latest_context`. It is server-only:
    RLS is on with no policies.
  - The agent and the orchestrator need no change. Generation uses the
    matches before the plan is saved.
- **PATCH re-saves the prior plan,** so the same strip belongs on that save.
- **The 81 stored plans keep their entries until rewritten.** Removing them is
  a data change, and irreversible without a backup:
  `UPDATE user_paths SET payload = <filtered payload>`. It needs your
  sign-off and a backup first.
- **The deck script** that counts `similar_users` from the database would read
  `similar_users_count` instead.
- **Deleted accounts:** once nothing stores the entries, a deleted person's
  conditions stop living on in other people's plans (10 entries today).
