import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
 * including before STEP 45 has been applied.
 */

const EVENTS = new Set([
  'landing_view', 'signup_view', 'signup_complete',
  'onboarding_step_view', 'onboarding_complete', 'app_open',
])

// Onboarding step ids, as defined in app/onboarding/page.tsx.
const STEPS = new Set([
  'character', 'barrierConnections', 'location', 'goalsAndDreams', 'motivation',
  'profile', 'spiritAnimal', 'personalize', 'recommendations',
])

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

  const step = event === 'onboarding_step_view' && STEPS.has(body?.step) ? body.step : null
  if (event === 'onboarding_step_view' && !step) return done()

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
