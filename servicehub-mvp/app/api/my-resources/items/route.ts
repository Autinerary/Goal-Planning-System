import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCommunityServiceClient } from '@/lib/community/client'
import { loadGroups } from '@/lib/community/tidbitsServer'
import { groupOfCategory, shopCategory, shopGroup } from '@/lib/shop/categories'
import { lengthOf } from '@/lib/community/tidbits'

export const dynamic = 'force-dynamic'

/**
 * Shop items and Tidbits kept in My Resources (the team's notes, October
 * 2026: "Categories in My Resources should be 2 layered; Layer 1 as Service,
 * Post or Store Item, Layer 2 as layers in each"). Services stay in
 * saved_resources (/api/my-resources/saved); these are saved_items (STEP 86).
 *
 *   GET    ?kind=product|post&status=wishlist|current|past   the list, with its Layer 2 categories
 *   GET    ?kind=...&id=...                                   whether one is kept, and where
 *   GET    ?counts=1                                          how many of each kind, by status
 *   POST   { kind, id, status? }                              keep one (on the wishlist unless said)
 *   PATCH  { kind, id, status?, notes? }                      move it, or note it
 *   DELETE ?kind=...&id=...                                   stop keeping it
 *
 * Before STEP 86 there is no table: every answer says ready: false and the
 * Save buttons stay hidden.
 */

const KINDS = ['product', 'post'] as const
const STATUSES = ['wishlist', 'current', 'past'] as const
type Kind = (typeof KINDS)[number]
type Status = (typeof STATUSES)[number]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isKind = (v: unknown): v is Kind => KINDS.includes(v as Kind)
const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status)
const missingTable = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /saved_items/.test(e.message || '')))

async function viewer() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const p = request.nextUrl.searchParams

  if (p.get('counts') === '1') {
    const { data, error } = await supabase.from('saved_items').select('item_kind, status').eq('user_id', user.id)
    if (missingTable(error)) return NextResponse.json({ ready: false, counts: {} })
    if (error) return NextResponse.json({ error: 'Couldn’t load them' }, { status: 500 })
    const counts: Record<string, Record<string, number>> = { product: {}, post: {} }
    for (const r of data || []) counts[r.item_kind][r.status] = (counts[r.item_kind][r.status] || 0) + 1
    return NextResponse.json({ ready: true, counts })
  }

  const kind = p.get('kind')
  if (!isKind(kind)) return NextResponse.json({ error: 'kind is product or post' }, { status: 400 })

  // One item: is it kept?
  const one = p.get('id')
  if (one) {
    if (!UUID.test(one)) return NextResponse.json({ error: 'Not an item' }, { status: 400 })
    const { data, error } = await supabase.from('saved_items').select('status, notes').eq('user_id', user.id).eq('item_kind', kind).eq('item_id', one).maybeSingle()
    if (missingTable(error)) return NextResponse.json({ ready: false })
    if (error) return NextResponse.json({ error: 'Couldn’t check' }, { status: 500 })
    return NextResponse.json({ ready: true, status: data?.status ?? null, notes: data?.notes ?? null })
  }

  const status = p.get('status') || 'wishlist'
  if (!isStatus(status)) return NextResponse.json({ error: 'status is wishlist, current or past' }, { status: 400 })
  const { data: rows, error } = await supabase
    .from('saved_items')
    .select('item_id, status, notes, created_at')
    .eq('user_id', user.id)
    .eq('item_kind', kind)
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (missingTable(error)) return NextResponse.json({ ready: false, items: [], categories: [] })
  if (error) return NextResponse.json({ error: 'Couldn’t load them' }, { status: 500 })
  const ids = (rows || []).map((r) => r.item_id)
  if (ids.length === 0) return NextResponse.json({ ready: true, items: [], categories: [] })

  // What each one is, with its Layer 2 category: a shop item's group, a
  // Tidbit's community group.
  const items: { id: string; name: string; href: string; category: string; categoryLabel: string; image: string | null; detail: string | null; notes: string | null; savedAt: string; gone: boolean }[] = []
  const meta = new Map((rows || []).map((r) => [r.item_id, r]))
  if (kind === 'product') {
    const { data } = await supabase.from('products').select('id, name, category, image_urls, brand, status').in('id', ids)
    const found = new Map((data || []).map((x: any) => [x.id, x]))
    for (const id of ids) {
      const x: any = found.get(id)
      const m = meta.get(id)!
      const group = x ? shopGroup(groupOfCategory(x.category)) : null
      items.push({
        id,
        name: x?.name || 'A shop item that’s no longer listed',
        href: `/shop/${id}`,
        category: x ? groupOfCategory(x.category) : 'gone',
        categoryLabel: group?.label || (x ? shopCategory(x.category).label : 'No longer listed'),
        image: x?.image_urls?.[0] || null,
        detail: x?.brand || null,
        notes: m.notes,
        savedAt: m.created_at,
        gone: !x || x.status !== 'active',
      })
    }
  } else {
    const client = getCommunityServiceClient()
    const { data } = client
      ? await client.from('community_posts').select('id, title, group_id, status, is_deleted, byline, length_type').in('id', ids)
      : { data: [] as any[] }
    const groups = client ? await loadGroups(client) : { byId: new Map() }
    const found = new Map((data || []).map((x: any) => [x.id, x]))
    for (const id of ids) {
      const x: any = found.get(id)
      const m = meta.get(id)!
      const shown = x && !x.is_deleted && x.status === 'published'
      const g = shown && x.group_id ? (groups.byId as Map<string, { slug: string; name: string }>).get(x.group_id) : null
      items.push({
        id,
        name: shown ? x.title : 'A Tidbit that’s no longer published',
        href: `/community/post/${id}`,
        category: g?.slug || (shown ? 'tidbits' : 'gone'),
        categoryLabel: g?.name || (shown ? 'Tidbits' : 'No longer published'),
        image: null,
        detail: shown ? (x.byline === 'autinerary' ? `${lengthOf(x.length_type).label} by Autinerary` : lengthOf(x.length_type).label) : null,
        notes: m.notes,
        savedAt: m.created_at,
        gone: !shown,
      })
    }
  }
  const categories = Array.from(new Map(items.map((i) => [i.category, i.categoryLabel])).entries()).map(([id, label]) => ({ id, label }))
  return NextResponse.json({ ready: true, items, categories })
}

