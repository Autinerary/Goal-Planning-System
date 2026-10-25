import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdult } from '@/lib/age'
import {
  APPLY_ON, DAILY_LIMIT, applyRefusal, defaultDetails, detailsFromRow, howToApply,
  type ApplicationStatus, type ApplyHow,
} from '@/lib/applications'
import { missingTable, sendApplication, snapshotOf, tellTeamWaiting } from '@/lib/applicationSend'
import { MAX_TOOLS } from '@/lib/milestoneTools'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * One-click Apply (lib/applications.ts, STEP 89). Off unless
 * NEXT_PUBLIC_ONE_CLICK_APPLY=on.
 *
 *   GET    ?ids=<uuid>,…        whether each listing can be applied to, and
 *                               where the person's application is; their saved
 *                               details (or a first guess to check)
 *   POST   { resourceIds, source }
 *                               apply to up to 5 at once (a page's "Apply
 *                               all"): emailed now, or held for an address
 *   DELETE ?resourceId=<uuid>   take back one that is still waiting (a sent
 *                               email can't be taken back)
 *
 * The person's own rows are read with their session; writes go through the
 * service role after these checks: signed in, an adult's own account with an
 * email address, details checked once, an approved listing that takes
 * applications, once per service, and at most DAILY_LIMIT a day.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SOURCES = new Set(['task', 'milestone', 'apply_page'])

const appUrlOf = (req: NextRequest) => process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

async function signedIn(): Promise<{ user: User | null; supabase: ReturnType<typeof createServerSupabase> }> {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { user, supabase }
}

/** Why this account can't apply, or null. */
async function refusalFor(admin: ReturnType<typeof createAdminClient>, user: User): Promise<string | null> {
  const { data: profile } = await admin.from('profiles').select('date_of_birth, managed_by_guardian').eq('id', user.id).maybeSingle()
  const managed = Boolean(user.app_metadata?.managed_by_guardian || user.user_metadata?.managed_by_guardian || profile?.managed_by_guardian)
  // Self sign-up is 18+; an account with no date of birth on file passed that gate.
  const dob = profile?.date_of_birth as string | null | undefined
  return applyRefusal({ adult: dob ? isAdult(dob) : true, managed, hasEmail: Boolean(user.email) })
}

const ids = (raw: unknown): string[] =>
  [...new Set((Array.isArray(raw) ? raw : String(raw || '').split(',')).map((s) => String(s).trim()).filter((s) => UUID.test(s)))]

export async function GET(req: NextRequest) {
  if (!APPLY_ON) return NextResponse.json({ on: false })
  const { user, supabase } = await signedIn()
  if (!user) return NextResponse.json({ on: true, signedIn: false }, { status: 401 })
  const admin = createAdminClient()

  const { error: tableError } = await admin.from('service_applications').select('id').limit(1)
  if (missingTable(tableError)) return NextResponse.json({ on: true, ready: false })

  const wanted = ids(req.nextUrl.searchParams.get('ids')).slice(0, 40)
  const [{ data: detailsRow }, { data: profile }, refusal, { data: resources }, { data: apps }] = await Promise.all([
    supabase.from('application_details').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('profiles').select('full_name, display_name, preferences').eq('id', user.id).maybeSingle(),
    refusalFor(admin, user),
    wanted.length ? admin.from('resources').select('id, name, category, status, contact_info').in('id', wanted) : Promise.resolve({ data: [] as any[] }),
    wanted.length
      ? supabase.from('service_applications').select('resource_id, status, sent_at, created_at').eq('user_id', user.id).in('resource_id', wanted)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Never the listing's email address: only how Apply reaches it. The phone
  // only once the team found no email, so the person can call instead.
  const states: Record<string, { how: ApplyHow; status: ApplicationStatus | null; at: string | null; name: string; phone: string | null }> = {}
  const phones: Record<string, string | null> = {}
  for (const r of resources || []) {
    states[r.id] = { how: howToApply(r), status: null, at: null, name: r.name, phone: null }
    phones[r.id] = typeof (r.contact_info as any)?.phone === 'string' ? (r.contact_info as any).phone : null
  }
  for (const a of apps || []) {
    const s = states[a.resource_id]
    if (s) states[a.resource_id] = { ...s, status: a.status, at: a.sent_at || a.created_at, phone: a.status === 'unreachable' ? phones[a.resource_id] : null }
  }

  return NextResponse.json({
    on: true,
    ready: true,
    refusal,
    email: user.email || null,
    details: detailsFromRow(detailsRow),
    defaults: defaultDetails({ fullName: profile?.full_name, displayName: profile?.display_name, audience: (profile?.preferences as any)?.audience }),
    states,
  })
}

type Outcome = 'sent' | 'waiting' | 'done' | 'none' | 'failed' | 'limit' | 'missing'

export async function POST(req: NextRequest) {
  if (!APPLY_ON) return NextResponse.json({ error: 'Apply isn’t switched on.' }, { status: 404 })
  const { user, supabase } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const wanted = ids(body?.resourceIds)
  if (!wanted.length) return NextResponse.json({ error: 'Nothing to apply to.' }, { status: 400 })
  if (wanted.length > MAX_TOOLS) return NextResponse.json({ error: `At most ${MAX_TOOLS} at once.` }, { status: 400 })
  const source = SOURCES.has(body?.source) ? body.source : null

  const admin = createAdminClient()
  const { error: tableError } = await admin.from('service_applications').select('id').limit(1)
  if (missingTable(tableError)) return NextResponse.json({ error: 'Apply isn’t ready yet.' }, { status: 503 })
  const refusal = await refusalFor(admin, user)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
  const { data: detailsRow } = await supabase.from('application_details').select('*').eq('user_id', user.id).maybeSingle()
  const details = detailsFromRow(detailsRow)
  if (!details) return NextResponse.json({ error: 'Check what we send first.', needDetails: true }, { status: 409 })

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count: today } = await admin
    .from('service_applications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['sent', 'waiting'])
    .gte('updated_at', since)
  let left = Math.max(0, DAILY_LIMIT - (today || 0))

  const { data: resources } = await admin.from('resources').select('id, name, category, status, contact_info').in('id', wanted)
  const byId = new Map((resources || []).map((r) => [r.id, r]))
  const appUrl = appUrlOf(req)
  const results: { resourceId: string; outcome: Outcome; status: ApplicationStatus | null; at: string | null; error?: string }[] = []

  for (const id of wanted) {
    const resource = byId.get(id)
    if (!resource) { results.push({ resourceId: id, outcome: 'missing', status: null, at: null }); continue }
    const how = howToApply(resource)
    if (how === 'none') { results.push({ resourceId: id, outcome: 'none', status: null, at: null }); continue }
    if (left <= 0) { results.push({ resourceId: id, outcome: 'limit', status: null, at: null }); continue }

    // Claim the row: a new one, or one cancelled or failed before. Anything
    // else (sent, waiting, unreachable) is already done, so a second press,
    // or a second tab, never sends twice.
    const now = new Date().toISOString()
    const fields = { status: 'waiting', details: snapshotOf(details, user.email!, resource.name), source, error: null, updated_at: now }
    let row: { id: string; details: unknown; updated_at: string } | null = null
    const inserted = await admin.from('service_applications').insert({ user_id: user.id, resource_id: id, ...fields }).select('id, details, updated_at').maybeSingle()
    if (inserted.data) row = inserted.data
    else if (inserted.error?.code === '23505') {
      const again = await admin
        .from('service_applications')
        .update(fields)
        .eq('user_id', user.id)
        .eq('resource_id', id)
        .in('status', ['cancelled', 'failed'])
        .select('id, details, updated_at')
        .maybeSingle()
      row = again.data
      if (!row) {
        const { data: existing } = await supabase.from('service_applications').select('status, sent_at, created_at').eq('user_id', user.id).eq('resource_id', id).maybeSingle()
        results.push({ resourceId: id, outcome: 'done', status: existing?.status ?? null, at: existing?.sent_at || existing?.created_at || null })
        continue
      }
    } else {
      console.error('apply: could not save the application:', inserted.error?.message)
      results.push({ resourceId: id, outcome: 'failed', status: null, at: null, error: 'That didn’t save. Try again.' })
      continue
    }
    left -= 1

    if (how === 'wait') {
      await tellTeamWaiting(admin, resource, appUrl).catch((e) => console.error('apply: team note failed:', e?.message))
      results.push({ resourceId: id, outcome: 'waiting', status: 'waiting', at: now })
      continue
    }
    const sent = await sendApplication(admin, row, resource, appUrl)
    results.push({ resourceId: id, outcome: sent.status === 'sent' ? 'sent' : sent.status === 'waiting' ? 'waiting' : 'failed', status: sent.status, at: sent.at || now, ...(sent.error ? { error: sent.error } : {}) })
  }

  return NextResponse.json({ results, left })
}

export async function DELETE(req: NextRequest) {
  if (!APPLY_ON) return NextResponse.json({ error: 'Apply isn’t switched on.' }, { status: 404 })
  const { user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('resourceId') || ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'Which one?' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_applications')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('resource_id', id)
    .eq('status', 'waiting')
    .select('id')
    .maybeSingle()
  if (missingTable(error)) return NextResponse.json({ error: 'Apply isn’t ready yet.' }, { status: 503 })
  if (!data) return NextResponse.json({ error: 'Only an application that is still waiting can be taken back.' }, { status: 409 })
  return NextResponse.json({ ok: true, status: 'cancelled' })
}

