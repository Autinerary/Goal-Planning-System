'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HeartHandshake } from 'lucide-react'

function left(until: number): string {
  const ms = Math.max(0, until - Date.now())
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return d > 0 ? `${d} day${d === 1 ? '' : 's'}, ${h} hour${h === 1 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}, ${m} minute${m === 1 ? '' : 's'}`
}

/**
 * "Help Us Make This Free!" (the planning note's Goal 9, Sylvia's chart:
 * "Timer goes down for CTA Button"): a button to the #FundAutinerary
 * petition, with a countdown when there is a date to count to: the end of
 * someone's free month, or the campaign's (NEXT_PUBLIC_FUND_CAMPAIGN_ENDS).
 */
export default function HelpMakeItFree({ until, label = 'Help us make this free!' }: { until?: string | null; label?: string }) {
  const target = until || process.env.NEXT_PUBLIC_FUND_CAMPAIGN_ENDS || ''
  const when = target ? Date.parse(target) : NaN
  const [text, setText] = useState('')
  useEffect(() => {
    if (!Number.isFinite(when) || when <= Date.now()) return
    setText(left(when))
    const id = setInterval(() => setText(left(when)), 60_000)
    return () => clearInterval(id)
  }, [when])
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/petition"
        className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 font-semibold text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      >
        <HeartHandshake className="h-5 w-5" aria-hidden="true" /> {label}
      </Link>
      {text && (
        <span className="text-sm font-medium text-slate-800" aria-live="off">
          {until ? `Your free month ends in ${text}` : `${text} left`}
        </span>
      )}
    </div>
  )
}
