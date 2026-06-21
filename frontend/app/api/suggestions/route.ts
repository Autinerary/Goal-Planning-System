import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clamp(v: unknown, max: number, fallback = ''): string {
  if (typeof v !== 'string') return fallback
  return v.trim().slice(0, max)
}

/**
 * GET /api/suggestions
 * Returns suggestions the signed-in user has received (inbox) plus the ones
 * they have sent. Each list is joined with the other party's profile.
 *
 * Query: ?box=inbox|sent  (defaults to both)
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const box = req.nextUrl.searchParams.get('box') || 'both'
  const wantInbox = box === 'inbox' || box === 'both'
  const wantSent = box === 'sent' || box === 'both'

  const inboxP = wantInbox
    ? supabase
        .from('service_suggestions')
        .select('id, from_user_id, name, url, description, note, status, created_at')
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null } as any)

  const sentP = wantSent
    ? supabase
        .from('service_suggestions')
        .select('id, to_user_id, name, url, description, note, status, created_at')
        .eq('from_user_id', user.id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null } as any)

  const [inboxRes, sentRes] = await Promise.all([inboxP, sentP])
  if (inboxRes.error) {
    console.error('GET /api/suggestions inbox error:', inboxRes.error)
    return NextResponse.json({ error: inboxRes.error.message }, { status: 500 })
  }
  if (sentRes.error) {
    console.error('GET /api/suggestions sent error:', sentRes.error)
    return NextResponse.json({ error: sentRes.error.message }, { status: 500 })
  }

  // Collect other-party ids for profile join
  const otherIds = new Set<string>()
  for (const r of inboxRes.data || []) otherIds.add(r.from_user_id)
  for (const r of sentRes.data || []) otherIds.add(r.to_user_id)

  let profilesById: Record<string, any> = {}
  if (otherIds.size) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_emoji')
      .in('id', Array.from(otherIds))
    for (const p of profs || []) profilesById[(p as any).id] = p
  }

  const inbox = (inboxRes.data || []).map((r: any) => ({
    ...r,
    from: profilesById[r.from_user_id] || null,
  }))
  const sent = (sentRes.data || []).map((r: any) => ({
    ...r,
    to: profilesById[r.to_user_id] || null,
  }))

  return NextResponse.json({ inbox, sent })
}

/**
 * POST /api/suggestions
 * Body: { to_user_id: uuid, name: string, url?: string, description?: string, note?: string }
 * Requires the sender to be connected to the receiver.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const to_user_id = clamp(body?.to_user_id, 64)
  const name = clamp(body?.name, 160)
  if (!to_user_id || !UUID_RE.test(to_user_id) || !name) {
    return NextResponse.json({ error: 'to_user_id (uuid) and name are required' }, { status: 400 })
  }
  if (to_user_id === user.id) {
    return NextResponse.json({ error: 'Cannot suggest to yourself' }, { status: 400 })
  }

  const url = clamp(body?.url, 500) || null
  const description = clamp(body?.description, 500) || null
  const note = clamp(body?.note, 500) || null

  const { data, error } = await supabase
    .from('service_suggestions')
    .insert({ from_user_id: user.id, to_user_id, name, url, description, note })
    .select('id, to_user_id, name, url, description, note, status, created_at')
    .single()

  if (error) {
    console.error('POST /api/suggestions error:', error)
    // RLS WITH CHECK violation -> not connected
    if ((error as any).code === '42501' || (error as any).message?.toLowerCase().includes('policy')) {
      return NextResponse.json({ error: 'You must be connected to that user to send a suggestion' }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ suggestion: data })
}
