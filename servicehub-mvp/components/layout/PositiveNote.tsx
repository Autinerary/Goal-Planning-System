'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Leaf } from 'lucide-react'
import { NORM_NOTES, noteFor, POSITIVE_OFF_KEY, today } from '@/lib/positive'

/**
 * A note for today (the planning note, October 2026, Goal 11: the Positivity
 * Quota; lib/positive.ts, the same as the app's). `norms` (ids) picks notes
 * for someone's norms; `onlyNorms` shows nothing without one (the service
 * page's sidebar, so the footer's note isn't repeated). Hidden when the
 * app's Settings turned the notes off (data-daily-notes) or "Hide these
 * notes" was pressed here.
 */
export default function PositiveNote({ norms = [], onlyNorms = false, variant = 'band' }: { norms?: string[]; onlyNorms?: boolean; variant?: 'band' | 'card' }) {
  const pathname = usePathname() || '/'
  const [note, setNote] = useState('')
  const key = norms.join(',')

  useEffect(() => {
    let off = document.documentElement.dataset.dailyNotes === 'off'
    try {
      off = off || localStorage.getItem(POSITIVE_OFF_KEY) === 'off'
    } catch {}
    if (off) return setNote('')
    const ids = key ? key.split(',') : []
    if (onlyNorms) {
      const mine = ids.flatMap((n) => NORM_NOTES[n] || [])
      return setNote(mine.length ? mine[(today().charCodeAt(9) + pathname.length) % mine.length] : '')
    }
    setNote(noteFor(today(), `hub:${pathname}`, ids))
  }, [pathname, key, onlyNorms])

  if (!note) return null
  const hide = () => {
    try {
      localStorage.setItem(POSITIVE_OFF_KEY, 'off')
    } catch {}
    setNote('')
  }
  if (variant === 'card')
    return (
      <aside aria-label="A note for you" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-start gap-2 text-sm text-gray-900">
          <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          {note}
        </p>
      </aside>
    )
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
      <Leaf className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
      {note}
      <button type="button" onClick={hide} className="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900">
        Hide these notes
      </button>
    </p>
  )
}
