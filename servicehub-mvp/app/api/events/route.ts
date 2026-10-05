import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SETUP_STEPS } from '@/lib/onboarding/setup'
import { PROMPT_IDS } from '@/lib/track'

export const dynamic = 'force-dynamic'

/**
 * POST /api/events
 *
 * ResourceHub's first-session events, for the measures Riipen Labs Group 8
 * suggested: "onboarding completion rate, time from landing to first
 * resource viewed, and ... the percentage of search results returned within
 * the user's stated radius", and whether each prompt that asks for more later
 * is taken up ("validating each trigger before adding more"). They go to the
 * same table as Goal Planning's (onboarding_events, STEP 45), allowed by
 * STEP 51 (backend/database/migrations/2026_resourcehub_events.sql), and are
 * reported by backend/scripts/onboarding_funnel.py.
 *
 *   rh_visit            first | return                first visit from this browser,
 *                                                    or its first on a later day
 *   rh_setup_step       role | topic | first        a setup step was shown
 *   rh_setup_complete   topic | no_topic            setup was saved
 *   rh_first_resource   setup | browse              first place opened, and from where
 *   rh_search           '<near>/<shown>'            a search with a location, page 1
 *   rh_prompt           '<shown|yes|no|later>.<prompt>'
 *
 * Nothing typed is sent. Validated against this vocabulary; anything else is
 * dropped. Always answers 204: analytics must never break or slow a page,
 * including before STEP 51 is applied.
 */

const PATTERNS: Record<string, RegExp | null> = {
  rh_visit: /^(first|return)$/,
  rh_setup_step: new RegExp(`^(${SETUP_STEPS.join('|')})$`),
  rh_setup_complete: /^(topic|no_topic)$/,
  rh_first_resource: /^(setup|browse)$/,
  rh_search: /^\d{1,2}\/\d{1,2}$/,
  rh_prompt: new RegExp(`^(shown|yes|no|later)\\.(${PROMPT_IDS.join('|')})$`),
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN = /^[a-z0-9._-]{1,40}$/i

function stepFor(event: string, step: unknown): string | null | undefined {
  const pattern = PATTERNS[event]
  if (pattern === null) return null
  // The first release sent the first visit with no step.
  if (event === 'rh_visit' && (step === undefined || step === null)) return 'first'
  if (typeof step !== 'string' || !pattern.test(step)) return undefined
  if (event === 'rh_search') {
    const [near, shown] = step.split('/').map(Number)
    if (shown < 1 || shown > 20 || near > shown) return undefined
  }
  return step
}

const done = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return done()
  }

  const event = typeof body?.event === 'string' && body.event in PATTERNS ? body.event : null
  const visitorId = typeof body?.visitorId === 'string' && UUID.test(body.visitorId) ? body.visitorId : null
  const version = typeof body?.version === 'string' && TOKEN.test(body.version) ? body.version : null
  if (!event || !visitorId || !version) return done()
  const step = stepFor(event, body?.step)
  if (step === undefined) return done()

  let userId: string | null = null
  try {
    const { data } = await createClient().auth.getUser()
    userId = data.user?.id ?? null
  } catch {}

  try {
    await createAdminClient().from('onboarding_events').insert({
      visitor_id: visitorId,
      user_id: userId,
      event,
      step,
      onboarding_version: version,
    })
  } catch {
    // Table missing, STEP 51 not applied, or a transient error: drop it.
  }
  return done()
}
