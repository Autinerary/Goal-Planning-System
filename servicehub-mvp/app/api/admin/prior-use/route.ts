import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth/admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function admin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (await isAdminUser(supabase, profile?.role)) ? user : null
}

/**
 * "I used it before joining" claims (Goal 5; STEP 79), for an admin to match
 * with the proof emailed to heydevs@autinerary.ca (by code and address) and
 * approve or reject. The caller is checked with their own session; the change
 * is made with the server key.
 *
 * GET  /api/admin/prior-use?status=pending|all
 * POST /api/admin/prior-use { id, action: 'approve' | 'reject' }
 */
export async function GET(request: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  let q = db.from('prior_use_claims').select('id, user_id, resource_id, code, status, note, created_at, reviewed_at').order('created_at', { ascending: false }).limit(100)
  if (request.nextUrl.searchParams.get('status') !== 'all') q = q.eq('status', 'pending')
  const { data, error } = await q
  if (error) return NextResponse.json({ claims: [], note: 'Apply STEP 79 to see the claims.' })
  const rows = data || []
  const { data: places } = await db.from('resources').select('id, name').in('id', Array.from(new Set(rows.map((r) => r.resource_id))))
  const names = new Map((places || []).map((p) => [p.id, p.name]))
  const emails = new Map<string, string>()
  for (const id of Array.from(new Set(rows.map((r) => r.user_id)))) {
    const { data: u } = await db.auth.admin.getUserById(id)
    if (u?.user?.email) emails.set(id, u.user.email)
  }
  return NextResponse.json({
    claims: rows.map((r) => ({ ...r, service: names.get(r.resource_id) || 'A service', email: emails.get(r.user_id) || '' })),
  })
}

export async function POST(request: NextRequest) {
  const me = await admin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const id = String(body?.id || '')
  const action = body?.action
  if (!UUID.test(id) || (action !== 'approve' && action !== 'reject')) return NextResponse.json({ error: 'Approve or reject which claim?' }, { status: 400 })
  const { data, error } = await createAdminClient()
    .from('prior_use_claims')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: me.id })
    .eq('id', id)
    .select('id, status')
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  console.log(`[prior-use] ${me.id} ${action} ${id}`)
  return NextResponse.json(data)
}
