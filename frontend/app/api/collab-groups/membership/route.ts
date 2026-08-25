import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/collab-groups/membership — join a group.
 *   { groupId }  joins a PUBLIC group
 *   { joinCode } joins a private group by its code
 *
 * DELETE — leave a group ({ groupId }). The leader can't leave while others
 * remain, otherwise the group would be left with nobody setting the rules.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to join a group.' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const groupId = String(body?.groupId || '').trim()
  const joinCode = String(body?.joinCode || '').trim().toUpperCase()
  if (!groupId && !joinCode) {
    return NextResponse.json({ error: 'Provide a group or a join code.' }, { status: 400 })
  }

  const admin = createAdminClient()

  let group: any = null
  if (joinCode) {
    const { data } = await admin
      .from('collab_groups')
      .select('id, name, is_public')
      .eq('join_code', joinCode)
      .maybeSingle()
    group = data
    if (!group) return NextResponse.json({ error: 'That code is not valid.' }, { status: 404 })
  } else {
    const { data } = await admin
      .from('collab_groups')
      .select('id, name, is_public')
      .eq('id', groupId)
      .maybeSingle()
    group = data
    if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
    // Without a code, only public groups can be joined.
    if (!group.is_public) {
      return NextResponse.json({ error: 'This group is private — you need its code.' }, { status: 403 })
    }
  }

  const { error } = await admin
    .from('collab_group_members')
    .upsert({ group_id: group.id, user_id: user.id, role: 'member' }, { onConflict: 'group_id,user_id' })
  if (error) {
    console.error('[collab] join failed:', error.message)
    return NextResponse.json({ error: 'Could not join.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, groupId: group.id, name: group.name })
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const groupId = String(body?.groupId || '').trim()
  if (!groupId) return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('collab_groups')
    .select('id, leader_id')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  if (group.leader_id === user.id) {
    const { data: others } = await admin
      .from('collab_group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .neq('user_id', user.id)
      .limit(1)
    if (others && others.length > 0) {
      return NextResponse.json(
        { error: "You're the leader — transfer or remove the other members before leaving." },
        { status: 409 }
      )
    }
    // Last one out: remove the group entirely rather than orphan it.
    await admin.from('collab_groups').delete().eq('id', groupId)
    return NextResponse.json({ ok: true, deleted: true })
  }

  const { error } = await admin
    .from('collab_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not leave.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
