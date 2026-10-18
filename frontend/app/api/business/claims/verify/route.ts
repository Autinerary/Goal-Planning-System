import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimCodeMatches, CODE_TRIES } from '@/lib/listings'

export const dynamic = 'force-dynamic'

/** POST /api/business/claims/verify { id, code }: the code from the listing's email (five tries per code). */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = String(b?.id || '')
  const code = String(b?.code || '').replace(/\s/g, '')
  const admin = createAdminClient()
  const { data: claim } = await admin.from('listing_claims').select('id, user_id, status, method, code_hash, code_expires_at, attempts').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!claim || claim.method !== 'email_code') return NextResponse.json({ error: 'That claim wasn’t found.' }, { status: 404 })
  if (claim.status === 'verified') return NextResponse.json({ ok: true, already: true })
  if (claim.status !== 'pending' || !claim.code_hash) return NextResponse.json({ error: 'Ask for a new code.' }, { status: 400 })
  if (!claim.code_expires_at || Date.parse(claim.code_expires_at) < Date.now()) return NextResponse.json({ error: 'That code has expired. Ask for a new one.' }, { status: 400 })
  if (claim.attempts >= CODE_TRIES) return NextResponse.json({ error: 'Too many tries. Ask for a new code.' }, { status: 429 })
  await admin.from('listing_claims').update({ attempts: claim.attempts + 1 }).eq('id', claim.id)
  if (!claimCodeMatches(claim.id, code, claim.code_hash)) {
    const left = CODE_TRIES - claim.attempts - 1
    return NextResponse.json({ error: left > 0 ? `That code doesn’t match. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code doesn’t match. Ask for a new one.' }, { status: 400 })
  }
  const { error } = await admin.from('listing_claims').update({ status: 'verified', verified_at: new Date().toISOString(), code_hash: null }).eq('id', claim.id)
  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? 'Someone else was confirmed as this listing’s manager first. If that’s wrong, email heydevs@autinerary.ca.' : 'Could not save that.' },
      { status: error.code === '23505' ? 409 : 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
