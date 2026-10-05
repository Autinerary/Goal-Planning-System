import { NextRequest, NextResponse } from 'next/server'
import { pathwayFor, isStartGoal, isStartRole, searchPath, type PathwayItem } from '@/lib/startHere'

/**
 * GET /api/starter-resources?need=<goal id>&for=<role id>
 *
 * The items of a "Start here" pathway (lib/startHere.ts), filled in from
 * ResourceHub's public search: how many places each search finds, and which
 * shop items match. Searches that find nothing are left out. Paths are
 * ResourceHub paths; the page decides how to link them (signed in or not).
 *
 * Public data only. Complete answers are cached for 10 minutes at the edge.
 */

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

export interface StarterItem {
  id: string
  label: string
  detail: string
  path: string
  /** Places a search finds. */
  count?: number
  /** Shop items and Tidbits open with a free account. */
  needsAccount?: boolean
}

async function hubSearch(params: Record<string, string>, pageSize: number): Promise<any> {
  const qs = new URLSearchParams({ ...params, pageSize: String(pageSize) })
  // Not kept in Next's data cache, so a failed answer is never reused; the
  // finished response is what gets cached (below).
  const res = await fetch(`${HUB}/api/search?${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`ResourceHub ${res.status}`)
  return res.json()
}

async function resolve(item: PathwayItem): Promise<StarterItem[]> {
  if (item.kind === 'search') {
    const data = await hubSearch(item.params, 1)
    // Places only: a text search can also match shop items.
    const count = Math.max(0, (data.total || 0) - (data.productCount || 0))
    return count > 0 ? [{ id: item.id, label: item.label, detail: item.detail, path: searchPath(item.params), count }] : []
  }
  if (item.kind === 'shop') {
    const data = await hubSearch({ categories: item.categories.join(',') }, 48)
    const products: any[] = (data.results || []).filter(
      (r: any) => r.kind === 'product' && r.name && !/\btest(ing)?\b/i.test(r.name),
    )
    const picked: any[] = []
    if (item.names.length === 0) {
      picked.push(...products)
    } else {
      for (const name of item.names) {
        const match = products.find((p) => !picked.includes(p) && p.name.toLowerCase().includes(name))
        if (match) picked.push(match)
      }
    }
    return picked.slice(0, item.limit).map((p) => ({
      id: item.id, label: p.name, detail: item.detail, path: `/shop/${p.id}`, needsAccount: true,
    }))
  }
  return [{ id: item.id, label: item.label, detail: item.detail, path: '/community', needsAccount: true }]
}

export async function GET(req: NextRequest) {
  const need = req.nextUrl.searchParams.get('need')
  const role = req.nextUrl.searchParams.get('for')
  if (!isStartGoal(need)) return NextResponse.json({ error: 'Unknown need' }, { status: 400 })
  const pathway = pathwayFor(isStartRole(role) ? role : 'unsure', need)
  const settled = await Promise.allSettled(pathway.items.map(resolve))
  const items = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])).slice(0, 5)
  const failed = settled.some((s) => s.status === 'rejected')
  return NextResponse.json(
    { items },
    // A partial answer (ResourceHub slow or down) is not kept.
    { headers: { 'Cache-Control': failed ? 'no-store' : 'public, s-maxage=600, stale-while-revalidate=3600' } },
  )
}
