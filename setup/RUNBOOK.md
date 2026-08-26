# Setup Runbook

Everything that must be done **outside the code** for the shipped features to
actually work. Code is already deployed; these are the one-time steps.

---

## 1. Database migrations — run once

Both apps share **one** Supabase project (`rvflowbufyhsdpugextz`), so a single
file covers both.

1. Supabase dashboard → **SQL Editor** → New query
2. Paste all of [`setup/all_migrations.sql`](./all_migrations.sql) → **Run**

**Safe to re-run.** Every statement is idempotent (`IF NOT EXISTS`,
`DROP POLICY IF EXISTS` before each `CREATE POLICY`), and the whole file is
wrapped in one transaction — if anything fails, nothing is applied.

It bundles 17 migrations in dependency order:

| # | Migration | Unlocks |
|---|-----------|---------|
| 01 | reflection_learning | Journal/reflection agent learning |
| 02 | pattern_user_embeddings | Pattern-recognition matching |
| 03 | universal_agent_learning | Agent outcome tracking |
| 04 | path_models | Path Market community models |
| 05 | path_categories | **Path Market categories** (page is empty without this) |
| 06 | family_accounts | **18+ gate + parent→child supervision** |
| 07 | collab_groups | **Hare World collab groups** (create/join/leave) |
| 08 | servicehub_agent_learning | ResourceHub agent learning |
| 08 | community_tidbits | Tidbits community (posts/answers/votes) |
| 09 | post_unlocking_moment | "Unlocking moment" highlight |
| 10 | post_what_didnt_work | **"What didn't work" highlight** |
| 11 | rating_diagnostics | Nested rating breakdown by norm + level |
| 12 | rater_trust | **Rater trust tiers + norm verification_method** |
| 13 | organizations | **Orgs + leader vouching** (partnership trust layer) |
| 14 | rating_groups | **Per-organisation rating breakdown** |
| 15 | professional_verification | **One-time clinician attestation links** |
| 16 | shop_products | **Shop** (products, cart, orders, returns, reviews) |

> Steps 09–16 `ALTER` tables created in steps 08 and in the base schema, which
> is why the order matters. Don't reorder.

---

## 1b. Optional: demo products

Want to see the Shop and search results populated (like the seeded demo
services)? Run this **after** the migrations:

```
servicehub-mvp/scripts/2026_seed_demo_products.sql
```

16 sample products (earplugs, weighted blanket, fidget set, books, timers…).
No image files needed — the app generates a placeholder from each name.

They're all tagged `seller = 'Demo Seller'`, so removing them is one line:

```sql
DELETE FROM public.products WHERE seller = 'Demo Seller';
```

> Note: `/api/seed` (used for demo services) is blocked when
> `NODE_ENV=production`, so it can't seed the deployed app. This SQL can.

---

## 2. Environment variables

### Frontend — Vercel project `goal-planning-app`

| Variable | Status | Gates |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ set | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ set — **rotate**, see §4 | admin/server reads |
| `NEXT_PUBLIC_API_URL` | ✅ set | agents + **AI Assistant** |
| `NEXT_PUBLIC_SERVICE_HUB_URL` | ✅ set | cross-app SSO links |
| `RESEND_API_KEY` | ❌ **needed** | **email notifications** (no-ops silently without it) |
| `CRON_SECRET` | ❌ **needed** | secures the daily reminder cron |
| `REMINDER_FROM_EMAIL` | optional | reminder sender address |
| `ADMIN_EMAILS` | optional | admin alerting |
| `NEXT_PUBLIC_APP_URL` | optional | absolute links inside emails |

### ServiceHub — Vercel project `servicehub-six`

| Variable | Gates |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | community/admin server reads |
| `NEXT_PUBLIC_GOAL_PLANNING_URL` | "back to Goal Planning" links |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | ResourceHub agents |
| `CRON_SECRET` | scheduled jobs |

### Backend — Render

| Variable | Status | Gates |
|----------|--------|-------|
| `OPENAI_API_KEY` | ✅ set (verified live) | agents + **AI Assistant** |
| `OPENAI_MODEL` | optional | defaults `gpt-4o-mini` |
| `APP_MODE` | ✅ `production` | mode |
| `USE_AUTOGEN` | leave **unset** | keeps LangGraph orchestrator |

---

## 3. Feature → what it needs

| Feature | Migration | Env |
|---------|-----------|-----|
| Shop (products/cart) | 12 | — |
| "What didn't work" on posts | 10 | — |
| Path Market categories | 05 | — |
| 18+ gate / parent supervision | 06 | — |
| **Email notifications** | — | `RESEND_API_KEY`, `CRON_SECRET` |
| AI Assistant | — | already live ✅ |
| Progress Reels | — | none ✅ |
| Avatar / image placeholders | — | none ✅ |

Anything marked "none" already works once the frontend deploys.

---

## 4. ⚠️ Security: rotate the service-role key

`frontend/.env.vercel` has a real `SUPABASE_SERVICE_ROLE_KEY` **committed to
the repo**. That key bypasses RLS — full read/write on every table.

1. Supabase → Settings → API → **roll** the `service_role` key
2. Update it in both Vercel projects + Render
3. Remove the value from `frontend/.env.vercel` and gitignore that file

Note: rotating does not scrub it from git history — treat the old key as
compromised and ensure it's revoked.

---

## 5. Known operational notes

- **Render free tier sleeps.** The first AI Assistant message after idle takes
  ~40s to wake the backend; the UI shows a "waking up" note. A paid instance or
  a keep-warm ping removes this.
- **Vercel Hobby allows only one cron run per day** — this is what silently
  broke *every* deploy until it was fixed. Don't add a sub-daily cron to
  `frontend/vercel.json` on the Hobby plan.
