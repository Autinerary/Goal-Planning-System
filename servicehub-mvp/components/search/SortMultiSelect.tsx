'use client'

import { useState } from 'react'
import { ChevronDown, X, ArrowUp, ArrowDown } from 'lucide-react'

// Sort keys we let the user combine. Order in the array = priority (first
// wins for ties beyond it).
export type SortKey =
  | 'relevance'
  | 'rating'
  | 'reviews'
  | 'newest'
  | 'distance'
  | 'cost'

export interface SortRule {
  key: SortKey
  // Direction is only meaningful for cost/rating/distance/reviews; relevance
  // and newest are inherently "best first" so direction is ignored there.
  direction: 'asc' | 'desc'
}

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Relevance',
  rating: 'Highest Rated',
  reviews: 'Most Reviewed',
  newest: 'Newest First',
  distance: 'Closest to Me',
  cost: 'Cost',
}

const COST_DIRECTION_LABELS: Record<'asc' | 'desc', string> = {
  asc: 'Low → High',
  desc: 'High → Low',
}

interface SortMultiSelectProps {
  value: SortRule[]
  onChange: (next: SortRule[]) => void
}

export default function SortMultiSelect({ value, onChange }: SortMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const usedKeys = new Set(value.map((r) => r.key))
  const availableKeys = (Object.keys(SORT_LABELS) as SortKey[]).filter((k) => !usedKeys.has(k))

  const addRule = (key: SortKey) => {
    // Default direction: cost ascending (cheap first), everything else
    // descending (highest first).
    const direction: 'asc' | 'desc' = key === 'cost' ? 'asc' : 'desc'
    onChange([...value, { key, direction }])
  }

  const removeRule = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const toggleDirection = (idx: number) => {
    onChange(
      value.map((rule, i) =>
        i === idx ? { ...rule, direction: rule.direction === 'asc' ? 'desc' : 'asc' } : rule
      )
    )
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...value]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  const summary =
    value.length === 0
      ? 'Sort by: Relevance'
      : value.length === 1
      ? `Sort by: ${SORT_LABELS[value[0].key]}`
      : `Sort by: ${value.length} criteria`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer min-w-[180px] text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {summary}
        <ChevronDown
          className={`absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-40 p-3">
            <p className="text-xs text-gray-500 mb-2">
              Add one or more sort rules. Priority is top → bottom.
            </p>

            {/* Active rules */}
            {value.length > 0 ? (
              <ul className="space-y-2 mb-3">
                {value.map((rule, i) => (
                  <li
                    key={`${rule.key}-${i}`}
                    className="flex items-center justify-between gap-2 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-gray-500 w-4">{i + 1}.</span>
                      <span className="text-sm text-gray-800 truncate">
                        {SORT_LABELS[rule.key]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(rule.key === 'cost' || rule.key === 'rating' || rule.key === 'distance' || rule.key === 'reviews') && (
                        <button
                          type="button"
                          onClick={() => toggleDirection(i)}
                          className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                          title={
                            rule.key === 'cost'
                              ? COST_DIRECTION_LABELS[rule.direction]
                              : rule.direction === 'desc'
                              ? 'Highest first'
                              : 'Lowest first'
                          }
                        >
                          {rule.direction === 'asc' ? (
                            <ArrowUp className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="w-3 h-3" aria-hidden="true" />
                          )}
                        </button>
                      )}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => moveUp(i)}
                          className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                          title="Increase priority"
                          aria-label={`Move ${SORT_LABELS[rule.key]} up`}
                        >
                          <ArrowUp className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-red-600"
                        aria-label={`Remove ${SORT_LABELS[rule.key]}`}
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic mb-3">
                Nothing selected — defaults to Relevance.
              </p>
            )}

            {/* Add menu */}
            {availableKeys.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Add a sort</p>
                <div className="flex flex-wrap gap-2">
                  {availableKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => addRule(key)}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-full hover:border-blue-500 hover:text-blue-600"
                    >
                      + {SORT_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
