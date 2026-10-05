'use client'

import { useEffect, useState } from 'react'
import { Map } from 'lucide-react'
import { dayKey, getUsageLevel, getVisitDayCount, useDisclosure } from '@/lib/disclosure'

/**
 * "Ready for a bit more?" on the Path (Riipen Labs, Group 6: introduce
 * features gradually, "slowly introduce users to start and unlock features as
 * they progress").
 *
 * The Path starts in Simple view and never changes by itself
 * (lib/disclosure.ts): an interface that rearranges itself is the opposite
 * of comforting. So once someone has come back on a second day, this offers
 * the rest of the Path instead, and they choose. "Not now" waits a week.
 * Shown only when no check-in or skipped setup question is waiting
 * (app/path/page.tsx), so the Path still shows one card at a time.
 */

const SNOOZE_KEY = 'autinerary_more_offer_until'
const SNOOZE_DAYS = 7

export default function MoreFeaturesOffer() {
  const { isSimple, setOverride } = useDisclosure()
  const [due, setDue] = useState(false)
  const [days, setDays] = useState(0)

  useEffect(() => {
    try {
      const until = localStorage.getItem(SNOOZE_KEY)
      setDays(getVisitDayCount())
      setDue(getUsageLevel() !== 'simple' && !(until && until > dayKey(new Date())))
    } catch {
      setDue(false)
    }
  }, [])

  if (!isSimple || !due) return null

  const notNow = () => {
    const until = new Date()
    until.setDate(until.getDate() + SNOOZE_DAYS)
    try {
      localStorage.setItem(SNOOZE_KEY, dayKey(until))
    } catch {}
    setDue(false)
  }

  return (
    <section className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5" aria-labelledby="more-offer-heading">
      <h2 id="more-offer-heading" className="flex items-center gap-2 font-bold text-indigo-950">
        <Map className="h-5 w-5 text-indigo-700" aria-hidden="true" /> Ready for a bit more?
      </h2>
      <p className="mt-1 text-sm text-slate-800">
        You&apos;ve come back on {days} days. The full view adds your life stats, the people helping you and life path
        models to this page, and ways to save and compare your path. You can switch back to Simple any time.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOverride('full')}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
        >
          Show more
        </button>
        <button type="button" onClick={notNow} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
          Not now
        </button>
      </div>
    </section>
  )
}
