import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanCrisisLines } from '@/lib/groups'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * The groups someone belongs to (STEP 17's organisations, with STEP 102; lib/groups.ts), read and changed on the
 * server, which applies the rules: joining never makes anyone a leader (the team appoints them), and a group's join
 * code is given only to its leaders.
 *
 * GET                    { groups: [{ id, name, role, lines, joinCode (leaders only) }] }, [] when signed out
 * POST   { code }        join a group with its code
 * DELETE ?id=<group>     leave it
 */
async function me() {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  return user
}

export async function GET() {
  const user = await me()
  if (!user) return NextResponse.json({ groups: [] })
  const admin = createAdminClient()
  const { data: rows } = await admin.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(50)
  if (!rows?.length) return NextResponse.json({ groups: [] })
  const ids = rows.map((r: any) => r.org_id)
  let orgs: any[] | null = null
  const withLines = await admin.from('organizations').select('id, name, join_code, crisis_lines').in('id', ids)
  if (withLines.error && step64Missing(withLines.error)) {
    // Before STEP 102 there are no crisis lines.
    orgs = (await admin.from('organizations').select('id, name, join_code').in('id', ids)).data
  } else {
    orgs = withLines.data
  }
  const role = new Map(rows.map((r: any) => [r.org_id, r.role === 'leader' ? 'leader' : 'member']))
  return NextResponse.json({
    groups: (orgs || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      role: role.get(o.id),
      lines: cleanCrisisLines(o.crisis_lines),
      ...(role.get(o.id) === 'leader' && o.join_code ? { joinCode: o.join_code } : {}),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  })
}

export async function POST(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const code = String(body?.code || '').trim().toUpperCase().slice(0, 40)
  if (!code) return NextResponse.json({ error: 'Type the group’s code.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id, name').eq('join_code', code).maybeSingle()
  if (!org) return NextResponse.json({ error: 'That code isn’t right. Check it with whoever gave it to you.' }, { status: 404 })
  // Joining again changes nothing: a leader who uses the code stays a leader.
  const { error } = await admin.from('organization_members')
    .upsert({ org_id: org.id, user_id: user.id, role: 'member' }, { onConflict: 'org_id,user_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'Couldn’t join just now. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true, group: { id: org.id, name: org.name } })
}

export async function DELETE(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Which group?' }, { status: 400 })
  const { error } = await createAdminClient().from('organization_members').delete().eq('org_id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Couldn’t leave just now. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
