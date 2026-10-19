import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isItemKind } from '@/lib/listings'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROVINCES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])
const DATE = /^\d{4}-\d{2}-\d{2}$/

function fields(b: any) {
  const headline = typeof b?.headline === 'string' ? b.headline.trim().slice(0, 90) : ''
  const body = typeof b?.body === 'string' ? b.body.trim().slice(0, 200) || null : null
  let image: string | null = null
  if (typeof b?.image_url === 'string' && b.image_url.trim()) {
    try {
      const u = new URL(b.image_url.trim())
      if (u.protocol === 'https:') image = u.toString().slice(0, 500)
    } catch {}
  }
  const keywords = (Array.isArray(b?.keywords) ? b.keywords : String(b?.keywords || '').split(','))
    .map((k: unknown) => String(k).trim().toLowerCase().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10)
  const provinces = (Array.isArray(b?.provinces) ? b.provinces : []).map((p: unknown) => String(p).toUpperCase()).filter((p: string) => PROVINCES.has(p))
  const starts = DATE.test(String(b?.starts_on || '')) ? b.starts_on : null
  const ends = DATE.test(String(b?.ends_on || '')) ? b.ends_on : null
  return { headline, body, image_url: image, keywords, provinces, starts_on: starts, ends_on: ends }
}

const PLACES = ['search', 'tidbits', 'paths']

/**
 * Where it may show and what a click is worth (STEP 83): beside searches,
 * under Tidbits on its topic, among a step's services in Paths; 5 cents to
 * $20 a click. Undefined when not sent, so an edit keeps what was there.
 */
function money(b: any) {
  const out: { placements?: string[]; bid_cents?: number | null } = {}
  if (Array.isArray(b?.placements)) {
    const places = PLACES.filter((x) => b.placements.includes(x))
    out.placements = places.length ? places : ['search']
  }
  if (b?.bid_cents !== undefined) {
    const bid = Math.round(Number(b.bid_cents))
    out.bid_cents = b.bid_cents === null || b.bid_cents === '' ? null : Number.isFinite(bid) ? Math.min(2000, Math.max(5, bid)) : null
  }
  return out
}

// Before STEP 83 the promotions table has no places or bids: save without them.
const noStep83 = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST204' || e.code === '42703' || /placements|bid_cents/.test(e.message || ''))

/**
 * POST  /api/business/promotions { kind, id, headline, body, image_url, keywords, provinces, starts_on, ends_on, placements, bid_cents, submit }
 *       a draft, or sent to the team (status submitted)
 * PATCH /api/business/promotions { id, status: 'draft' | 'submitted' | 'paused' | 'ended', ...fields, placements?, bid_cents? }
 *
 * A budget is paid for separately (promotions/checkout, Stripe); the money
 * and the counts are the server's (STEP 83's promotions_guard).
 *
 * The team approves promotions, and none shows until sponsored listings are
 * turned on (NEXT_PUBLIC_SPONSORED in ResourceHub), labelled "Sponsored" and
 * matched only to what was searched (STEP 81's promotions; the privacy page
 * says we don't show ads, and is changed first).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!isItemKind(b?.kind) || !UUID.test(String(b?.id || ''))) return NextResponse.json({ error: 'Which listing?' }, { status: 400 })
  const f = fields(b)
  if (!f.headline) return NextResponse.json({ error: 'Write a headline.' }, { status: 400 })
  if (f.starts_on && f.ends_on && f.ends_on < f.starts_on) return NextResponse.json({ error: 'The end date is before the start.' }, { status: 400 })
  const { data: item } = await createAdminClient()
    .from(b.kind === 'resource' ? 'resources' : 'products')
    .select('category')
    .eq('id', b.id)
    .maybeSingle()
  const row = { user_id: user.id, item_kind: b.kind, item_id: b.id, ...f, categories: item?.category ? [String(item.category)] : [], status: b?.submit ? 'submitted' : 'draft' }
  let { data, error } = await supabase.from('promotions').insert({ ...row, ...money(b) }).select('id, status').single()
  if (noStep83(error)) ({ data, error } = await supabase.from('promotions').insert(row).select('id, status').single())
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'You don’t manage this listing yet.' : 'Could not save that.' }, { status: error.code === '42501' ? 403 : 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!UUID.test(String(b?.id || ''))) return NextResponse.json({ error: 'Which promotion?' }, { status: 400 })
  const status = ['draft', 'submitted', 'paused', 'ended'].includes(b?.status) ? b.status : null
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) update.status = status
  if (b?.headline !== undefined) {
    const f = fields(b)
    if (!f.headline) return NextResponse.json({ error: 'Write a headline.' }, { status: 400 })
    Object.assign(update, f)
    // New words are checked again before they show.
    if (update.status !== 'draft') update.status = 'submitted'
  }
  const extra = money(b)
  const save = (u: Record<string, unknown>) => supabase.from('promotions').update(u).eq('id', b.id).eq('user_id', user.id).select('id, status').maybeSingle()
  let { data, error } = await save({ ...update, ...extra })
  if (Object.keys(extra).length && noStep83(error)) ({ data, error } = await save(update))
  if (error || !data) return NextResponse.json({ error: 'Could not change that promotion.' }, { status: error ? 500 : 404 })
  return NextResponse.json(data)
}
