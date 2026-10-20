import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * A Collab Group's own page (Hare World): who is in it, its rules and, for
 * members, its code.
 *
 * GET                               the group (members see the member list; others a public group's summary)
 * PATCH { rules?, name?, leaderId? } the leader edits the rules or name, or hands the group to another member
 * DELETE { userId }                 the leader removes a member
 *
 * Members see each other's display names and icons: joining a group shares
 * them with its members (the privacy page says so). Writes go through the
 * service role, as the other group routes do (STEP 07), after these checks.
 */

async function context(id: string) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) }
  if (!UUID_RE.test(id)) return { error: NextResponse.json({ error: 'Group not found.' }, { status: 404 }) }
  const admin = createAdminClient()
  const { data: group } = await admin.from('collab_groups').select('id, name, type, rules, is_public, join_code, leader_id, created_at').eq('id', id).maybeSingle()
  if (!group) return { error: NextResponse.json({ error: 'Group not found.' }, { status: 404 }) }
  const { data: me } = await admin.from('collab_group_members').select('role').eq('group_id', id).eq('user_id', user.id).maybeSingle()
  return { user, admin, group, member: Boolean(me), leader: group.leader_id === user.id }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = await context(params.id)
  if ('error' in c && c.error) return c.error
  const { admin, group, member, leader, user } = c as Exclude<typeof c, { error: NextResponse }>
  if (!group.is_public && !member) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  const { data: rows } = await admin.from('collab_group_members').select('user_id, role, joined_at').eq('group_id', group.id).order('joined_at', { ascending: true })
  let members: any[] = []
  if (member) {
    const ids = (rows || []).map((r: any) => r.user_id)
    const { data: profiles } = ids.length ? await admin.from('profiles').select('id, display_name, avatar_emoji, avatar_url').in('id', ids) : { data: [] as any[] }
    const byId = new Map((profiles || []).map((p: any) => [p.id, p]))
    members = (rows || []).map((r: any) => ({
      id: r.user_id,
      name: (byId.get(r.user_id) as any)?.display_name || 'A member',
      icon: (byId.get(r.user_id) as any)?.avatar_emoji || '🙂',
      avatar_url: (byId.get(r.user_id) as any)?.avatar_url || null,
      leader: r.user_id === group.leader_id,
      you: r.user_id === user.id,
      joined_at: r.joined_at,
    }))
  }
  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      type: group.type,
      rules: group.rules,
      isPublic: group.is_public,
      code: member ? group.join_code : null,
      isLeader: leader,
      joined: member,
      count: (rows || []).length,
      created_at: group.created_at,
    },
    members,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const c = await context(params.id)
  if ('error' in c && c.error) return c.error
  const { admin, group, leader } = c as Exclude<typeof c, { error: NextResponse }>
  if (!leader) return NextResponse.json({ error: 'Only the group’s leader can change it.' }, { status: 403 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (typeof body?.leaderId === 'string') {
    const next = body.leaderId
    const { data: them } = await admin.from('collab_group_members').select('user_id').eq('group_id', group.id).eq('user_id', next).maybeSingle()
    if (!them || next === group.leader_id) return NextResponse.json({ error: 'Choose another member of the group.' }, { status: 400 })
    const { error } = await admin.from('collab_groups').update({ leader_id: next }).eq('id', group.id)
    if (error) return NextResponse.json({ error: 'That didn’t save.' }, { status: 500 })
    await admin.from('collab_group_members').update({ role: 'member' }).eq('group_id', group.id).eq('user_id', group.leader_id)
    await admin.from('collab_group_members').update({ role: 'leader' }).eq('group_id', group.id).eq('user_id', next)
    return NextResponse.json({ ok: true, leaderId: next })
  }

  const update: Record<string, unknown> = {}
  if (typeof body?.rules === 'string') update.rules = body.rules.trim().slice(0, 2000) || null
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Group name must be 2-80 characters.' }, { status: 400 })
    update.name = name
  }
  if (!Object.keys(update).length) return NextResponse.json({ ok: true })
  const { error } = await admin.from('collab_groups').update(update).eq('id', group.id)
  if (error) return NextResponse.json({ error: 'That didn’t save.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const c = await context(params.id)
  if ('error' in c && c.error) return c.error
  const { admin, group, leader } = c as Exclude<typeof c, { error: NextResponse }>
  if (!leader) return NextResponse.json({ error: 'Only the group’s leader can remove members.' }, { status: 403 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const userId = typeof body?.userId === 'string' && UUID_RE.test(body.userId) ? body.userId : null
  if (!userId || userId === group.leader_id) return NextResponse.json({ error: 'Choose a member (not yourself).' }, { status: 400 })
  const { error } = await admin.from('collab_group_members').delete().eq('group_id', group.id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: 'That didn’t work.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
