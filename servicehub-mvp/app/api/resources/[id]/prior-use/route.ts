import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROOF_EMAIL } from '@/lib/ratings/access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/resources/<id>/prior-use  { note? }
 * "I used it before joining": a claim with a code, for the email with the
 * proof (heydevs@autinerary.ca). An admin approves it in ResourceHub's admin
 * pages, and then the person may rate (claim_prior_use(), STEP 79).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const { data, error } = await supabase.rpc('claim_prior_use', { p_resource: params.id, p_note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null })
  if (error) {
    if (error.code === 'PGRST202') return NextResponse.json({ error: 'This opens soon.' }, { status: 503 })
    console.error('prior-use failed:', error.message)
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }
  const out = data as { code?: string; status?: string; error?: string }
  if (out?.error === 'not_needed') return NextResponse.json({ error: 'It is already in your wishlist or team, or you recommended it, so no proof is needed.', reason: 'not_needed' }, { status: 409 })
  if (out?.error) return NextResponse.json({ error: 'That service could not be found.' }, { status: 404 })
  return NextResponse.json({ code: out.code, status: out.status, email: PROOF_EMAIL })
}
