import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { publicProfilesByIds, step64Missing } from '@/lib/publicProfiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'

const VALID_CATEGORIES = ['friends', 'mentors', 'rolemodels'] as const
type Category = (typeof VALID_CATEGORIES)[number]

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (VALID_CATEGORIES as readonly string[]).includes(value)
}

/**
 * Helper to get user from Authorization header OR cookie session.
 */
async function getAuthenticatedUser(req: NextRequest) {
  const supabase = createServerSupabase()

  // 1. Try reading standard cookie session first
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  if (cookieUser) return { user: cookieUser, supabase }

  // 2. Fall back to Authorization: Bearer <token> header from fetchWithAuth
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token)
    if (!error && tokenUser) {
      return { user: tokenUser, supabase }
    }
  }

  return { user: null, supabase }
}

/**
 * GET /api/connections
 * Returns the signed-in user's social connections grouped by category.
 */
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // (a) my own rows, and (b) inbound rows where I'm the target AND we're
  // connected (accepted requests). connected_at, when a request was
  // accepted, arrived with STEP 65.
  const load = (extra: string) => Promise.all([
    supabase
      .from('social_connections')
      .select(`id, category, name, role, status, icon, target_user_id, match_dream, created_at${extra}`)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('social_connections')
      .select(`id, owner_id, category, name, role, status, icon, match_dream, created_at${extra}`)
      .eq('target_user_id', user.id)
      .eq('status', 'connected')
      .order('created_at', { ascending: true }),
  ])
  let [{ data: ownRows, error: ownErr }, { data: inboundRows, error: inboundErr }]: { data: any[] | null; error: any }[] = await load(', connected_at')
  if (step64Missing(ownErr) || step64Missing(inboundErr)) {
    ;[{ data: ownRows, error: ownErr }, { data: inboundRows, error: inboundErr }] = await load('')
  }

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

  // Public fields only (lib/publicProfiles.ts, STEP 64).
  const profilesById: Record<string, any> = await publicProfilesByIds(supabase, Array.from(otherIds))

  const grouped: Record<Category, any[]> = { friends: [], mentors: [], rolemodels: [] }

  // (a) own rows
  for (const row of ownRows || []) {
    const category: unknown = row.category
    if (!isCategory(category)) continue
    const linkedProfile = row.target_user_id ? profilesById[row.target_user_id] : null
    grouped[category].push({
      id: row.id,
      name: linkedProfile?.display_name || row.name,
      role: row.role,
      status: row.status,
      icon: linkedProfile?.avatar_emoji || row.icon,
      target_user_id: row.target_user_id,
      match_dream: row.match_dream,
      friend_dream: linkedProfile?.dream || null,
      direction: 'outgoing',
      created_at: row.created_at,
      connected_at: row.connected_at || null,
      // Public profile fields for the person card (STEP 64; null before it).
      username: linkedProfile?.username || null,
      pronouns: linkedProfile?.pronouns || null,
      bio: linkedProfile?.bio || null,
      avatar_url: linkedProfile?.avatar_url || null,
    })
  }

  // (b) inbound connected rows. The category is the requester's choice: if A
  // added B as a mentor, B used to see A under "Mentors". To B, A is someone
  // they mentor (or who looks up to them), so A shows with B's friends, saying
  // so (Riipen Labs, Group 34: friend requests were confusing).
  const INBOUND_ROLE: Record<Category, string> = { friends: '', mentors: 'Chose you as a mentor', rolemodels: 'Chose you as a role model' }
  for (const row of inboundRows || []) {
    const category: unknown = row.category
    if (!isCategory(category)) continue
    const requesterProfile = row.owner_id ? profilesById[row.owner_id] : null
    grouped.friends.push({
      id: row.id,
      name: requesterProfile?.display_name || row.name,
      role: INBOUND_ROLE[category] || row.role,
      status: row.status,
      icon: requesterProfile?.avatar_emoji || row.icon,
      target_user_id: row.owner_id,
      match_dream: row.match_dream,
      friend_dream: requesterProfile?.dream || null,
      direction: 'incoming',
      // Which of their lists you are in: 'mentors' means they chose you as
      // their mentor, so you can suggest tasks (STEP 66).
      inbound_category: category,
      created_at: row.created_at,
      connected_at: row.connected_at || null,
      username: requesterProfile?.username || null,
      pronouns: requesterProfile?.pronouns || null,
      bio: requesterProfile?.bio || null,
      avatar_url: requesterProfile?.avatar_url || null,
    })
  }

  return NextResponse.json({ connections: grouped })
}

/**
 * POST /api/connections
 */
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user) {
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

  // A request to a real person is always pending until they accept it: the
  // client could send 'connected' and skip consent, and a connection lets the
  // other person read your path, calendar and race progress (is_connected_to).
  // A card someone makes by hand has nobody to ask, so it is never "pending";
  // those cards showed "Pending request" forever.
  const rowStatus = hasRealTarget ? 'pending' : status === 'matched' ? 'matched' : 'connected'

  const insertRow = {
    owner_id: user.id,
    category,
    name: name.trim().slice(0, 200),
    role: typeof role === 'string' ? role.trim().slice(0, 200) : '',
    status: rowStatus,
    icon: typeof icon === 'string' && icon.length > 0 ? icon.slice(0, 8) : '👤',
    target_user_id: hasRealTarget ? target_user_id : null,
    match_dream: typeof match_dream === 'string' ? match_dream.slice(0, 500) : null,
  }

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
    // Either of you blocked the other (STEP 65). Someone who was blocked is
    // only told the person can't be added.
    if (error.code === 'P0001' && error.hint === 'blocked_by_you') {
      return NextResponse.json({ error: 'You blocked this person. To connect, unblock them first: Hare World, then Blocked people.' }, { status: 403 })
    }
    if (error.code === 'P0001' && error.hint === 'unavailable') {
      return NextResponse.json({ error: 'This person can’t be added.' }, { status: 403 })
    }
    console.error('POST /api/connections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Requests were only visible on Pit Stop's Hare World tab, so people never
  // knew they had one. Tell them on any device they turned notifications on
  // for (lib/push.ts); this never names the sender.
  if (hasRealTarget) {
    await pushToUser(createAdminClient(), target_user_id, {
      title: 'New connection request',
      body: 'Someone on Autinerary wants to connect with you. Open Hare World to accept or decline.',
      url: '/hare-world',
      tag: 'connection-request',
    }).catch(() => 0)
  }

  return NextResponse.json({ connection: data }, { status: 201 })
}