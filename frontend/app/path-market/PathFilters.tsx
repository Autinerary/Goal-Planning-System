'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'
import { CONNECTION_TYPES } from '@/lib/filters/taxonomy'
import { PATH_CATEGORIES, type MarketCategory, type MarketFilters } from '@/lib/pathMarket'

type Counts = { areas: Record<string, number>; categories: Record<string, number>; norms: Record<string, number>; connections: Record<string, number>; status: Record<string, number> }

const box = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'

function Count({ n }: { n: number | undefined }) {
  return <span className="ml-auto pl-2 text-xs tabular-nums text-gray-600">{n ?? 0}</span>
}

/**
 * The Path Market's filters, the same bar as ResourceHub's
 * (servicehub-mvp/components/search/FilterSidebar.tsx): sections with a
 * heading, groups that open and close, a badge when something in a closed
 * group is chosen. "Path Categories" comes first (the team's notes, October
 * 2026): the five life categories, each opening onto its specialised
 * categories. Then ResourceHub's Norms (lib/norms/taxonomy.ts) and
 * Connection Type to Norm (lib/filters/taxonomy.ts), and the status. The
 * number beside each is how many models it would show.
 */
export default function PathFilters({
  filters,
  setFilters,
  categories,
  counts,
  myNorms,
}: {
  filters: MarketFilters
  setFilters: (next: MarketFilters) => void
  categories: MarketCategory[]
  counts: Counts
  /** The person's norms as ResourceHub's ids, for "Match my norms". */
  myNorms: string[]
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [closedNorms, setClosedNorms] = useState<Set<string>>(new Set())
  const toggleIn = (key: keyof MarketFilters, id: string) => {
    const list = filters[key] as string[]
    setFilters({ ...filters, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] })
  }
  const flip = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const matchingMine = myNorms.length > 0 && myNorms.every((n) => filters.norms.includes(n))

  return (
    <div className="space-y-6" data-path-filters>
      {/* Path Categories: the five life categories, each with its specialised ones. */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Path Categories</h3>
        <div className="space-y-1 overflow-hidden rounded-lg border border-gray-200">
          {PATH_CATEGORIES.map((area) => {
            const under = categories.filter((c) => c.lifeAreas.includes(area.id))
            const expanded = open.has(area.id) || filters.areas.includes(area.id)
            const chosenUnder = under.filter((c) => filters.categories.includes(c.key)).length
            return (
              <div key={area.id} className="border-b border-gray-200 last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                  <input
                    id={`area-${area.id}`}
                    type="checkbox"
                    checked={filters.areas.includes(area.id)}
                    onChange={() => toggleIn('areas', area.id)}
                    className={box}
                  />
                  <label htmlFor={`area-${area.id}`} className="flex flex-1 cursor-pointer items-center text-sm font-medium text-gray-900">
                    <span aria-hidden="true" className="mr-1.5">{area.emoji}</span>
                    {area.label}
                    {chosenUnder > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{chosenUnder}</span>
                    )}
                    <Count n={counts.areas[area.id]} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpen(flip(open, area.id))}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} the categories under ${area.label}`}
                    className="rounded p-1 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {expanded && (
                  <div className="space-y-1 bg-gray-50 px-3 pb-3 pl-9">
                    {under.length === 0 && <p className="py-1 text-xs text-gray-600">No categories here yet.</p>}
                    {under.map((c) => (
                      <label key={c.key} className="flex cursor-pointer items-center rounded p-1.5 hover:bg-white">
                        <input type="checkbox" checked={filters.categories.includes(c.key)} onChange={() => toggleIn('categories', c.key)} className={box} />
                        <span className="ml-2 text-sm text-gray-800">{c.title}</span>
                        <Count n={counts.categories[c.key]} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Norms, grouped as ResourceHub groups them. */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Norms</h3>
        <p className="mb-3 text-xs text-gray-600">The norms a path was lived with.</p>
        {myNorms.length > 0 && (
          <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={matchingMine}
              onChange={() =>
                setFilters({
                  ...filters,
                  norms: matchingMine ? filters.norms.filter((n) => !myNorms.includes(n)) : Array.from(new Set([...filters.norms, ...myNorms])),
                })
              }
              className={box}
            />
            Match my norms
          </label>
        )}
        <div className="space-y-1 overflow-hidden rounded-lg border border-gray-200">
          {NORM_GROUPS.map((g) => {
            const options = g.norms.filter((n) => !n.id.endsWith('_other'))
            const expanded = !closedNorms.has(g.key)
            const chosen = options.filter((n) => filters.norms.includes(n.id)).length
            return (
              <div key={g.key} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setClosedNorms(flip(closedNorms, g.key))}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {g.label}
                    {chosen > 0 && <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{chosen}</span>}
                  </span>
                  {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />}
                </button>
                {expanded && (
                  <div className="max-h-64 space-y-1 overflow-y-auto bg-gray-50 px-4 pb-3">
                    {options.map((n) => (
                      <label key={n.id} className="flex cursor-pointer items-center rounded p-2 hover:bg-white">
                        <input type="checkbox" checked={filters.norms.includes(n.id)} onChange={() => toggleIn('norms', n.id)} className={box} />
                        <span className="ml-2 text-sm text-gray-800">{n.label}</span>
                        <Count n={counts.norms[n.id]} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Connection Type to Norm, as ResourceHub has it. */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Connection Type to Norm</h3>
        <p className="mb-3 text-xs text-gray-600">How the path’s contributors are connected to its norms.</p>
        <div className="space-y-1">
          {CONNECTION_TYPES.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center rounded p-2 hover:bg-gray-50 ${'parent' in c && c.parent ? 'ml-5' : ''}`}>
              <input type="checkbox" checked={filters.connections.includes(c.id)} onChange={() => toggleIn('connections', c.id)} className={box} />
              <span className="ml-2 text-sm text-gray-800">{c.label}</span>
              <Count n={counts.connections[c.id]} />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Status</h3>
        <div className="space-y-1">
          {[
            { id: 'live', label: 'Available' },
            { id: 'coming', label: 'Coming soon' },
            { id: 'pending', label: 'Waiting for review' },
          ].map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center rounded p-2 hover:bg-gray-50">
              <input type="checkbox" checked={filters.status.includes(s.id)} onChange={() => toggleIn('status', s.id)} className={box} />
              <span className="ml-2 text-sm text-gray-800">{s.label}</span>
              <Count n={counts.status[s.id]} />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
