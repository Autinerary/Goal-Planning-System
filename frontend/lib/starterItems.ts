// The items of a "Start here" pathway (lib/startHere.ts), filled in from
// ResourceHub's public search: how many places each search finds, and which
// shop items match. Searches that find nothing are left out. Paths are
// ResourceHub paths; the caller decides how to link them. Server-only: used
// by /api/starter-resources and by the emailed list (app/api/newsletter).

import { pathwayFor, isStartRole, searchPath, type PathwayItem } from '@/lib/startHere'

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
  // route caches its finished response instead.
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

/** A pathway's items, at most five; `failed` when part of ResourceHub did not answer. */
export async function starterItems(role: string | null, need: string): Promise<{ items: StarterItem[]; failed: boolean }> {
  const pathway = pathwayFor(isStartRole(role) ? role : 'unsure', need as any)
  const settled = await Promise.allSettled(pathway.items.map(resolve))
  return {
    items: settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])).slice(0, 5),
    failed: settled.some((s) => s.status === 'rejected'),
  }
}

export const HUB_URL = HUB
