import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, providerReviewedEmail, providerSurveyEmail, sendEmail } from '@/lib/email'
import { postalAddress } from '@/lib/newsletter'
import { surveyLink, usableEmail } from '@/lib/listings'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const APP = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://app.autinerary.ca').replace(/\/$/, '')
const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')
const MONTH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }).slice(0, 7)

type Kind = 'survey' | 'reviewed'
interface Target {
  id: string
  name: string
  email: string
  image: string | null
  ratings: number
  ref: string
}

async function isAdmin() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

/** Who a batch would go to: a usable published email, not opted out, not already sent this kind (and month, for "reviewed"). */
async function targets(kind: Kind, limit: number): Promise<Target[]> {
  const db = createAdminClient()
  let rows: { id: string; name: string; contact_info: any; image_url: string | null; image_is_generic: boolean | null; ratings?: number }[] = []
  if (kind === 'reviewed') {
    const since = new Date(Date.now() - 31 * 86_400_000).toISOString()
    const { data: rated } = await db.from('ratings').select('resource_id').gte('created_at', since).limit(5000)
    const counts = new Map<string, number>()
    for (const r of rated || []) if (r.resource_id) counts.set(r.resource_id, (counts.get(r.resource_id) || 0) + 1)
    const ids = Array.from(counts.keys()).slice(0, 1000)
    if (!ids.length) return []
    const { data } = await db.from('resources').select('id, name, contact_info, image_url, image_is_generic').eq('status', 'approved').in('id', ids)
    rows = (data || []).map((r) => ({ ...r, ratings: counts.get(r.id) || 0 }))
  } else {
    const { data } = await db.from('resources').select('id, name, contact_info, image_url, image_is_generic').eq('status', 'approved').not('contact_info->>email', 'is', null).limit(5000)
    rows = data || []
  }
  const withEmail = rows.map((r) => ({ r, email: usableEmail(r.contact_info?.email) })).filter((x) => x.email) as { r: (typeof rows)[number]; email: string }[]
  if (!withEmail.length) return []
  const month = MONTH()
  const refOf = (id: string) => (kind === 'reviewed' ? `${id}:${month}` : id)
  const [{ data: optouts }, { data: sent }] = await Promise.all([
    db.from('service_email_optouts').select('email_key').in('email_key', Array.from(new Set(withEmail.map((x) => x.email.toLowerCase())))),
    db.from('provider_emails').select('ref').eq('kind', kind).in('ref', withEmail.map((x) => refOf(x.r.id))),
  ])
  const out = new Set((optouts || []).map((o) => o.email_key))
  const done = new Set((sent || []).map((s) => s.ref))
  const seenEmail = new Set<string>()
  const list: Target[] = []
  for (const { r, email } of withEmail) {
    const key = email.toLowerCase()
    if (out.has(key) || done.has(refOf(r.id)) || seenEmail.has(key)) continue
    seenEmail.add(key)
    list.push({ id: r.id, name: r.name, email, image: r.image_url && !r.image_is_generic ? r.image_url : null, ratings: r.ratings || 0, ref: refOf(r.id) })
    if (list.length >= limit) break
  }
  return list
}

/**
 * The V1.5 emails to services (the planning note, October 2026, Goal 11),
 * for admins only, sent in batches by hand from /business/outreach:
 *
 * GET  ?kind=survey|reviewed     who the next batch would go to (nothing is sent)
 * POST { kind, confirm: 'SEND', limit }   sends that batch (at most 200)
 *
 * Each service gets each email once (provider_emails), from the address its
 * listing publishes; services that replied "stop" are skipped; every email
 * has the mailing address and how to stop (Canada's anti-spam law).
 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const kind: Kind = req.nextUrl.searchParams.get('kind') === 'reviewed' ? 'reviewed' : 'survey'
  try {
    const list = await targets(kind, 200)
    return NextResponse.json({ kind, ready: emailEnabled() && Boolean(postalAddress()), next: list.length, sample: list.slice(0, 15).map((t) => ({ name: t.name, email: t.email.replace(/^(.{2}).*@/, '$1***@'), ratings: t.ratings })) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not list them.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b?.confirm !== 'SEND') return NextResponse.json({ error: 'Type SEND to confirm.' }, { status: 400 })
  const kind: Kind = b?.kind === 'reviewed' ? 'reviewed' : 'survey'
  const postal = postalAddress()
  if (!emailEnabled() || !postal) return NextResponse.json({ error: 'Email isn’t set up (RESEND_API_KEY and NEWSLETTER_POSTAL_ADDRESS).' }, { status: 503 })
  const limit = Math.max(1, Math.min(200, Number(b?.limit) || 50))
  const db = createAdminClient()
  const app = APP()
  let sent = 0
  let failed = 0
  for (const t of await targets(kind, limit)) {
    const listing = `${HUB}/resources/${t.id}`
    const claim = `${app}/business?claim=resource:${t.id}`
    const survey = surveyLink(app, t.id)
    const email =
      kind === 'reviewed'
        ? providerReviewedEmail({ name: t.name, ratings: t.ratings, listing, survey, claim, image: t.image, postal })
        : providerSurveyEmail({ name: t.name, listing, survey, claim, image: t.image, postal })
    const r = await sendEmail({ to: t.email, ...email, idempotencyKey: `provider-${kind}-${t.ref}`.slice(0, 256), headers: { 'List-Unsubscribe': `<mailto:heydevs@autinerary.ca?subject=stop>` } })
    if (r.ok) {
      sent += 1
      await db.from('provider_emails').upsert({ resource_id: t.id, kind, ref: t.ref, sent_to: t.email }, { onConflict: 'kind,ref', ignoreDuplicates: true })
    } else failed += 1
  }
  console.log(`[provider-outreach] ${kind}: sent ${sent}, failed ${failed}`)
  return NextResponse.json({ kind, sent, failed })
}
