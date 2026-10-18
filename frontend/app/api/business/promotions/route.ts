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

/**
 * POST  /api/business/promotions { kind, id, headline, body, image_url, keywords, provinces, starts_on, ends_on, submit }
 *       a draft, or sent to the team (status submitted)
 * PATCH /api/business/promotions { id, status: 'draft' | 'submitted' | 'paused' | 'ended', ...fields }
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
  const { data, error } = await supabase
    .from('promotions')
    .insert({ user_id: user.id, item_kind: b.kind, item_id: b.id, ...f, categories: item?.category ? [String(item.category)] : [], status: b?.submit ? 'submitted' : 'draft' })
    .select('id, status')
    .single()
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
  }
  const { data, error } = await supabase.from('promotions').update(update).eq('id', b.id).eq('user_id', user.id).select('id, status').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Could not change that promotion.' }, { status: error ? 500 : 404 })
  return NextResponse.json(data)
}
