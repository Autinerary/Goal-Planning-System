'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import { FEEDBACK_EMAIL, FEEDBACK_KINDS, feedbackMailto } from '@/lib/feedback'

/**
 * "Send feedback": an email to heydevs@autinerary.ca from the person's own
 * email app, with the page they were on (Goal 8), labelled by what it is
 * (the products round, Goal 11: a bug, an idea, a question, a
 * recommendation), so the team can sort them. A small menu picks the kind;
 * the help chat is one of the choices. `className` styles the button for
 * where it sits (the bar, a footer, a settings button).
 */
export default function FeedbackButton({ className = '', label = 'Send feedback', icon = true, iconClassName = 'h-4 w-4' }: { className?: string; label?: string; icon?: boolean; iconClassName?: string }) {
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
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={className}
        title={`Email ${FEEDBACK_EMAIL}`}
        data-info="Opens a short menu: tell the Autinerary team something isn't working, share an idea or a recommendation, ask a question, or ask the help chat."
      >
        {icon && <MessageSquareHeart className={iconClassName} aria-hidden="true" />}
        <span>{label}</span>
      </button>
      {open && (
        <span className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-lg">
          <span className="block px-2 pb-1 pt-1 text-xs font-semibold text-slate-700">An email to the team, about…</span>
          {FEEDBACK_KINDS.map((k) => (
            <a key={k.id} href={feedbackMailto(page, { kind: k.id, about: 'app' })} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm text-slate-900 hover:bg-slate-100">
              {k.label}
            </a>
          ))}
          <a href="/help#ask" onClick={() => setOpen(false)} className="mt-1 block rounded-lg border-t border-slate-100 px-2 pb-1.5 pt-2 text-sm font-medium text-indigo-800 hover:bg-slate-100">
            Ask the help chat instead
          </a>
        </span>
      )}
    </span>
  )
}
