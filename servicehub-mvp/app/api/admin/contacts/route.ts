import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/contacts[?format=csv] — the team's contact list (the team's
 * notes, October 2026: "For any service or product added, add their email to
 * a list so that we can contact them"): every listed service's published
 * email (contact_info.email) and every shop item maker's (products
 * .contact_email, STEP 86), one row per address. Admins only. Nothing is
 * sent from here: it is a list to work from.
 */

interface Row {
  kind: 'service' | 'product'
  name: string
  email: string
  category: string
  place: string
  website: string
  link: string
  added: string
}

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(await isAdminUser(supabase, profile?.role))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const services = await readAll<any>((from, to) =>
    admin
      .from('resources')
      .select('id, name, category, location, contact_info, created_at')
      .eq('status', 'approved')
      .not('contact_info->>email', 'is', null)
      .order('name')
      .range(from, to)
  )
  // Before STEP 86 products have no contact_email: the list is services only.
  let products: any[] = []
  let productsReady = true
  try {
    products = await readAll<any>((from, to) =>
      admin.from('products').select('id, name, brand, category, maker_url, contact_email, created_at').eq('status', 'active').not('contact_email', 'is', null).order('name').range(from, to)
    )
  } catch {
    productsReady = false
  }

  const rows: Row[] = []
  const seen = new Set<string>()
  for (const r of services) {
    const email = String(r.contact_info?.email || '').trim()
    if (!EMAIL.test(email) || seen.has(`s:${email.toLowerCase()}:${r.name}`)) continue
    seen.add(`s:${email.toLowerCase()}:${r.name}`)
    const loc = r.location || {}
    rows.push({
      kind: 'service',
      name: r.name,
      email,
      category: r.category || '',
      place: [loc.city, loc.province].filter(Boolean).join(', '),
      website: r.contact_info?.website || '',
      link: `/resources/${r.id}`,
      added: String(r.created_at || '').slice(0, 10),
    })
  }
  for (const p of products) {
    const email = String(p.contact_email || '').trim()
    if (!EMAIL.test(email)) continue
    rows.push({
      kind: 'product',
      name: p.brand ? `${p.name} (${p.brand})` : p.name,
      email,
      category: p.category || '',
      place: '',
      website: p.maker_url || '',
      link: `/shop/${p.id}`,
      added: String(p.created_at || '').slice(0, 10),
    })
  }

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    const head = ['Kind', 'Name', 'Email', 'Category', 'Place', 'Website', 'ResourceHub page', 'Added']
    const body = rows.map((r) => [r.kind === 'service' ? 'Service' : 'Shop item', r.name, r.email, r.category, r.place, r.website, `https://servicehub-six.vercel.app${r.link}`, r.added].map(csvCell).join(','))
    return new NextResponse([head.map(csvCell).join(','), ...body].join('\n') + '\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="resourcehub-contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  return NextResponse.json({
    rows,
    counts: { services: rows.filter((r) => r.kind === 'service').length, products: rows.filter((r) => r.kind === 'product').length, uniqueEmails: new Set(rows.map((r) => r.email.toLowerCase())).size },
    productsReady,
  })
}
