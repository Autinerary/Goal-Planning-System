'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { AREAS_REVEALED_KEY, areaList, type AreaView } from '@/lib/lifeAreas'
import { track } from '@/lib/funnel'

/**
 * Whether this person chose to see every life area of their plan now
 * (lib/lifeAreas.ts, Riipen Labs Group 20). Kept on the device; every page
 * that shows the plan hears the change at once.
 */
export function useLifeAreasRevealed(): [boolean, () => void] {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const read = () => { try { setRevealed(localStorage.getItem(AREAS_REVEALED_KEY) === '1') } catch {} }
    read()
    window.addEventListener('autinerary:areas', read)
    window.addEventListener('storage', read)
    return () => { window.removeEventListener('autinerary:areas', read); window.removeEventListener('storage', read) }
  }, [])
  const reveal = useCallback(() => {
    try { localStorage.setItem(AREAS_REVEALED_KEY, '1') } catch {}
    setRevealed(true)
    window.dispatchEvent(new Event('autinerary:areas'))
    track('feature_use', 'life_areas')
  }, [])
  return [revealed, reveal]
}

/** Says which areas come next, and offers them now. Nothing when all are shown. */
export default function LifeAreasNote({ view, onReveal, className = '' }: { view: AreaView; onReveal: () => void; className?: string }) {
  if (view.all || view.hidden.length === 0) return null
  const steps = view.hidden.reduce((n, h) => n + h.count, 0)
  return (
    <section aria-label="More areas of your plan" className={`rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-slate-800 ${className}`}>
      <p className="flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
        <span>
          You are starting with <strong>{view.firstLabel}</strong>. Your plan also has {steps} steps in{' '}
          {areaList(view.hidden)}. They open when you finish your first step, so there is one area to think about for now.
        </span>
      </p>
      <button
        type="button"
        onClick={onReveal}
        className="mt-3 rounded-lg border-2 border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-900 hover:border-indigo-500"
      >
        Show all {view.hidden.length + 1} areas now
      </button>
    </section>
  )
}
