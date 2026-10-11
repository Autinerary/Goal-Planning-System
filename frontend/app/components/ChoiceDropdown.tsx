'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A question that opens like a dropdown (Riipen Labs, Group 34, slides 12 and
 * 16: "dropdowns instead of test-like questions"). Closed, it shows the
 * question and what is picked, so a page of questions reads as a short list.
 * Open, it shows the same large choices as before, which Group 36 asked for
 * and a native dropdown would hide. Used in setup's Motivation step; the
 * Norms step works the same way.
 */
export default function ChoiceDropdown({ question, hint, picked, children, defaultOpen = false }: {
  question: string
  hint?: string
  /** What is picked so far, in words; empty when nothing is. */
  picked: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <h2 className="text-lg font-bold text-slate-800">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-choices`}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-slate-50"
        >
          <span>
            <span className="block">{question}</span>
            <span className="block text-sm font-normal text-slate-700">
              {picked ? <><span className="font-semibold">Picked:</span> {picked}</> : 'Nothing picked yet. Choose to open.'}
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      <div id={`${id}-choices`} hidden={!open} className="border-t border-slate-100 px-4 pb-4 pt-3">
        {hint && <p className="mb-3 text-sm text-slate-700">{hint}</p>}
        {children}
      </div>
    </div>
  )
}
