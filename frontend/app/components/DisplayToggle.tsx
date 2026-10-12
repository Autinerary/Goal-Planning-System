'use client'

import { useEffect, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import DisplaySettings from './DisplaySettings'

/**
 * The Path's Display button (Riipen Labs, Group 26: "move 'Personalize' out of
 * onboarding and into a toggle on the home page", in "one of the top corners
 * of the app", like a dark/light mode switch, so people can "adjust their
 * preferred mode and personalization settings at any time"). It opens the
 * display choices under the Path's heading; they take effect at once.
 *
 * Also opened by the "autinerary:open-display" event (the tour's task).
 */
export function DisplayButton({ open, onToggle, className = '' }: { open: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-tour="display"
      aria-expanded={open}
      aria-controls="display-panel"
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-indigo-700 border border-slate-300 rounded-lg bg-white/80 hover:bg-white hover:border-indigo-300 transition-all ${className}`}
      title="Light or dark, text size, contrast, motion, and how lively it looks"
    >
      <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
      Display
    </button>
  )
}

/**
 * Since Riipen Labs, Group 22 ("sensory control before the animations load";
 * the "sensory" setting "should be rearranged as it is at step 8 of 9"), the
 * button is also on the home page, Start here, sign-up, sign-in and setup:
 * `visitor` leaves out what needs an account.
 */
export function DisplayPanel({ onClose, visitor = false, className = '' }: { onClose: () => void; visitor?: boolean; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <section id="display-panel" aria-labelledby="display-panel-heading" className={`mb-6 rounded-2xl border border-indigo-200 bg-white p-4 text-left shadow-sm sm:p-6 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="display-panel-heading" className="text-lg font-bold text-slate-800">Display</h2>
          <p className="text-sm text-slate-700">Changes show at once. Pick what is easiest on your eyes.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Display" className="rounded-md p-1 text-slate-600 hover:text-slate-900">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <DisplaySettings visitor={visitor} />
    </section>
  )
}

/** Open state shared by the button and the panel, with the tour's event. */
export function useDisplayToggle() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('autinerary:open-display', show)
    return () => window.removeEventListener('autinerary:open-display', show)
  }, [])
  return { open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }
}
