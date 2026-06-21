import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const VALID_CATEGORIES = ['friends', 'mentors', 'rolemodels'] as const
type Category = (typeof VALID_CATEGORIES)[number]

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (VALID_CATEGORIES as readonly string[]).includes(value)
}

/**
 * GET /api/connections
 * Returns the signed-in user's social connections grouped by category.
 *
 * Includes BOTH:
 *   (a) rows the user created themselves (owner_id = me) — free-form or
 *       outgoing-pending or matched
 *   (b) rows where someone else added the user as their friend and the user
 *       has accepted (target_user_id = me AND status = 'connected') — so
 *       Facebook-style accepted friendships appear in both peoples' lists
 *       from a single canonical row.
 *
 * For (b) we flip the perspective: the friend card displays the OTHER user's
 * profile (display_name / avatar / dream) rather than the row's stored name.
 */
export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // (a) my own rows
  const ownRowsP = supabase
    .from('social_connections')
    .select('id, category, name, role, status, icon, target_user_id, match_dream, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  // (b) inbound rows where I'm the target AND we're connected (accepted requests)
  const inboundRowsP = supabase
    .from('social_connections')
    .select('id, owner_id, category, name, role, status, icon, match_dream, created_at')
    .eq('target_user_id', user.id)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })

  const [{ data: ownRows, error: ownErr }, { data: inboundRows, error: inboundErr }] = await Promise.all([ownRowsP, inboundRowsP])

  if (ownErr) {
    console.error('GET /api/connections (own) error:', ownErr)
    return NextResponse.json({ error: ownErr.message }, { status: 500 })
  }
  if (inboundErr) {
    console.error('GET /api/connections (inbound) error:', inboundErr)
    return NextResponse.json({ error: inboundErr.message }, { status: 500 })
  }

  // Collect every "other user" id we need to render so we can batch-fetch profiles
  const otherIds = new Set<string>()
  for (const r of ownRows || []) if (r.target_user_id) otherIds.add(r.target_user_id)
  for (const r of inboundRows || []) if (r.owner_id) otherIds.add(r.owner_id)

  let profilesById: Record<string, any> = {}
  if (otherIds.size) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_emoji, dream')
      .in('id', Array.from(otherIds))
    for (const p of profs || []) profilesById[(p as any).id] = p
  }

  const grouped: Record<Category, any[]> = { friends: [], mentors: [], rolemodels: [] }

  // (a) own rows: prefer the linked profile's display name/avatar when present,
  // otherwise show the free-form name/icon the user typed.
  for (const row of ownRows || []) {
    if (!isCategory(row.category)) continue
    const linkedProfile = row.target_user_id ? profilesById[row.target_user_id] : null
    grouped[row.category].push({
      id: row.id,
      name: linkedProfile?.display_name || row.name,
      role: row.role,
      status: row.status,
      icon: linkedProfile?.avatar_emoji || row.icon,
      target_user_id: row.target_user_id,
      match_dream: row.match_dream,
      friend_dream: linkedProfile?.dream || null,
      direction: 'outgoing',
    })
  }

  // (b) inbound connected rows: render the requester's profile
  for (const row of inboundRows || []) {
    if (!isCategory(row.category)) continue
    const requesterProfile = row.owner_id ? profilesById[row.owner_id] : null
    grouped[row.category].push({
      id: row.id,
      name: requesterProfile?.display_name || row.name,
      role: row.role,
      status: row.status,
      icon: requesterProfile?.avatar_emoji || row.icon,
      target_user_id: row.owner_id, // from THIS user's perspective the other person is the requester
      match_dream: row.match_dream,
      friend_dream: requesterProfile?.dream || null,
      direction: 'incoming',
    })
  }

  return NextResponse.json({ connections: grouped })
}

/**
 * POST /api/connections
 * Body: { category, name, role?, status?, icon?, target_user_id?, match_dream? }
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

  const { category, name, role, status, icon, target_user_id, match_dream } = body || {}

  if (!isCategory(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const hasRealTarget = typeof target_user_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target_user_id)

  // Default status logic:
  //   - request to a real user  -> 'pending' (they must accept)
  //   - free-form / manual entry -> 'connected' (no acceptance flow)
  //   - explicit 'matched' from the Match modal -> preserved as 'matched'
  const defaultStatus = status === 'matched' ? 'matched' : hasRealTarget ? 'pending' : 'connected'

  const insertRow = {
    owner_id: user.id,
    category,
    name: name.trim().slice(0, 200),
    role: typeof role === 'string' ? role.trim().slice(0, 200) : '',
    status: status === 'connected' || status === 'matched' || status === 'pending' ? status : defaultStatus,
    icon: typeof icon === 'string' && icon.length > 0 ? icon.slice(0, 8) : '👤',
    target_user_id: hasRealTarget ? target_user_id : null,
    match_dream: typeof match_dream === 'string' ? match_dream.slice(0, 500) : null,
  }

  // Prevent duplicate outgoing requests to the same real user
  if (hasRealTarget) {
    const { data: existing } = await supabase
      .from('social_connections')
      .select('id')
      .eq('owner_id', user.id)
      .eq('target_user_id', target_user_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'You already have a connection or pending request with this user.' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('social_connections')
    .insert(insertRow)
    .select('id, category, name, role, status, icon, target_user_id, match_dream, created_at')
    .single()

  if (error) {
    console.error('POST /api/connections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ connection: data }, { status: 201 })
}
