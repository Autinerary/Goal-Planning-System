'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  CONDITION_GROUPS,
  type ConditionGroup,
  type ConditionLeaf,
  encodeCondition,
  decodeCondition,
} from '@/lib/search/conditions'

interface ConditionsFilterProps {
  selected: string[] // tokens, e.g. ['autism:level_2', 'adhd']
  onChange: (next: string[]) => void
}

export default function ConditionsFilter({ selected, onChange }: ConditionsFilterProps) {
  // Which top-level group + nested group is currently expanded (one at a time
  // for top-level; nested groups can be independently expanded).
  const [expandedTop, setExpandedTop] = useState<string | null>(null)
  const [expandedNested, setExpandedNested] = useState<Set<string>>(new Set())

  // Map condition id -> selected sub-option (if any). Derived from `selected`.
  const subOptionFor = (conditionId: string): string | null => {
    for (const token of selected) {
      const { id, sub } = decodeCondition(token)
      if (id === conditionId) return sub ?? null
    }
    return null
  }

  const isSelected = (conditionId: string): boolean => {
    return selected.some((t) => decodeCondition(t).id === conditionId)
  }

  const toggleCondition = (condition: ConditionLeaf) => {
    if (isSelected(condition.id)) {
      // Remove any token matching this condition (with or without sub)
      onChange(selected.filter((t) => decodeCondition(t).id !== condition.id))
    } else {
      // Add the bare condition (no sub yet)
      onChange([...selected, encodeCondition(condition.id)])
    }
  }

  const setSubOption = (condition: ConditionLeaf, sub: string | null) => {
    // Replace any existing token for this condition.
    const others = selected.filter((t) => decodeCondition(t).id !== condition.id)
    onChange([...others, encodeCondition(condition.id, sub)])
  }

  const toggleNested = (id: string) => {
    setExpandedNested((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderConditionLeaf = (condition: ConditionLeaf) => {
    const checked = isSelected(condition.id)
    const sub = subOptionFor(condition.id)
    return (
      <div key={condition.id} className="py-1">
        <label className="flex items-center cursor-pointer hover:bg-white p-2 rounded">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleCondition(condition)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">{condition.label}</span>
        </label>
        {checked && condition.subOptions && condition.subOptions.length > 0 && (
          <select
            value={sub ?? ''}
            onChange={(e) => setSubOption(condition, e.target.value || null)}
            className="ml-6 mt-1 mb-1 block w-[calc(100%-1.5rem)] text-xs px-2 py-1 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`${condition.label} sub-option`}
          >
            <option value="">Any {condition.label.toLowerCase()}</option>
            {condition.subOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  const renderGroup = (group: ConditionGroup, depth = 0) => {
    const expanded = depth === 0 ? expandedTop === group.id : expandedNested.has(group.id)
    const onToggle = () => {
      if (depth === 0) {
        setExpandedTop(expandedTop === group.id ? null : group.id)
      } else {
        toggleNested(group.id)
      }
    }

    return (
      <div key={group.id} className={depth === 0 ? 'border-b border-gray-200 last:border-b-0' : 'ml-2'}>
        <button
          type="button"
          onClick={onToggle}
          className={`w-full flex items-center justify-between ${
            depth === 0 ? 'px-4 py-3' : 'px-3 py-2'
          } text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors`}
          aria-expanded={expanded}
        >
          <span
            className={`${
              depth === 0 ? 'text-sm font-medium text-gray-900' : 'text-sm text-gray-800'
            }`}
          >
            {group.label}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
          )}
        </button>
        {expanded && (
          <div className={`${depth === 0 ? 'px-4 pb-3 bg-gray-50' : 'pb-2'} space-y-1`}>
            {group.conditions?.map(renderConditionLeaf)}
            {group.groups?.map((sub) => renderGroup(sub, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Conditions</h3>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear ({selected.length})
          </button>
        )}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {CONDITION_GROUPS.map((group) => renderGroup(group))}
      </div>
    </div>
  )
}
