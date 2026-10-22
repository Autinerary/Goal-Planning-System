'use client'

/**
 * Shorthand View of the recommendations (Odosa, Path page notes): the Pit
 * Stop's grouped boxes, where the current cards are the Full View. Unlike
 * the Pit Stop's "Tools & Resources" list, every item opens its real page
 * in ResourceHub.
 */

import Link from 'next/link'
import type { ScoredResource } from '@/lib/agents/recommendation-agent/types'

type GroupKey = 'services' | 'products' | 'commentaries'

const GROUPS: { key: GroupKey; label: string; icon: string; box: string; heading: string }[] = [
  { key: 'services', label: 'Services & Places', icon: '🔑', box: 'border-cyan-200 bg-cyan-50', heading: 'text-cyan-900' },
  { key: 'products', label: 'Shop items', icon: '🛍️', box: 'border-amber-200 bg-amber-50', heading: 'text-amber-900' },
  { key: 'commentaries', label: 'Commentaries', icon: '💬', box: 'border-purple-200 bg-purple-50', heading: 'text-purple-900' },
]

function groupOf(resource: ScoredResource): GroupKey {
  if ((resource as any).kind === 'product') return 'products'
  if (String(resource.category || '').toLowerCase() === 'commentary') return 'commentaries'
  return 'services'
}

/** Same destinations as ResourceCard: shop items live under /shop. */
function hrefOf(resource: ScoredResource): string {
  return (resource as any).kind === 'product' ? `/shop/${resource.id}` : `/resources/${resource.id}`
}

/** One short line under the name: what it is, and where. */
function detailOf(resource: ScoredResource): string {
  const category = String(resource.category || '').replace(/_/g, ' ')
  const online = (resource as any).delivery === 'online'
  const city = online ? 'Online' : (resource.location as any)?.city || ''
  return [category && category.charAt(0).toUpperCase() + category.slice(1), city].filter(Boolean).join(' · ')
}

export default function ShorthandView({ resources }: { resources: ScoredResource[] }) {
  const grouped = GROUPS.map((g) => ({ ...g, items: resources.filter((r) => groupOf(r) === g.key) })).filter(
    (g) => g.items.length > 0
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {grouped.map((g) => (
        <section key={g.key} aria-label={g.label} className={`rounded-xl border p-4 ${g.box}`}>
          <h3 className={`font-bold text-sm mb-3 flex items-center gap-2 ${g.heading}`}>
            <span aria-hidden="true">{g.icon}</span>
            {g.label}
            <span className="text-xs font-medium text-gray-600">({g.items.length})</span>
          </h3>
          <ul className="space-y-2">
            {g.items.map((r) => {
              const detail = detailOf(r)
              return (
                <li key={r.id}>
                  <Link
                    href={hrefOf(r)}
                    className="block rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <span className="block text-sm font-semibold text-gray-900 underline-offset-2 hover:underline">
                      {r.name}
                    </span>
                    {detail && <span className="block text-xs text-gray-600">{detail}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
