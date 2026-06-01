'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  value: number
  onChange: (rating: number) => void
  required?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export default function StarRating({
  value,
  onChange,
  required = false,
  label,
  size = 'md',
  interactive = true,
}: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = useState(0)

  const handleClick = (rating: number) => {
    if (interactive) {
      onChange(rating)
    }
  }

  const handleMouseEnter = (rating: number) => {
    if (interactive) {
      setHoveredRating(rating)
    }
  }

  const handleMouseLeave = () => {
    if (interactive) {
      setHoveredRating(0)
    }
  }

  const displayRating = hoveredRating || value

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            onMouseEnter={() => handleMouseEnter(rating)}
            onMouseLeave={handleMouseLeave}
            disabled={!interactive}
            className={`focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
              interactive ? 'cursor-pointer' : 'cursor-default'
            } ${!interactive ? 'pointer-events-none' : ''}`}
            aria-label={`Rate ${rating} out of 5`}
            aria-pressed={rating === value}
          >
            <Star
              className={`${sizeClasses[size]} transition-colors ${
                rating <= displayRating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-gray-600">
            {value} {value === 1 ? 'star' : 'stars'}
          </span>
        )}
      </div>
    </div>
  )
}