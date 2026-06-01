'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import StarRating from './StarRating'
import type { UserBarrier } from '@/types/database'

interface BarrierRatingInputProps {
  barriers: UserBarrier[]
  values: { [barrierKey: string]: { enabled: boolean; rating: number } }
  onChange: (barrierKey: string, enabled: boolean, rating: number) => void
}

export default function BarrierRatingInput({
  barriers,
  values,
  onChange,
}: BarrierRatingInputProps) {
  const handleToggle = (barrierKey: string) => {
    const current = values[barrierKey] || { enabled: false, rating: 0 }
    onChange(barrierKey, !current.enabled, current.rating || 3)
  }

  const handleRatingChange = (barrierKey: string, rating: number) => {
    const current = values[barrierKey] || { enabled: false, rating: 0 }
    onChange(barrierKey, current.enabled, rating)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">
          Barrier-Specific Ratings <span className="text-gray-500 text-xs">(Optional)</span>
        </label>
        <p className="text-sm text-gray-600 mb-4">
          Rate how well this resource addresses each of your specific barriers
        </p>
      </div>

      <div className="space-y-4">
        {barriers.map((barrier) => {
          const barrierKey = `${barrier.barrier_category}:${barrier.barrier_type}`
          const current = values[barrierKey] || { enabled: false, rating: 0 }
          const barrierLabel = `${barrier.barrier_category}: ${barrier.barrier_type}`

          return (
            <div
              key={barrier.id}
              className={`border rounded-lg p-4 transition-colors ${
                current.enabled
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(barrierKey)}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
                      current.enabled
                        ? 'text-blue-700 hover:text-blue-800'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <CheckCircle
                      className={`w-5 h-5 ${
                        current.enabled ? 'text-blue-600 fill-current' : 'text-gray-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span>This resource helped with {barrier.barrier_type}</span>
                  </button>
                </div>
              </div>

              {current.enabled && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <StarRating
                    value={current.rating || 3}
                    onChange={(rating) => handleRatingChange(barrierKey, rating)}
                    label={`Rate ${barrier.barrier_type}`}
                    size="md"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {barriers.length === 0 && (
        <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
          Complete your profile to enable barrier-specific ratings. This helps others find
          resources that address similar barriers.
        </div>
      )}
    </div>
  )
}