'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ConditionsFilter from '@/components/search/ConditionsFilter'
import { FILTER_NORM_GROUPS } from '@/lib/norms/taxonomy'
import { LIFE_AREAS } from '@/lib/search/lifeAreas'

/**
 * Filters for Tidbits (Odosa: "copy the Filter list from the ResourceHub, but
 * without the Resource-specific filters — Cost, distance, …").
 *
 * Same taxonomy and same shape as the search sidebar, so the two surfaces feel
 * like one product. What's deliberately absent is everything that only makes
 * sense for a place you go to: cost, distance, minimum rating, resource type.
 * A post has no price and no address, so those filters would return nothing
 * and teach people the filters are broken.
 *
 * Norm groups start expanded and toggle independently — the same fix made to
 * the search sidebar, where a collapsed single-open accordion made the filters
 * look inert.
 */

interface TidbitsFilterSidebarProps {
  barriers: string[]
  conditions: string[]
  lifeAreas: string[]
  onBarrierToggle: (barrier: string) => void
  onConditionsChange: (next: string[]) => void
  onLifeAreaToggle: (area: string) => void
  onClear: () => void
}

export default function TidbitsFilterSidebar({
  barriers,
  conditions,
  lifeAreas,
  onBarrierToggle,
  onConditionsChange,
  onLifeAreaToggle,
  onClear,
}: TidbitsFilterSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const activeCount = barriers.length + conditions.length + lifeAreas.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs text-blue-600 hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* Norms — same taxonomy as onboarding and search */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Norms</h3>
        <div className="space-y-1 border border-gray-200 rounded-lg overflow-hidden">
          {FILTER_NORM_GROUPS.map((g) => {
            const isExpanded = !collapsed.has(g.key)
            const selectedCount = g.norms.filter((n) => barriers.includes(n.id)).length
            return (
              <div key={g.key} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {g.label}
                    {selectedCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                        {selectedCount}
                      </span>
                    )}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 bg-gray-50 space-y-1 max-h-64 overflow-y-auto">
                    {g.norms.map((n) => (
                      <label
                        key={n.id}
                        className="flex items-center cursor-pointer hover:bg-white p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={barriers.includes(n.id)}
                          onChange={() => onBarrierToggle(n.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{n.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <ConditionsFilter embedded selected={conditions} onChange={onConditionsChange} />
        </div>
      </div>

      {/* Life area — a post belongs to a life domain the same way a resource does */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Life Category</h3>
        <p className="text-xs text-gray-500 mb-3">Filter posts by life domain.</p>
        <div className="space-y-2">
          {LIFE_AREAS.map((area) => (
            <label
              key={area.id}
              className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={lifeAreas.includes(area.id)}
                onChange={() => onLifeAreaToggle(area.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{area.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
