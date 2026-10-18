'use client'

import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import { APP_NEWSLETTER, APP_TERMS, APP_URL } from '@/lib/appSignIn'
import { CHOICE_DISCLAIMER, monthName, torontoMonth } from '@/lib/communityChoice'

/**
 * The service directory's banner (the team's planning note, October 2026,
 * Goal 5): "Vote for this month's Community Choice service, through our
 * Newsletter! + Sign Up Now button", with the note on how Community's Choice
 * is chosen and on how ratings are kept honest. It can be put away for the
 * month.
 */
export default function CommunityChoiceBanner() {
  const month = torontoMonth()
  const key = `community-choice-banner-${month}`
  const [shown, setShown] = useState(false)

  useEffect(() => {
    try {
      setShown(localStorage.getItem(key) !== 'hidden')
    } catch {
      setShown(true)
    }
  }, [key])

  if (!shown) return null
  const hide = () => {
    setShown(false)
    try {
      localStorage.setItem(key, 'hidden')
    } catch {}
  }

  return (
    <section
      aria-label="Community's Choice"
      className="relative mb-6 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 p-4 pr-12"
    >
      <button type="button" onClick={hide} className="absolute right-3 top-3 rounded p-1 text-gray-700 hover:bg-amber-100" aria-label="Hide this for the month">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <Trophy className="h-6 w-6 flex-shrink-0 text-amber-800" aria-hidden="true" />
        <p className="flex-1 font-semibold text-gray-900">
          Vote for {monthName(month)}&apos;s Community&apos;s Choice service, through our newsletter!
        </p>
        <a
          href={APP_NEWSLETTER}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
        >
          Sign up now
        </a>
      </div>
      <p className="mt-2 text-sm text-gray-800">
        {CHOICE_DISCLAIMER}{' '}
        <a href={`${APP_URL}/community-choice`} className="font-medium text-blue-800 underline">
          How it works
        </a>
      </p>
      <p className="mt-1 text-sm text-gray-800">
        Ratings come from people who have used a service. A service rated under 4 out of 5 gets a warning; at 3.5 or under it has
        two months to improve, or it is hidden.{' '}
        <a href={`${APP_TERMS}#ratings`} className="font-medium text-blue-800 underline">
          How ratings work
        </a>
      </p>
    </section>
  )
}
