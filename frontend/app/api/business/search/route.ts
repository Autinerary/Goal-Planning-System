import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isItemKind, maskEmail, usableEmail } from '@/lib/listings'

export const dynamic = 'force-dynamic'

const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** GET /api/business/search?q=&kind=resource|product: listings to claim, by name. */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)
  const kind = req.nextUrl.searchParams.get('kind') || 'resource'
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!isItemKind(kind) || (q.length < 2 && !/^[0-9a-f-]{36}$/i.test(id))) return NextResponse.json({ items: [] })
  const admin = createAdminClient()
  const base =
    kind === 'resource'
      ? admin.from('resources').select('id, name, category, location, contact_info').eq('status', 'approved')
      : admin.from('products').select('id, name, category, seller').eq('status', 'active')
  const { data } = await (id ? base.eq('id', id) : base.ilike('name', like(q))).limit(10)
  const rows = (data || []) as any[]
  const { data: owned } = rows.length
    ? await admin.from('listing_claims').select('item_id').eq('item_kind', kind).eq('status', 'verified').in('item_id', rows.map((r) => r.id))
    : { data: [] as { item_id: string }[] }
  const taken = new Set((owned || []).map((o) => o.item_id))
  return NextResponse.json({
    items: rows.map((r) => {
      const email = kind === 'resource' ? usableEmail(r.contact_info?.email) : null
      return {
        kind,
        id: r.id,
        name: r.name,
        where: kind === 'resource' ? [r.location?.city, r.location?.province].filter(Boolean).join(', ') : r.seller || '',
        category: r.category,
        email: email ? maskEmail(email) : null,
        claimed: taken.has(r.id),
      }
    }),
  })
}