async function readBody(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'Sign in to keep it in My Resources' }, { status: 401 })
  const b = await readBody(request)
  if (!b || !isKind(b.kind) || typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not an item' }, { status: 400 })
  const status: Status = isStatus(b.status) ? b.status : 'wishlist'
  // Only something that exists and is shown can be kept.
  if (b.kind === 'product') {
    const { data } = await supabase.from('products').select('id').eq('id', b.id).eq('status', 'active').maybeSingle()
    if (!data) return NextResponse.json({ error: 'That shop item isn’t listed' }, { status: 404 })
  } else {
    const client = getCommunityServiceClient()
    const { data } = client ? await client.from('community_posts').select('id').eq('id', b.id).eq('status', 'published').eq('is_deleted', false).maybeSingle() : { data: null }
    if (!data) return NextResponse.json({ error: 'That Tidbit isn’t published' }, { status: 404 })
  }
  const { error } = await supabase
    .from('saved_items')
    .upsert({ user_id: user.id, item_kind: b.kind, item_id: b.id, status, updated_at: new Date().toISOString() }, { onConflict: 'user_id,item_kind,item_id' })
  if (missingTable(error)) return NextResponse.json({ ready: false, error: 'Saving these opens soon' }, { status: 503 })
  if (error) return NextResponse.json({ error: 'Couldn’t keep it. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true, status })
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await readBody(request)
  if (!b || !isKind(b.kind) || typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not an item' }, { status: 400 })
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.status !== undefined) {
    if (!isStatus(b.status)) return NextResponse.json({ error: 'status is wishlist, current or past' }, { status: 400 })
    update.status = b.status
  }
  if (b.notes !== undefined) update.notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim().slice(0, 2000) : null
  const { data, error } = await supabase.from('saved_items').update(update).eq('user_id', user.id).eq('item_kind', b.kind).eq('item_id', b.id).select('status')
  if (missingTable(error)) return NextResponse.json({ ready: false }, { status: 503 })
  if (error) return NextResponse.json({ error: 'Couldn’t save that' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'It isn’t in My Resources' }, { status: 404 })
  return NextResponse.json({ ok: true, status: data[0].status })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const p = request.nextUrl.searchParams
  const kind = p.get('kind')
  const id = p.get('id') || ''
  if (!isKind(kind) || !UUID.test(id)) return NextResponse.json({ error: 'Not an item' }, { status: 400 })
  // Only the person's own bookmark goes; the item itself is untouched.
  const { error } = await supabase.from('saved_items').delete().eq('user_id', user.id).eq('item_kind', kind).eq('item_id', id)
  if (missingTable(error)) return NextResponse.json({ ready: false }, { status: 503 })
  if (error) return NextResponse.json({ error: 'Couldn’t remove it' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
