'use client'

import { useState } from 'react'
import IntersectionalityBadge from './IntersectionalityBadge'

export interface BarrierOption {
  id: string
  label: string
  category: string
  categoryLabel: string
}

export interface SelectedBarrier extends BarrierOption {
  severity?: number
  notes?: string
}

interface BarrierSelectorProps {
  selectedBarriers: SelectedBarrier[]
  onBarriersChange: (barriers: SelectedBarrier[]) => void
}

const barrierCategories = {
  neurodivergence: {
    label: 'Neurodivergence',
    barriers: [
      { id: 'autism', label: 'Autism Spectrum' },
      { id: 'adhd', label: 'ADHD' },
      { id: 'ocd', label: 'OCD' },
      { id: 'bipolar', label: 'Bipolar Disorder' },
      { id: 'neurodivergence_other', label: 'Other (specify)' },
    ],
  },
  disability: {
    label: 'Non-Neurodivergent Disabilities',
    barriers: [
      { id: 'sensory_deaf', label: 'Deaf or Hard of Hearing' },
      { id: 'sensory_blind', label: 'Blind or Low Vision' },
      { id: 'physical_wheelchair', label: 'Wheelchair User' },
      { id: 'physical_mobility', label: 'Mobility Challenges' },
      { id: 'intellectual', label: 'Intellectual Disabilities' },
      { id: 'disability_other', label: 'Other (specify)' },
    ],
  },
  identity: {
    label: 'Identity & Background',
    barriers: [
      { id: 'race_visible_minority', label: 'Race/Visible Minority' },
      { id: 'ethnicity', label: 'Ethnicity' },
      { id: 'language', label: 'Primary Language' },
      { id: 'gender', label: 'Gender Identity' },
      { id: 'lgbtq', label: 'LGBTQ+' },
      { id: 'socioeconomic', label: 'Socioeconomic Considerations' },
    ],
  },
  health: {
    label: 'Health',
    barriers: [
      { id: 'chronic_health', label: 'Chronic Health Conditions' },
      { id: 'mental_health', label: 'Mental Health Considerations' },
    ],
  },
}

export default function BarrierSelector({ selectedBarriers, onBarriersChange }: BarrierSelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('neurodivergence')
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({})

  function toggleBarrier(categoryKey: string, barrier: { id: string; label: string }) {
    const categoryLabel = barrierCategories[categoryKey as keyof typeof barrierCategories].label
    const barrierOption: BarrierOption = {
      id: barrier.id,
      label: barrier.label,
      category: categoryKey,
      categoryLabel,
    }

    const existingIndex = selectedBarriers.findIndex((b) => b.id === barrier.id)

    if (existingIndex >= 0) {
      // Remove barrier
      const updated = selectedBarriers.filter((_, index) => index !== existingIndex)
      onBarriersChange(updated)
    } else {
      // Add barrier
      const updated = [...selectedBarriers, { ...barrierOption, severity: 3 }]
      onBarriersChange(updated)
    }
  }

  function updateSeverity(barrierId: string, severity: number) {
    const updated = selectedBarriers.map((b) =>
      b.id === barrierId ? { ...b, severity } : b
    )
    onBarriersChange(updated)
  }

  function updateNotes(barrierId: string, notes: string) {
    const updated = selectedBarriers.map((b) => (b.id === barrierId ? { ...b, notes } : b))
    onBarriersChange(updated)
  }

  function isBarrierSelected(barrierId: string): boolean {
    return selectedBarriers.some((b) => b.id === barrierId)
  }

  const selectedCount = selectedBarriers.length
  const barrierLabels = selectedBarriers.map((b) => b.label)

  return (
    <div className="space-y-6">
      {/* Intersectionality Badge */}
      <IntersectionalityBadge count={selectedCount} barriers={barrierLabels} />

      {/* Patent Compliance Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong className="font-semibold">Your ratings will help others in your community.</strong>
          <br />
          <span className="mt-1 block">
            Rated BY people like you, FOR people like you. You control what you share.
          </span>
        </p>
      </div>

      {/* Barrier Categories */}
      {Object.entries(barrierCategories).map(([categoryKey, category]) => {
        const isExpanded = expandedCategory === categoryKey
        const categorySelectedCount = selectedBarriers.filter(
          (b) => b.category === categoryKey
        ).length

        return (
          <div key={categoryKey} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center">
                <h3 className="text-lg font-semibold text-gray-900">{category.label}</h3>
                {categorySelectedCount > 0 && (
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {categorySelectedCount} selected
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  isExpanded ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isExpanded && (
              <div className="p-6 space-y-4 bg-white">
                {category.barriers.map((barrier) => {
                  const isSelected = isBarrierSelected(barrier.id)
                  const selectedBarrier = selectedBarriers.find((b) => b.id === barrier.id)
                  const isOther = barrier.id.includes('_other')

                  return (
                    <div key={barrier.id} className="space-y-3">
                      {/* Barrier Checkbox */}
                      <label className="flex items-start cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleBarrier(categoryKey, barrier)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          aria-label={barrier.label}
                        />
                        <span className="ml-3 flex-1 text-gray-900 group-hover:text-blue-600">
                          {barrier.label}
                          {isOther && (
                            <span className="ml-2 text-xs text-gray-500">
                              (please specify in notes)
                            </span>
                          )}
                        </span>
                      </label>

                      {/* Severity Slider (if selected) */}
                      {isSelected && selectedBarrier && (
                        <div className="ml-7 space-y-2">
                          <label className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">Impact on daily life:</span>
                            <span className="font-medium text-blue-600">
                              {selectedBarrier.severity || 3}/5
                            </span>
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={selectedBarrier.severity || 3}
                            onChange={(e) => updateSeverity(barrier.id, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            aria-label={`Severity for ${barrier.label}`}
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Low</span>
                            <span>High</span>
                          </div>

                          {/* Notes Field */}
                          <textarea
                            placeholder="Optional: Describe specific challenges or details..."
                            value={selectedBarrier.notes || ''}
                            onChange={(e) => updateNotes(barrier.id, e.target.value)}
                            rows={2}
                            className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            aria-label={`Notes for ${barrier.label}`}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }      )}
    </div>
  )
}
