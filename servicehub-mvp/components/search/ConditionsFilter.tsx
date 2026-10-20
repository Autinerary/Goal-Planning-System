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
  /** When true, render just the accordion rows (no header/border) so it can be
   *  merged into another section — e.g. the combined "Norms" filter. */
  embedded?: boolean
  /** Only these top-level groups; or all but these (personality is shown apart from norms). */
  only?: string[]
  except?: string[]
}

export default function ConditionsFilter({ selected, onChange, embedded = false, only, except }: ConditionsFilterProps) {
  const groups = CONDITION_GROUPS.filter((g) => (!only || only.includes(g.id)) && !(except || []).includes(g.id))
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

  // A condition's own kinds (Autism's levels, ADHD's presentations) open and
  // close under it (the team's notes, October 2026: "a dropdown at every
  // level ... very small titles like Level 1-3 under Autism").
  const [openLeaves, setOpenLeaves] = useState<Set<string>>(new Set())
  const toggleLeaf = (id: string) =>
    setOpenLeaves((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderConditionLeaf = (condition: ConditionLeaf) => {
    const checked = isSelected(condition.id)
    const sub = subOptionFor(condition.id)
    const subs = condition.subOptions || []
    const open = openLeaves.has(condition.id)
    const listId = `condition-${condition.id}-kinds`
    return (
      <div key={condition.id} className="py-1">
        <div className="flex items-center gap-1">
          <label className="flex flex-1 items-center cursor-pointer hover:bg-white p-2 rounded">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleCondition(condition)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              {condition.label}
              {sub && <span className="ml-1 text-xs text-gray-600">· {subs.find((o) => o.id === sub)?.label}</span>}
            </span>
          </label>
          {subs.length > 0 && (
            <button
              type="button"
              onClick={() => toggleLeaf(condition.id)}
              aria-expanded={open}
              aria-controls={listId}
              aria-label={`${condition.label}: ${subs.map((o) => o.label).join(', ')}`}
              className="rounded p-1.5 text-gray-600 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>
        {subs.length > 0 && (
          <fieldset id={listId} hidden={!open} className="ml-8 mb-1 space-y-0.5">
            <legend className="sr-only">Which {condition.label}</legend>
            {[{ id: '', label: `Any ${condition.label}` }, ...subs].map((opt) => (
              <label key={opt.id || 'any'} className="flex items-center gap-2 p-1 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name={listId}
                  checked={checked && (sub ?? '') === opt.id}
                  onChange={() => setSubOption(condition, opt.id || null)}
                  className="h-4 w-4 text-blue-600"
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    )
  }

  const chosenIn = (group: ConditionGroup): number =>
    (group.conditions || []).filter((c) => isSelected(c.id)).length + (group.groups || []).reduce((n, g) => n + chosenIn(g), 0)

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
            {chosenIn(group) > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{chosenIn(group)}</span>
            )}
            {group.hint && <span className="mt-0.5 block text-xs font-normal text-gray-700">{group.hint}</span>}
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

  // Embedded: just the accordion rows, to slot into another section's box.
  if (embedded) {
    return <>{groups.map((group) => renderGroup(group))}</>
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
        {groups.map((group) => renderGroup(group))}
      </div>
    </div>
  )
}
