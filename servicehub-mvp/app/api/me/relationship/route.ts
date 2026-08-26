import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RELATIONSHIP_WEIGHT, type Relationship } from '@/lib/trust/relationship'

export const dynamic = 'force-dynamic'

const VALID = Object.keys(RELATIONSHIP_WEIGHT) as Relationship[]

/**
 * POST /api/me/relationship — declare how you relate to one of your own norms.
 *
 * This is what makes the weighting real: without a declaration we fall back to
 * "lived" for weighting (safe) but show no badge, so most people would carry no
 * relationship at all. RLS scopes the update to the caller's own rows.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const barrierType = String(body?.barrierType || '').trim().toLowerCase()
  const relationship = String(body?.relationship || '').trim()

  if (!barrierType) {
    return NextResponse.json({ error: 'Which norm?' }, { status: 400 })
  }
  if (!VALID.includes(relationship as Relationship)) {
    return NextResponse.json({ error: 'Pick a valid relationship.' }, { status: 400 })
  }

  // Scoped to the caller's own rows — you can only speak for yourself.
  const { error } = await supabase
    .from('user_barriers')
    .update({ relationship, relationship_declared: true })
    .eq('user_id', user.id)
    .eq('barrier_type', barrierType)

  if (error) {
    console.error('[relationship] update failed:', error.message)
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, relationship })
}
