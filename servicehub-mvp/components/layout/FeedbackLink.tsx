'use client'

import { useEffect, useRef, useState } from 'react'
import { FEEDBACK_KINDS, feedbackMailto } from '@/lib/feedback'
import { APP_URL } from '@/lib/appSignIn'

/**
 * "Send feedback": an email to heydevs@autinerary.ca with the page in it
 * (Goal 8), labelled by what it is (the products round, Goal 11), from a
 * small menu that also offers the help chat (in the app's Help page).
 */
export default function FeedbackLink({ className = '', children = 'Send feedback' }: { className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  const page = typeof window !== 'undefined' ? window.location.href : ''
  return (
    <span ref={box} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" className={className}>
        {children}
      </button>
      {open && (
        <span className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-xl border border-gray-200 bg-white p-2 text-left shadow-lg">
          <span className="block px-2 pb-1 pt-1 text-xs font-semibold text-gray-700">An email to the team, about…</span>
          {FEEDBACK_KINDS.map((k) => (
            <a key={k.id} href={feedbackMailto(page, { kind: k.id, about: 'resourcehub' })} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm text-gray-900 hover:bg-gray-100">
              {k.label}
            </a>
          ))}
          <a href={`${APP_URL}/help#ask`} className="mt-1 block rounded-lg border-t border-gray-100 px-2 pb-1.5 pt-2 text-sm font-medium text-blue-800 hover:bg-gray-100">
            Ask the help chat instead
          </a>
        </span>
      )}
    </span>
  )
}
