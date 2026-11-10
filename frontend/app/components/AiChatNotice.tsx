'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NOTICE_KEY } from '@/lib/aiSafety'

/**
 * Before someone's first chat with AI (the assistant, My agents): that it's AI and not a person, that it can be wrong,
 * and what the safety check does. Shown until "Got it", once per browser (lib/aiSafety.ts, NOTICE_KEY; one of "the
 * notes and prompts you have already seen" on the Cookies page).
 */
export default function AiChatNotice({ className = '' }: { className?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      setShow(localStorage.getItem(NOTICE_KEY) !== '1')
    } catch {
      setShow(true)
    }
  }, [])
  if (!show) return null
  const close = () => {
    try {
      localStorage.setItem(NOTICE_KEY, '1')
    } catch {
      /* private browsing: shown again next time */
    }
    setShow(false)
  }
  return (
    <section aria-label="About talking with AI" className={`rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-slate-800 ${className}`}>
      <p className="font-semibold text-slate-900">You’re talking with AI, not a person.</p>
      <p className="mt-1">
        It can be wrong, so check anything important, and it isn’t medical, legal or clinical advice. What you write and what
        it answers go through a safety check first, on our cloud model or on your own device; on our cloud model, phone
        numbers, email addresses, ID numbers and passwords are hidden from the AI first. If you may be in danger, you’ll see
        who to call.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={close} className="rounded-lg bg-indigo-700 px-3 py-1.5 font-medium text-white hover:bg-indigo-800">
          Got it
        </button>
        <Link href="/help#ai-safety" className="font-medium text-indigo-800 underline underline-offset-2">How the safety check works</Link>
      </div>
    </section>
  )
}
