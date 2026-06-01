'use client'

import { Grid3x3, List } from 'lucide-react'

interface ViewToggleProps {
  value: 'grid' | 'list'
  onChange: (value: 'grid' | 'list') => void
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`p-2 rounded ${
          value === 'grid'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        aria-label="Grid view"
        aria-pressed={value === 'grid'}
      >
        <Grid3x3 className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`p-2 rounded ${
          value === 'list'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        aria-label="List view"
        aria-pressed={value === 'list'}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  )
}