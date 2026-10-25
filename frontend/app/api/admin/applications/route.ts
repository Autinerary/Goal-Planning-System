import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { APPLY_ON, isEmail } from '@/lib/applications'
import { missingTable, sendApplication } from '@/lib/applicationSend'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * One-click Apply's waiting list (lib/applications.ts, STEP 89): services
 * people applied to whose listing has no email address. The team only
 * (is_admin). Nobody's details are shown here, only how many are waiting.
 *   GET                                        services with applications waiting
 *   POST { resourceId, email }                 save the listing's address, then
 *                                              send everything waiting for it
 *   POST { resourceId, unreachable: true }     no address to be found: the
 *                                              people who applied are told so
 */

async function teamOnly() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return isAdmin === true ? null : NextResponse.json({ error: 'Team only.' }, { status: 403 })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET() {
  if (!APPLY_ON) return NextResponse.json({ error: 'Apply isn’t switched on.' }, { status: 404 })
  const denied = await teamOnly()
  if (denied) return denied
  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('service_applications')
    .select('resource_id, created_at')
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(2000)
  if (missingTable(error)) return NextResponse.json({ error: 'STEP 89 isn’t applied yet.' }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const waiting = new Map<string, { count: number; oldest: string }>()
  for (const r of rows || []) {
    const w = waiting.get(r.resource_id)
    if (w) w.count += 1
    else waiting.set(r.resource_id, { count: 1, oldest: r.created_at })
  }
  const ids = [...waiting.keys()]
  const { data: resources } = ids.length
    ? await admin.from('resources').select('id, name, category, contact_info, source_url').in('id', ids)
    : { data: [] as any[] }
  const services = (resources || [])
    .map((r: any) => ({
      resourceId: r.id,
      name: r.name,
      category: r.category,
      website: r.contact_info?.website || r.source_url || null,
      phone: r.contact_info?.phone || null,
      waiting: waiting.get(r.id)?.count || 0,
      oldest: waiting.get(r.id)?.oldest || null,
    }))
    .sort((a, b) => String(a.oldest).localeCompare(String(b.oldest)))
  return NextResponse.json({ services })
}

export async function POST(req: NextRequest) {
  if (!APPLY_ON) return NextResponse.json({ error: 'Apply isn’t switched on.' }, { status: 404 })
  const denied = await teamOnly()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const resourceId = String(body?.resourceId || '')
  if (!UUID.test(resourceId)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })
  const admin = createAdminClient()

  if (body?.unreachable === true) {
    const { data, error } = await admin
      .from('service_applications')
      .update({ status: 'unreachable', updated_at: new Date().toISOString() })
      .eq('resource_id', resourceId)
      .eq('status', 'waiting')
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, unreachable: data?.length || 0 })
  }

  const email = String(body?.email || '').trim()
  if (!isEmail(email)) return NextResponse.json({ error: 'That isn’t an email address.' }, { status: 400 })
  const { data: resource } = await admin.from('resources').select('id, name, contact_info').eq('id', resourceId).maybeSingle()
  if (!resource) return NextResponse.json({ error: 'No such service.' }, { status: 404 })
  // The listing keeps the address, so everyone who applies later is sent at once.
  const contact_info = { ...((resource.contact_info as Record<string, unknown>) || {}), email }
  const { error: saveError } = await admin.from('resources').update({ contact_info }).eq('id', resourceId)
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })

  const { data: rows } = await admin.from('service_applications').select('id, details, updated_at').eq('resource_id', resourceId).eq('status', 'waiting')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  let sent = 0
  let failed = 0
  for (const row of rows || []) {
    const r = await sendApplication(admin, row, { ...resource, contact_info }, appUrl)
    if (r.status === 'sent') sent += 1
    else failed += 1
  }
  return NextResponse.json({ ok: true, sent, failed })
}
