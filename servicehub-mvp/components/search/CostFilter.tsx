'use client'

import { useEffect, useState } from 'react'

interface CostFilterProps {
  min?: number
  max?: number
  // Hard bounds for the slider; matches Figma at $0-$50,000
  bounds?: { min: number; max: number }
  onChange: (next: { min?: number; max?: number }) => void
}

const DEFAULT_BOUNDS = { min: 0, max: 50_000 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export default function CostFilter({
  min,
  max,
  bounds = DEFAULT_BOUNDS,
  onChange,
}: CostFilterProps) {
  // Local controlled state so the inputs feel snappy; sync up on blur / slider release.
  const [localMin, setLocalMin] = useState<string>(min !== undefined ? String(min) : '')
  const [localMax, setLocalMax] = useState<string>(max !== undefined ? String(max) : '')

  useEffect(() => {
    setLocalMin(min !== undefined ? String(min) : '')
  }, [min])

  useEffect(() => {
    setLocalMax(max !== undefined ? String(max) : '')
  }, [max])

  const commitMin = (raw: string) => {
    if (raw.trim() === '') {
      onChange({ min: undefined, max })
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    const next = clamp(parsed, bounds.min, max ?? bounds.max)
    onChange({ min: next, max })
  }

  const commitMax = (raw: string) => {
    if (raw.trim() === '') {
      onChange({ min, max: undefined })
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    const next = clamp(parsed, min ?? bounds.min, bounds.max)
    onChange({ min, max: next })
  }

  const fmt = (v: number) => `$${v.toLocaleString()}`

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Cost</h3>
        {(min !== undefined || max !== undefined) && (
          <button
            type="button"
            onClick={() => onChange({ min: undefined, max: undefined })}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label htmlFor="cost-min" className="sr-only">
            Minimum cost
          </label>
          <input
            id="cost-min"
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            placeholder={fmt(bounds.min)}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={(e) => commitMin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitMin((e.target as HTMLInputElement).value)
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <span className="text-gray-400">—</span>
        <div className="flex-1">
          <label htmlFor="cost-max" className="sr-only">
            Maximum cost
          </label>
          <input
            id="cost-max"
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            placeholder={fmt(bounds.max)}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={(e) => commitMax(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitMax((e.target as HTMLInputElement).value)
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Range {fmt(bounds.min)} – {fmt(bounds.max)}. Resources with no listed price are always shown.
      </p>
    </div>
  )
}
