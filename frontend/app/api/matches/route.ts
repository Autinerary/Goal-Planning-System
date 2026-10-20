import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * Relationships in Hare World (STEP 87): matching, only between people who
 * opt in, showing only what they choose (what they're looking for, the areas
 * of life they're working on, a short note). A match is an ordinary friend
 * request (POST /api/connections): the other person accepts or not.
 *
 * GET                       your matching profile (or null) and, if you opted in, people to meet
 * PUT { looking_for, topics, note? }   opt in, or change what you show
 * DELETE                    opt out (you're no longer suggested to anyone)
 * POST { pass: <user id> }  not now: they aren't suggested to you again
 */

const LOOKING = ['friends', 'mentor', 'mentee', 'accountability']
const TOPICS = ['education', 'career', 'relationships', 'health', 'barrier', 'other']

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: mine, error } = await supabase.from('match_profiles').select('looking_for, topics, note, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ available: false, profile: null, people: [] })
    return NextResponse.json({ error: 'Could not load matching.' }, { status: 500 })
  }
  const [{ data: managed }, { data: profile }] = await Promise.all([
    supabase.rpc('my_account_is_managed'),
    supabase.from('profiles').select('discoverable').eq('id', user.id).maybeSingle(),
  ])
  let people: any[] = []
  if (mine) {
    const { data } = await supabase.rpc('match_candidates', { p_limit: 20 })
    people = (data || []) as any[]
  }
  return NextResponse.json({ available: true, managed: managed === true, discoverable: Boolean(profile?.discoverable), profile: mine || null, people })
}

export async function PUT(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const looking = Array.isArray(body?.looking_for) ? Array.from(new Set(body.looking_for.filter((x: unknown) => LOOKING.includes(x as string)))) : []
  const topics = Array.isArray(body?.topics) ? Array.from(new Set(body.topics.filter((x: unknown) => TOPICS.includes(x as string)))) : []
  if (!looking.length) return NextResponse.json({ error: 'Choose what you’re looking for.' }, { status: 400 })
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 280) : null
  const { error } = await supabase
    .from('match_profiles')
    .upsert({ user_id: user.id, looking_for: looking, topics, note, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'Relationships open soon.' }, { status: 503 })
    if (error.code === '42501') return NextResponse.json({ error: 'Matching isn’t available for Family accounts.' }, { status: 403 })
    return NextResponse.json({ error: 'That didn’t save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await supabase.from('match_profiles').delete().eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'That didn’t work.' }, { status: step64Missing(error) ? 503 : 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const other = typeof body?.pass === 'string' && UUID_RE.test(body.pass) ? body.pass : null
  if (!other || other === user.id) return NextResponse.json({ error: 'Choose someone.' }, { status: 400 })
  const { error } = await supabase.from('match_passes').upsert({ user_id: user.id, other_id: other }, { onConflict: 'user_id,other_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'That didn’t save.' }, { status: step64Missing(error) ? 503 : 500 })
  return NextResponse.json({ passed: other })
}
