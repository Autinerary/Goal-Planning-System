'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface CategorySelectProps {
  value: string
  onChange: (category: string) => void
  required?: boolean
  error?: string
}

const categories = [
  { id: 'therapist', label: 'Therapist', icon: '🧠' },
  { id: 'school', label: 'School', icon: '🏫' },
  { id: 'doctor', label: 'Doctor', icon: '👨‍⚕️' },
  { id: 'park', label: 'Park', icon: '🌳' },
  { id: 'store', label: 'Store', icon: '🏪' },
  { id: 'app', label: 'App', icon: '📱' },
  { id: 'book', label: 'Book', icon: '📚' },
  { id: 'support_group', label: 'Support Group', icon: '👥' },
  { id: 'organization', label: 'Organization', icon: '🏢' },
  { id: 'workshop', label: 'Workshop', icon: '🎓' },
  { id: 'recreation', label: 'Recreation', icon: '🎨' },
  { id: 'other', label: 'Other', icon: '📌' },
]

export default function CategorySelect({
  value,
  onChange,
  required = false,
  error,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const selectedCategory = categories.find((cat) => cat.id === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!target || !(target as Element).closest('.category-select-container')) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="category-select-container relative">
      <label className="block text-sm font-medium text-gray-900 mb-2">
        Category {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full px-4 py-2 text-left border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
          aria-label="Select category"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <div className="flex items-center justify-between">
            {selectedCategory ? (
              <span className="flex items-center gap-2">
                <span>{selectedCategory.icon}</span>
                <span>{selectedCategory.label}</span>
              </span>
            ) : (
              <span className="text-gray-500">Select a category</span>
            )}
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'transform rotate-180' : ''}`}
              aria-hidden="true"
            />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            <div role="listbox" className="py-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    onChange(category.id)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 ${
                    value === category.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                  role="option"
                  aria-selected={value === category.id}
                >
                  <span className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}