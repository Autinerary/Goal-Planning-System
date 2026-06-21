'use client'

import { Star } from 'lucide-react'

interface RatingChipsFilterProps {
  // Star thresholds the user wants to allow ("4+ stars", "5 stars" — the chips
  // in the Figma). Stored as the lower-bound minimum the search uses.
  selectedStars: number[]
  // The bucket options shown as chips. 0 = "Select All".
  options?: number[]
  onChange: (next: number[]) => void
}

const DEFAULT_OPTIONS = [4, 5]

export default function RatingChipsFilter({
  selectedStars,
  options = DEFAULT_OPTIONS,
  onChange,
}: RatingChipsFilterProps) {
  const allSelected =
    selectedStars.length === options.length &&
    options.every((o) => selectedStars.includes(o))

  const toggleStar = (value: number) => {
    if (selectedStars.includes(value)) {
      onChange(selectedStars.filter((s) => s !== value))
    } else {
      onChange([...selectedStars, value])
    }
  }

  const selectAll = () => {
    if (allSelected) onChange([])
    else onChange([...options])
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Service Ratings</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((value) => {
          const active = selectedStars.includes(value)
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleStar(value)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
              aria-pressed={active}
              aria-label={`${value} stars and up`}
            >
              {Array.from({ length: value }, (_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    active ? 'fill-yellow-300 text-yellow-300' : 'fill-yellow-400 text-yellow-400'
                  }`}
                  aria-hidden="true"
                />
              ))}
              <span className="ml-1">{value}+</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={selectAll}
          className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm transition-colors ${
            allSelected
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
          }`}
          aria-pressed={allSelected}
        >
          Select All
        </button>
      </div>
    </div>
  )
}
