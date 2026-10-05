import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'
import { readMyProfile } from '@/lib/onboarding/profile'
import { findNorm, isOtherNorm } from '@/lib/onboarding/setup'

export const dynamic = 'force-dynamic'

/**
 * POST /api/me/norms — { type, notes? }: add a norm (topic) to your profile.
 * PATCH /api/me/norms — { type, severity }: how much it affects daily life,
 *   1 to 5, or null for not said. Setup asked this of everyone (twice) before
 *   showing anything; Group 8 asked for it to move, not vanish, since it
 *   weighs recommendations and groups ratings by level.
 * DELETE /api/me/norms?type=...: remove one of your own.
 *
 * The profile page and the "add it to your matches?" prompt use these
 * (Riipen Labs, Group 8: identity, health and more topics are added after
 * setup, when someone chooses). The privacy page promises these answers can
 * be skipped, changed or removed. A norm a professional or organisation
 * confirmed is not removed here, so that record is never lost by a stray tap.
 * Both answer with the updated profile.
 */

async function signedIn() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function refreshEmbedding(userId: string) {
  setImmediate(() => {
    generateUserEmbeddingJob(userId).catch((e) => console.error('[me/norms] embedding:', e))
  })
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const norm = findNorm(body?.type)
  if (!norm) return NextResponse.json({ error: 'That is not one we know.' }, { status: 400 })
  const notes = isOtherNorm(norm.id) && typeof body?.notes === 'string' ? body.notes.trim().slice(0, 200) : ''

  const { data: existing } = await supabase
    .from('user_barriers')
    .select('id')
    .eq('user_id', user.id)
    .eq('barrier_type', norm.id)
    .limit(1)
  if (!existing || existing.length === 0) {
    const { error } = await supabase.from('user_barriers').insert({
      user_id: user.id,
      barrier_category: norm.group,
      barrier_type: norm.id,
      ...(notes ? { notes } : {}),
    })
    if (error) return NextResponse.json({ error: 'Could not add that. Please try again.' }, { status: 500 })
    refreshEmbedding(user.id)
  }
  return NextResponse.json({ signedIn: true, ...(await readMyProfile(supabase, user)) })
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const type = typeof body?.type === 'string' ? body.type.trim() : ''
  const severity = body?.severity === null ? null : Number(body?.severity)
  if (!type || (severity !== null && !(Number.isInteger(severity) && severity >= 1 && severity <= 5))) {
    return NextResponse.json({ error: 'Choose how much it affects daily life, or "Not said".' }, { status: 400 })
  }

  const { data: changed, error } = await supabase
    .from('user_barriers')
    .update({ severity })
    .eq('user_id', user.id)
    .eq('barrier_type', type)
    .select('id')
  if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  if (!changed || changed.length === 0) return NextResponse.json({ error: 'That is not on your profile.' }, { status: 404 })
  refreshEmbedding(user.id)
  return NextResponse.json({ signedIn: true, ...(await readMyProfile(supabase, user)) })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  const type = (request.nextUrl.searchParams.get('type') || '').trim()
  if (!type) return NextResponse.json({ error: 'Which one?' }, { status: 400 })

  const { data: rows } = await supabase
    .from('user_barriers')
    .select('id, verification_method, verified_at')
    .eq('user_id', user.id)
    .eq('barrier_type', type)
  const confirmed = (rows || []).some(
    (r: any) => Boolean(r.verified_at) || (Boolean(r.verification_method) && r.verification_method !== 'self')
  )
  if (confirmed) {
    return NextResponse.json(
      { error: 'This one was confirmed by a professional or an organisation, so it stays. Email us if you want it removed.' },
      { status: 409 }
    )
  }
  if (rows && rows.length > 0) {
    const { data: removed, error } = await supabase
      .from('user_barriers')
      .delete()
      .in('id', rows.map((r: any) => r.id))
      .select('id')
    if (error || !removed || removed.length === 0) {
      return NextResponse.json({ error: 'Could not remove that. Please try again.' }, { status: 500 })
    }
    refreshEmbedding(user.id)
  }
  return NextResponse.json({ signedIn: true, ...(await readMyProfile(supabase, user)) })
}
