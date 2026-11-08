'use client'

import { useEffect, useState } from 'react'
import { APP_URL } from '@/lib/appSignIn'
import { OPEN_COOKIE_SETTINGS, browserSaysNo, countingConsent, setCountingConsent, type Consent } from '@/lib/consent'

/**
 * Cookies, and counting visits (lib/consent.ts), as in the Autinerary app (frontend/components/CookieConsent). Asked
 * once, of everyone, on their first visit; "Essential only" and "Allow counting" look the same and are equally easy;
 * the page stays usable while it is open. A browser sending Global Privacy Control or Do Not Track isn't asked. The
 * footer's "Cookie settings" opens it again.
 */
export default function CookieConsent() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<Consent | null>(null)
  const [browserNo, setBrowserNo] = useState(false)

  useEffect(() => {
    const no = browserSaysNo()
    const answer = countingConsent()
    setBrowserNo(no)
    setCurrent(answer)
    if (answer === null && !no) setOpen(true)
    const reopen = () => {
      setBrowserNo(browserSaysNo())
      setCurrent(countingConsent())
      setOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen)
  }, [])

  if (!open) return null
  const choose = (value: Consent) => {
    setCountingConsent(value)
    setCurrent(value)
    setOpen(false)
  }
  const button = 'min-w-[9.5rem] rounded-lg border-2 border-gray-800 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
  return (
    <aside aria-labelledby="cookie-consent-heading" data-cookie-consent className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-300 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-800">
          <h2 id="cookie-consent-heading" className="font-semibold text-gray-900">Cookies, and counting visits</h2>
          <p>
            We keep what is needed to keep you signed in and remember your accessibility settings. With your OK, we also
            count visits and searches, with a random ID kept in this browser: never anything you type, and never for ads.{' '}
            <a href={`${APP_URL}/cookies`} className="font-medium text-blue-800 underline underline-offset-2">Cookie policy</a>
          </p>
          {browserNo && <p className="mt-1">Your browser asks sites not to track you, so nothing is counted, whatever you choose.</p>}
          {current && !browserNo && <p className="mt-1 text-gray-700">Now: {current === 'yes' ? 'counting is on' : 'essential only'}.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => choose('no')} className={button}>
            Essential only
          </button>
          <button type="button" onClick={() => choose('yes')} className={button} disabled={browserNo}>
            Allow counting
          </button>
        </div>
      </div>
    </aside>
  )
}
