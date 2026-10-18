import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isItemKind, OWNER_FIELDS, ownerValues, rowUpdate, splitChanges, type ItemKind } from '@/lib/listings'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS: Record<ItemKind, string> = {
  resource: 'id, name, description, category, location, contact_info, image_url, cost_type, delivery, status',
  product: 'id, name, description, category, price, seller, status',
}

async function ownerOf(kind: ItemKind, id: string) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, owns: false }
  const { data } = await supabase.rpc('owns_listing', { p_kind: kind, p_item: id })
  return { supabase, user, owns: data === true }
}

/**
 * GET  /api/business/listing?kind=&id=  a listing its verified owner manages:
 *      what they can change, the counts (never who), their changes so far,
 *      and their promotions
 * POST /api/business/listing { kind, id, changes }: changes apply at once,
 *      except name, picture and address, which wait for the team; every
 *      change is kept with what it was before (STEP 81's listing_edits)
 */
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind')
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!isItemKind(kind) || !UUID.test(id)) return NextResponse.json({ error: 'Which listing?' }, { status: 400 })
  const { supabase, user, owns } = await ownerOf(kind, id)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!owns) return NextResponse.json({ error: 'You don’t manage this listing yet.' }, { status: 403 })
  const admin = createAdminClient()
  const [{ data: row }, { data: insights }, { data: edits }, { data: promotions }] = await Promise.all([
    admin.from(kind === 'resource' ? 'resources' : 'products').select(COLUMNS[kind]).eq('id', id).maybeSingle(),
    supabase.rpc('listing_insights', { p_kind: kind, p_item: id }),
    supabase.from('listing_edits').select('id, changes, before, status, created_at').eq('item_kind', kind).eq('item_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('promotions').select('id, headline, body, image_url, keywords, provinces, status, starts_on, ends_on, created_at').eq('item_kind', kind).eq('item_id', id).order('created_at', { ascending: false }),
  ])
  if (!row) return NextResponse.json({ error: 'That listing wasn’t found.' }, { status: 404 })
  const r = row as unknown as Record<string, any>
  return NextResponse.json({
    kind,
    id,
    name: r.name,
    category: r.category,
    status: r.status,
    image_url: kind === 'resource' ? r.image_url : null,
    values: ownerValues(kind, r),
    fields: Object.entries(OWNER_FIELDS[kind]).map(([field, f]) => ({ field, label: f.label, when: f.when })),
    insights: insights || null,
    edits: edits || [],
    promotions: promotions || [],
  })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const kind = b?.kind
  const id = String(b?.id || '')
  if (!isItemKind(kind) || !UUID.test(id) || typeof b?.changes !== 'object' || !b.changes) return NextResponse.json({ error: 'Which listing, and what changes?' }, { status: 400 })
  const { user, owns } = await ownerOf(kind, id)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!owns) return NextResponse.json({ error: 'You don’t manage this listing yet.' }, { status: 403 })
  const admin = createAdminClient()
  const table = kind === 'resource' ? 'resources' : 'products'
  const { data: row } = await admin.from(table).select(COLUMNS[kind]).eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'That listing wasn’t found.' }, { status: 404 })
  const r = row as unknown as Record<string, any>
  const current = ownerValues(kind, r)

  // Only what actually changed.
  const asked: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(b.changes as Record<string, unknown>)) {
    if (String(value ?? '') !== String(current[field] ?? '')) asked[field] = value
  }
  const { now, review, rejected } = splitChanges(kind, asked)
  const before = (fields: string[]) => Object.fromEntries(fields.map((f) => [f, current[f] ?? null]))

  if (Object.keys(now).length) {
    const { error } = await admin.from(table).update({ ...rowUpdate(kind, r, now), updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Could not save those changes.' }, { status: 500 })
    await admin.from('listing_edits').insert({ user_id: user.id, item_kind: kind, item_id: id, changes: now, before: before(Object.keys(now)), status: 'applied' })
  }
  if (Object.keys(review).length) {
    await admin.from('listing_edits').insert({ user_id: user.id, item_kind: kind, item_id: id, changes: review, before: before(Object.keys(review)), status: 'pending' })
  }
  return NextResponse.json({ applied: Object.keys(now), waiting: Object.keys(review), rejected })
}
