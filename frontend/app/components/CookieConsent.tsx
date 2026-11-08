'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { OPEN_COOKIE_SETTINGS, browserSaysNo, countingConsent, type Consent } from '@/lib/consent'
import { gaEnabled, loadGa, setGaConsent } from '@/lib/analytics'

/**
 * Cookies, and counting visits (lib/consent.ts; the cookie policy is app/cookies). Asked once, of everyone, on their
 * first visit: what keeps them signed in needs no yes, and counting how the app is used waits for one. "Essential
 * only" and "Allow counting" look the same and are equally easy; nothing is chosen for them, and the page stays usable
 * while it is open. A browser sending Global Privacy Control or Do Not Track isn't asked: nothing is counted. The
 * footer's "Cookie settings" opens it again, and Settings has the same choice.
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
    if (answer === 'yes' && !no) loadGa()
    else if (answer === null && !no) setOpen(true)
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
    setGaConsent(value)
    setCurrent(value)
    setOpen(false)
  }
  const button = 'min-w-[9.5rem] rounded-lg border-2 border-slate-800 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2'
  return (
    <aside aria-labelledby="cookie-consent-heading" data-cookie-consent className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-800">
          <h2 id="cookie-consent-heading" className="font-semibold text-slate-900">Cookies, and counting visits</h2>
          <p>
            We keep what is needed to keep you signed in and remember your settings. With your OK, we also count which
            pages are opened and how far setup goes, with a random ID kept in this browser: never anything you type, and
            never for ads.{gaEnabled() ? ' Google Analytics gets the same counts.' : ''}{' '}
            <Link href="/cookies" className="font-medium text-indigo-800 underline underline-offset-2">Cookie policy</Link>
          </p>
          {browserNo && (
            <p className="mt-1">Your browser asks sites not to track you, so nothing is counted, whatever you choose.</p>
          )}
          {current && !browserNo && (
            <p className="mt-1 text-slate-700">Now: {current === 'yes' ? 'counting is on' : 'essential only'}.</p>
          )}
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
