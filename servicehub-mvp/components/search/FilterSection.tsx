'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * A filter heading that opens and closes (the team's notes, October 2026:
 * "Add a dropdown at every level, including the biggest titles (Ex. Resource
 * Type, Norms, ...), Big Titles (Ex. Services & Places, Identity &
 * Background, ...) & very small titles"). Open to start, so nothing is
 * hidden until someone folds it away; a closed one says how many of its
 * choices are on.
 */
export function FilterSection({
  title,
  hint,
  active = 0,
  defaultOpen = true,
  action,
  children,
}: {
  title: string
  hint?: ReactNode
  /** How many choices inside are on, shown beside the title. */
  active?: number
  defaultOpen?: boolean
  /** Shown at the end of the heading row (e.g. "Clear"). */
  action?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div data-filter-section={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={id}
            className="flex w-full items-center justify-between gap-2 rounded text-left text-sm font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span>
              {title}
              {active > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{active}</span>
              )}
            </span>
            {open ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />}
          </button>
        </h3>
        {action}
      </div>
      <div id={id} hidden={!open}>
        {hint && <div className="mb-2 text-xs text-gray-600">{hint}</div>}
        {children}
      </div>
    </div>
  )
}

/** A group inside a section ("Services & Places", "Commentaries"), also opening and closing. */
export function FilterGroup({
  label,
  active = 0,
  defaultOpen = true,
  children,
}: {
  label: ReactNode
  active?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="mt-2 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span>
          {label}
          {active > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[0.625rem] font-semibold normal-case text-white">{active}</span>
          )}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />}
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </div>
  )
}
