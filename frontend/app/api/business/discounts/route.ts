import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

async function owner(productId: string) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.rpc('owns_listing', { p_kind: 'product', p_item: productId })
  return data === true ? user : null
}

/**
 * GET  /api/business/discounts?product_id=  the coming discount events, and this product's discounts
 * POST /api/business/discounts { product_id, event_id?, opted_in, percent?, sale_price?, code?, starts_on?, ends_on? }
 *
 * The products round's planning note, Goal 10: discounts for norm months,
 * back to school and launches, with the "option to opt-in or out & customize
 * discount percent or pricing" (STEP 82). Only a product's verified manager.
 */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('product_id') || ''
  if (!UUID.test(productId)) return NextResponse.json({ error: 'Which product?' }, { status: 400 })
  if (!(await owner(productId))) return NextResponse.json({ error: 'You don’t manage this product.' }, { status: 403 })
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const [{ data: events, error }, { data: mine }] = await Promise.all([
    admin.from('discount_events').select('id, slug, name, description, kind, starts_on, ends_on, suggested_percent').gte('ends_on', today).order('starts_on').limit(20),
    admin.from('product_discounts').select('id, event_id, percent, sale_price, code, starts_on, ends_on, opted_in').eq('product_id', productId),
  ])
  if (error) return NextResponse.json({ events: [], discounts: [], open: false })
  return NextResponse.json({ events: events || [], discounts: mine || [], open: true })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const productId = String(b?.product_id || '')
  if (!UUID.test(productId)) return NextResponse.json({ error: 'Which product?' }, { status: 400 })
  const user = await owner(productId)
  if (!user) return NextResponse.json({ error: 'You don’t manage this product.' }, { status: 403 })
  const eventId = b?.event_id && UUID.test(String(b.event_id)) ? String(b.event_id) : null
  const optedIn = b?.opted_in !== false
  const percent = b?.percent === '' || b?.percent == null ? null : Math.round(Number(b.percent))
  const salePrice = b?.sale_price === '' || b?.sale_price == null ? null : Number(b.sale_price)
  const code = typeof b?.code === 'string' && b.code.trim() ? b.code.trim().slice(0, 30) : null
  if (percent !== null && !(percent >= 1 && percent <= 90)) return NextResponse.json({ error: 'A discount is 1% to 90%.' }, { status: 400 })
  if (salePrice !== null && !(salePrice >= 0)) return NextResponse.json({ error: 'The sale price doesn’t look right.' }, { status: 400 })
  if (code && !/^[A-Za-z0-9_-]{3,30}$/.test(code)) return NextResponse.json({ error: 'A code is 3 to 30 letters, numbers, - or _.' }, { status: 400 })
  if (optedIn && percent === null && salePrice === null) return NextResponse.json({ error: 'Give a percent off or a sale price.' }, { status: 400 })
  const starts = DATE.test(String(b?.starts_on || '')) ? b.starts_on : null
  const ends = DATE.test(String(b?.ends_on || '')) ? b.ends_on : null
  if (!eventId && (!starts || !ends || ends < starts)) return NextResponse.json({ error: 'Give the discount’s dates.' }, { status: 400 })
  const admin = createAdminClient()
  const row = { product_id: productId, event_id: eventId, vendor_user_id: user.id, percent, sale_price: salePrice, code, starts_on: eventId ? null : starts, ends_on: eventId ? null : ends, opted_in: optedIn, updated_at: new Date().toISOString() }
  const existing = eventId ? (await admin.from('product_discounts').select('id').eq('product_id', productId).eq('event_id', eventId).maybeSingle()).data : null
  const { error } = existing ? await admin.from('product_discounts').update(row).eq('id', existing.id) : await admin.from('product_discounts').insert(row)
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
