import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { newJoinCode, slugFor } from '@/lib/groups'

export const dynamic = 'force-dynamic'

/**
 * The team's groups (STEP 17's organisations, with STEP 102; is_admin only): a student group or a service that uses
 * Autinerary with the people it supports. The team makes a group (it gets a code people join with) and appoints its
 * leaders; leaders are never self-chosen.
 *
 * GET                                    every group, with how many members and leaders
 * POST  { name }                         make a group
 * PATCH { id, email, role? }             make someone with that account email a leader of the group ('leader', the
 *                                        default), or a member again ('member')
 */
async function team() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return isAdmin === true ? null : NextResponse.json({ error: 'Team only.' }, { status: 403 })
}

export async function GET() {
  const denied = await team()
  if (denied) return denied
  const admin = createAdminClient()
  const [{ data: orgs, error }, { data: members }] = await Promise.all([
    admin.from('organizations').select('id, name, slug, join_code, is_verified, created_at').order('created_at', { ascending: false }).limit(200),
    admin.from('organization_members').select('org_id, role').limit(20000),
  ])
  if (error) return NextResponse.json({ error: 'Could not load.' }, { status: 500 })
  const count = (id: string, role?: string) => (members || []).filter((m: any) => m.org_id === id && (!role || m.role === role)).length
  return NextResponse.json({
    groups: (orgs || []).map((o: any) => ({ id: o.id, name: o.name, slug: o.slug, joinCode: o.join_code, verified: o.is_verified,
      members: count(o.id), leaders: count(o.id, 'leader') })),
  })
}

export async function POST(req: NextRequest) {
  const denied = await team()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  if (name.length < 3) return NextResponse.json({ error: 'Give the group a name.' }, { status: 400 })
  const admin = createAdminClient()
  const base = slugFor(name)
  const { data: taken } = await admin.from('organizations').select('slug').like('slug', `${base}%`).limit(100)
  const used = new Set((taken || []).map((t: any) => t.slug))
  let slug = base
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`
  const { data, error } = await admin.from('organizations')
    .insert({ name, slug, join_code: newJoinCode((n) => randomBytes(n)), is_verified: true })
    .select('id, name, slug, join_code').single()
  if (error) return NextResponse.json({ error: 'Couldn’t make the group.' }, { status: 500 })
  return NextResponse.json({ ok: true, group: { id: data.id, name: data.name, slug: data.slug, joinCode: data.join_code } })
}

export async function PATCH(req: NextRequest) {
  const denied = await team()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || '')
  const email = String(body?.email || '').trim().toLowerCase()
  const role = body?.role === 'member' ? 'member' : 'leader'
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Pick a group and type an account’s email.' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: person } = await admin.from('profiles').select('id').ilike('email', email).limit(1).maybeSingle()
  if (!person) return NextResponse.json({ error: 'No account has that email.' }, { status: 404 })
  const { error } = await admin.from('organization_members').upsert({ org_id: id, user_id: person.id, role }, { onConflict: 'org_id,user_id' })
  if (error) return NextResponse.json({ error: 'Couldn’t change it.' }, { status: 500 })
  return NextResponse.json({ ok: true, role })
}
