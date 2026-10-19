/**
 * /api/community/rules — the community rules, accepted once (STEP 83).
 *   GET  — the words, and whether you have agreed to this version
 *   POST — agree
 * Shown as a two-page pop-up the first time someone opens Tidbits, and before
 * a first post, answer or rating (the Tidbits round's planning note, Goal 2).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RULES, RULES_INTRO, RULES_VERSION, step83Missing } from '@/lib/community/tidbits'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let accepted = false
  let open = true
  if (user) {
    const { data, error } = await supabase.from('community_rules_acceptances').select('version').eq('user_id', user.id).maybeSingle()
    if (error) open = !step83Missing(error)
    accepted = !!data && data.version >= RULES_VERSION
  }
  return NextResponse.json({ version: RULES_VERSION, intro: RULES_INTRO, rules: RULES, signedIn: !!user, accepted, open })
}

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { error } = await supabase
    .from('community_rules_acceptances')
    .upsert({ user_id: user.id, version: RULES_VERSION, accepted_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    if (step83Missing(error)) return NextResponse.json({ ok: true, open: false })
    console.error('[community] rules failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, version: RULES_VERSION })
}
