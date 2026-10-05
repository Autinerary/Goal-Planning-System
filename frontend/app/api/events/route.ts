import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { START_ROLES, START_GOALS, PATHWAY_ITEM_IDS } from '@/lib/startHere'
import { AREA_IDS } from '@/lib/funnel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/events
 *
 * Records one onboarding funnel event (see frontend/lib/funnel.ts and
 * backend/database/migrations/2026_onboarding_funnel.sql). Accepts signed-out
 * visitors, because the first half of the funnel (landing page, sign-up form)
 * happens before there is an account. When the caller is signed in, the row
 * carries their user id so the funnel can follow them past sign-up.
 *
 * Everything is validated against a fixed vocabulary; anything else is
 * dropped. Always answers 204: analytics must never break or slow a page,
 * including before STEP 45 has been applied (or STEP 48, which allows the
 * "Start here" events, or STEP 49, which allows feature_use).
 */

const EVENTS = new Set([
  'landing_view', 'signup_view', 'signup_complete',
  'onboarding_step_view', 'onboarding_complete', 'app_open',
  'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
  'feature_use',
])

// Onboarding step ids, as defined in app/onboarding/page.tsx.
const STEPS = new Set([
  'about', 'goalsAndDreams', 'barrierConnections', 'location', 'motivation',
  'character', 'profile', 'spiritAnimal', 'personalize',
])

// Every other event with a step: "Start here" events carry the answers
// (lib/startHere.ts), feature_use the part of the app (lib/funnel.ts):
// "child", "child.services", "child.services.therapists", "child.services.yes".
const anyOf = (ids: string[]) => `(${ids.join('|')})`
const ROLE = anyOf(START_ROLES.map((r) => r.id))
const ROLE_GOAL = `${ROLE}\\.${anyOf(START_GOALS.map((g) => g.id))}`
const STEP_PATTERNS: Record<string, RegExp> = {
  start_role: new RegExp(`^${ROLE}$`),
  start_pathway: new RegExp(`^${ROLE_GOAL}$`),
  start_open: new RegExp(`^${ROLE_GOAL}\\.${anyOf(PATHWAY_ITEM_IDS)}$`),
  start_useful: new RegExp(`^${ROLE_GOAL}\\.(yes|no)$`),
  start_save: new RegExp(`^${ROLE_GOAL}$`),
  // Which part of the app (lib/funnel.ts).
  feature_use: new RegExp(`^${anyOf(AREA_IDS)}$`),
}

function stepFor(event: string, step: unknown): string | null {
  if (typeof step !== 'string') return null
  if (event === 'onboarding_step_view') return STEPS.has(step) ? step : null
  return STEP_PATTERNS[event]?.test(step) ? step : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// utm values and host names: letters, digits and a few separators only.
const TOKEN = /^[a-z0-9._-]{1,40}$/i
const CAMPAIGN = /^[a-z0-9 ._-]{1,80}$/i
const HOST = /^[a-z0-9.-]{1,120}$/i

function clean(value: unknown, pattern: RegExp): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null
}

const done = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return done()
  }

  const event = typeof body?.event === 'string' && EVENTS.has(body.event) ? body.event : null
  const visitorId = clean(body?.visitorId, UUID)
  const version = clean(body?.version, TOKEN)
  if (!event || !visitorId || !version) return done()

  // These events mean nothing without their step.
  const step = stepFor(event, body?.step)
  if ((event === 'onboarding_step_view' || event in STEP_PATTERNS) && !step) return done()

  let userId: string | null = null
  try {
    const { data } = await createServerSupabase().auth.getUser()
    userId = data.user?.id ?? null
  } catch {}

  try {
    await createAdminClient().from('onboarding_events').insert({
      visitor_id: visitorId,
      user_id: userId,
      event,
      step,
      channel: clean(body?.channel, TOKEN),
      campaign: clean(body?.campaign, CAMPAIGN),
      referrer_host: clean(body?.referrerHost, HOST),
      onboarding_version: version,
    })
  } catch {
    // Table missing (migration not applied) or a transient error: drop it.
  }
  return done()
}
