import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'
import { cleanNeeds, findNorm, findRole, isOtherNorm, MAX_SETUP_NEEDS } from '@/lib/onboarding/setup'

export const dynamic = 'force-dynamic'

/**
 * POST /api/onboarding/save
 *
 * ResourceHub's three-step setup (app/onboarding/page.tsx, Riipen Labs Group
 * 8): who you are, optionally one topic, and up to two things you hope to
 * find. Body: { role, topic?, topicNote?, needs? }.
 *
 * Everything asked is saved and used: the role on the profile, the topic as a
 * norm (it matches places rated for it), and the needs in the account's
 * metadata (they choose what "For you" shows). The old setup's life stage,
 * goals and notes were asked and never saved.
 *
 * How someone relates to a norm (lived experience, family, professional) is
 * left undeclared, as the profile page says, until they choose it there.
 *
 * Goal Planning's integration still posts to /api/onboarding/complete, which
 * is unchanged.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const role = findRole(body?.role)
  if (!role) return NextResponse.json({ error: 'Choose who you are here as.' }, { status: 400 })
  const topic = typeof body?.topic === 'string' && body.topic ? findNorm(body.topic) : undefined
  if (body?.topic && !topic) return NextResponse.json({ error: 'That topic is not one we know.' }, { status: 400 })
  const note =
    topic && isOtherNorm(topic.id) && typeof body?.topicNote === 'string' ? body.topicNote.trim().slice(0, 200) : ''
  const needs = cleanNeeds(body?.needs).slice(0, MAX_SETUP_NEEDS)

  const { data: updated, error: roleError } = await supabase
    .from('profiles')
    .update({ role: role.id, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('id')
  if (roleError || !updated || updated.length === 0) {
    console.error('[onboarding/save] role not saved:', roleError?.message || 'no profile row')
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }

  if (topic) {
    const { data: existing } = await supabase
      .from('user_barriers')
      .select('id')
      .eq('user_id', user.id)
      .eq('barrier_type', topic.id)
      .limit(1)
    if (!existing || existing.length === 0) {
      const { error } = await supabase.from('user_barriers').insert({
        user_id: user.id,
        barrier_category: topic.group,
        barrier_type: topic.id,
        ...(note ? { notes: note } : {}),
      })
      if (error) {
        console.error('[onboarding/save] topic not saved:', error.message)
        return NextResponse.json({ error: 'Could not save your topic. Please try again.' }, { status: 500 })
      }
    }
    // Matching by similar people uses an embedding of their norms.
    setImmediate(() => {
      generateUserEmbeddingJob(user.id).catch((e) => console.error('[onboarding/save] embedding:', e))
    })
  }

  // Merged into the account's metadata; other keys are kept.
  const { error: metaError } = await supabase.auth.updateUser({ data: { resourcehub_needs: needs } })
  if (metaError) {
    console.error('[onboarding/save] needs not saved:', metaError.message)
    return NextResponse.json({ error: 'Could not save what you hope to find. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
