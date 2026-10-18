import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { TERMS_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'

// Before STEP 79 there is nothing to record, and nobody is asked.
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /terms_acceptances/.test(e.message || ''))

/**
 * GET  /api/me/terms  whether the signed-in person has accepted this version
 *      of the Terms and Conditions (lib/legal.ts)
 * POST /api/me/terms  accept it, from the notice (TermsNotice)
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ accepted: true })
  const { data, error } = await supabase.from('terms_acceptances').select('version').eq('user_id', user.id).eq('version', TERMS_VERSION).limit(1)
  if (error) return NextResponse.json({ accepted: true, open: !missing(error) })
  return NextResponse.json({ accepted: (data || []).length > 0, version: TERMS_VERSION })
}

export async function POST() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { error } = await supabase.from('terms_acceptances').insert({ user_id: user.id, version: TERMS_VERSION, via: 'notice' })
  // Already accepted is fine.
  if (error && error.code !== '23505' && !missing(error)) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  return NextResponse.json({ accepted: true, version: TERMS_VERSION })
}
