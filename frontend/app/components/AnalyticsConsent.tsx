'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { browserOptedOut, gaConsent, gaEnabled, loadGa, setGaConsent } from '@/lib/analytics'

/**
 * Asks once whether Google Analytics may run (lib/analytics.ts). Shown only
 * when GA is set up, the visitor has not answered, and their browser does not
 * send Do Not Track or Global Privacy Control. Nothing loads before "Allow";
 * "No thanks" is just as easy, and either answer can be changed in Settings.
 */
export default function AnalyticsConsent() {
  const [ask, setAsk] = useState(false)

  useEffect(() => {
    if (!gaEnabled() || browserOptedOut()) return
    const answer = gaConsent()
    if (answer === 'yes') loadGa()
    else if (answer === null) setAsk(true)
  }, [])

  if (!ask) return null
  const answer = (value: 'yes' | 'no') => {
    setGaConsent(value)
    setAsk(false)
  }
  return (
    <aside aria-labelledby="ga-consent-heading" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-800">
          <h2 id="ga-consent-heading" className="font-semibold text-slate-900">Help us improve Autinerary?</h2>
          <p>
            May we use Google Analytics to count which pages are used? It never includes anything you type, and it is not
            used for ads. You can change this in Settings.{' '}
            <Link href="/privacy" className="font-medium text-indigo-800 underline underline-offset-2">Privacy</Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => answer('no')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            No thanks
          </button>
          <button type="button" onClick={() => answer('yes')} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
            Allow
          </button>
        </div>
      </div>
    </aside>
  )
}
