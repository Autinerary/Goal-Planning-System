import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * Reported messages from Hare World, for the team (STEP 66 keeps a copy of
 * each reported message; STEP 67 adds what was done). Admins only: the caller
 * is checked with their own session, then the reports and the names of the
 * people in them are read with the server key.
 *
 * GET ?status=open|resolved|all     the reports, newest first
 * PATCH { id, resolved, resolution? }   resolve with what was done, or reopen
 */

type Report = {
  id: string
  message_id: string | null
  reporter_id: string
  reported_user_id: string | null
  content_snapshot: string | null
  reason: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution?: string | null
}

const missing = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(error.code)) || /does not exist|could not find/i.test(String(error.message))))

async function adminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(await isAdminUser(supabase, profile?.role))) return { user: null, status: 403 as const }
  return { user, status: 200 as const }
}

export async function GET(request: NextRequest) {
  const { user, status: authStatus } = await adminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const admin = createAdminClient()
  const status = request.nextUrl.searchParams.get('status') || 'open'
  const columns = 'id, message_id, reporter_id, reported_user_id, content_snapshot, reason, created_at, resolved_at, resolved_by'
  const load = (withResolution: boolean) => {
    let q = admin.from('message_reports').select(withResolution ? `${columns}, resolution` : columns).order('created_at', { ascending: false }).limit(100)
    if (status === 'open') q = q.is('resolved_at', null)
    if (status === 'resolved') q = q.not('resolved_at', 'is', null)
    return q
  }
  let canWriteResolution = true
  let { data, error } = await load(true)
  if (missing(error)) {
    canWriteResolution = false
    ;({ data, error } = await load(false))
  }
  if (error) {
    if (missing(error)) return NextResponse.json({ available: false, reports: [], counts: { open: 0, resolved: 0 } })
    return NextResponse.json({ error: 'Reports could not be loaded.' }, { status: 500 })
  }
  const reports = (data || []) as unknown as Report[]

  // Names, addresses and roles of everyone in these reports, and how often
  // each sender has been reported.
  const ids = Array.from(new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id, r.resolved_by]).filter(Boolean))) as string[]
  const [{ data: people }, { data: all }] = await Promise.all([
    ids.length ? admin.from('profiles').select('id, display_name, full_name, email, role').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    admin.from('message_reports').select('reported_user_id, resolved_at'),
  ])
  const byId = new Map(((people || []) as { id: string; display_name: string | null; full_name: string | null; email: string | null; role: string | null }[]).map((p) => [p.id, p]))
  const person = (id: string | null) => {
    if (!id) return null
    const p = byId.get(id)
    return { id, name: p?.display_name || p?.full_name || 'Deleted account', email: p?.email || null, role: p?.role || null }
  }
  const timesReported = new Map<string, number>()
  let open = 0, resolved = 0
  for (const r of (all || []) as { reported_user_id: string | null; resolved_at: string | null }[]) {
    if (r.resolved_at) resolved++; else open++
    if (r.reported_user_id) timesReported.set(r.reported_user_id, (timesReported.get(r.reported_user_id) || 0) + 1)
  }

  return NextResponse.json({
    available: true,
    canWriteResolution,
    counts: { open, resolved },
    reports: reports.map((r) => ({
      id: r.id,
      content: r.content_snapshot,
      reason: r.reason,
      created_at: r.created_at,
      unsent: !r.message_id,
      reporter: person(r.reporter_id),
      reported: person(r.reported_user_id),
      times_reported: r.reported_user_id ? timesReported.get(r.reported_user_id) || 0 : 0,
      resolved_at: r.resolved_at,
      resolved_by: person(r.resolved_by),
      resolution: r.resolution ?? null,
    })),
  })
}

export async function PATCH(request: NextRequest) {
  const { user, status: authStatus } = await adminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null
  if (!id || typeof body?.resolved !== 'boolean') return NextResponse.json({ error: 'Choose a report, and resolve or reopen it.' }, { status: 400 })
  const resolution = typeof body?.resolution === 'string' ? body.resolution.trim().slice(0, 500) : ''
  if (body.resolved && !resolution) return NextResponse.json({ error: 'Say what was done.' }, { status: 400 })

  const admin = createAdminClient()
  const change = body.resolved
    ? { resolved_at: new Date().toISOString(), resolved_by: user.id, resolution }
    : { resolved_at: null, resolved_by: null, resolution: null }
  let { data, error } = await admin.from('message_reports').update(change).eq('id', id).select('id')
  if (missing(error)) {
    // Before STEP 67 there is no resolution column.
    const { resolution: _drop, ...rest } = change
    ;({ data, error } = await admin.from('message_reports').update(rest).eq('id', id).select('id'))
  }
  if (error) return NextResponse.json({ error: 'That could not be saved.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  return NextResponse.json({ id, resolved: body.resolved })
}
