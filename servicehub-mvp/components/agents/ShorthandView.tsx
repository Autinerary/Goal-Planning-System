'use client'

/**
 * Shorthand View of the recommendations (Odosa, Path page notes): the Pit
 * Stop's grouped boxes, where the current cards are the Full View. Unlike
 * the Pit Stop's "Tools & Resources" list, every item opens its real page
 * in ResourceHub.
 */

import Link from 'next/link'
import type { ScoredResource } from '@/lib/agents/recommendation-agent/types'
import { costLabel } from '@/components/resources/ResourceCard'
import { SPECIAL_TAGS } from '@/lib/filters/taxonomy'

/** The full card's "Autinerary's Own" badge (admin-set only), kept in the short list. */
const OWN = SPECIAL_TAGS.find((t) => t.id === 'first_party')!

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

/** One short line under the name: what it is, where, and what it costs (as on the full card). */
function detailOf(resource: ScoredResource): string {
  const category = String(resource.category || '').replace(/_/g, ' ')
  const online = (resource as any).delivery === 'online'
  const city = online ? 'Online' : (resource.location as any)?.city || ''
  return [category && category.charAt(0).toUpperCase() + category.slice(1), city, costLabel(resource as any)]
    .filter(Boolean)
    .join(' · ')
}

export default function ShorthandView({ resources }: { resources: ScoredResource[] }) {
  const grouped = GROUPS.map((g) => ({ ...g, items: resources.filter((r) => groupOf(r) === g.key) })).filter(
    (g) => g.items.length > 0
  )
  // One group takes the whole width, its items in columns; two sit side by
  // side; three go three across on wide screens (the third spans the row
  // when there are only two columns).
  const alone = grouped.length === 1
  const columns = grouped.length === 2 ? 'md:grid-cols-2' : grouped.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : ''

  return (
    <div className={`grid grid-cols-1 gap-4 ${columns}`}>
      {grouped.map((g, i) => (
        <section
          key={g.key}
          aria-label={g.label}
          className={`rounded-xl border p-4 ${g.box} ${grouped.length >= 3 && i === 2 ? 'md:col-span-2 lg:col-span-1' : ''}`}
        >
          <h3 className={`font-bold text-sm mb-3 flex items-center gap-2 ${g.heading}`}>
            <span aria-hidden="true">{g.icon}</span>
            {g.label}
            <span className="text-xs font-medium text-gray-600">({g.items.length})</span>
          </h3>
          <ul className={alone ? 'grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
            {g.items.map((r) => {
              const detail = detailOf(r)
              const own = (r as any).is_first_party === true
              return (
                <li key={r.id}>
                  <Link
                    href={hrefOf(r)}
                    className="block rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-gray-900 underline-offset-2 hover:underline">{r.name}</span>
                      {own && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${OWN.className}`}>
                          {OWN.label}
                        </span>
                      )}
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
