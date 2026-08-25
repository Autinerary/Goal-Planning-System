import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Short, unambiguous join code (no 0/O/1/I). */
function makeJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/**
 * GET /api/collab-groups — groups the caller can see: every public group plus
 * any private group they belong to. Includes live member counts and whether
 * the caller has joined.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ groups: [] })

  const admin = createAdminClient()

  const [{ data: mine }, { data: publicGroups }] = await Promise.all([
    admin.from('collab_group_members').select('group_id, role').eq('user_id', user.id),
    admin
      .from('collab_groups')
      .select('id, name, type, rules, is_public, join_code, leader_id, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
  ])

  const myGroupIds = (mine || []).map((m: any) => m.group_id)
  let privateMine: any[] = []
  if (myGroupIds.length > 0) {
    const { data } = await admin
      .from('collab_groups')
      .select('id, name, type, rules, is_public, join_code, leader_id, created_at')
      .in('id', myGroupIds)
      .eq('is_public', false)
    privateMine = data || []
  }

  const all = [...(publicGroups || []), ...privateMine]
  if (all.length === 0) return NextResponse.json({ groups: [] })

  // Member counts in one query.
  const { data: memberRows } = await admin
    .from('collab_group_members')
    .select('group_id')
    .in('group_id', all.map((g: any) => g.id))
  const counts = new Map<string, number>()
  for (const r of memberRows || []) {
    counts.set(r.group_id, (counts.get(r.group_id) || 0) + 1)
  }
  const joined = new Set(myGroupIds)

  const groups = all.map((g: any) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    rules: g.rules,
    isPublic: g.is_public,
    // Only surface the code to people actually in the group.
    code: joined.has(g.id) || g.leader_id === user.id ? g.join_code : null,
    isLeader: g.leader_id === user.id,
    members: counts.get(g.id) || 0,
    joined: joined.has(g.id),
  }))

  return NextResponse.json({ groups })
}

/** POST /api/collab-groups — create a group. The creator becomes its leader. */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to create a group.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = String(body?.name || '').trim()
  const type = String(body?.type || '').trim()
  const rules = String(body?.rules || '').trim() || null
  const isPublic = body?.isPublic !== false

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Group name must be 2-80 characters.' }, { status: 400 })
  }
  if (!type) return NextResponse.json({ error: 'Pick a collab type.' }, { status: 400 })

  const admin = createAdminClient()

  // Private groups need a code; retry on the (very unlikely) collision.
  let joinCode: string | null = null
  if (!isPublic) {
    for (let attempt = 0; attempt < 5 && !joinCode; attempt++) {
      const candidate = makeJoinCode()
      const { data: clash } = await admin
        .from('collab_groups')
        .select('id')
        .eq('join_code', candidate)
        .maybeSingle()
      if (!clash) joinCode = candidate
    }
    if (!joinCode) {
      return NextResponse.json({ error: 'Could not generate a code, try again.' }, { status: 500 })
    }
  }

  const { data: group, error } = await admin
    .from('collab_groups')
    .insert({ name, type, rules, is_public: isPublic, join_code: joinCode, leader_id: user.id })
    .select('id, name, type, rules, is_public, join_code')
    .single()

  if (error || !group) {
    console.error('[collab] create failed:', error?.message)
    return NextResponse.json({ error: 'Could not create the group.' }, { status: 500 })
  }

  // The leader is a member too, so counts and membership checks stay uniform.
  await admin
    .from('collab_group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'leader' })

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      type: group.type,
      rules: group.rules,
      isPublic: group.is_public,
      code: group.join_code,
      isLeader: true,
      members: 1,
      joined: true,
    },
  })
}
