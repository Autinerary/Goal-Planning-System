'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { track } from '@/lib/funnel'

/**
 * A page that is not there. It used to be the framework's bare "404: This
 * page could not be found". Riipen Labs, Group 19 measured success partly by
 * "fewer navigation errors", so this page is counted (feature_use
 * "not_found", once a day per browser; the funnel report's "Pages not
 * found") and offers the places most people want instead.
 */
const KEY = 'autinerary_not_found_day'

export default function NotFound() {
  // Marks the page, so the sign-in guard leaves it alone (AuthContext): it
  // used to send a signed-out visitor with a mistyped link to sign in.
  useEffect(() => {
    document.documentElement.dataset.notFound = 'true'
    return () => { delete document.documentElement.dataset.notFound }
  }, [])
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      if (localStorage.getItem(KEY) === today) return
      localStorage.setItem(KEY, today)
    } catch {
      return
    }
    track('feature_use', 'not_found')
  }, [])
  const link = 'font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950'
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">This page isn&apos;t here</h1>
        <p className="mt-3 text-slate-800">The link may be old, or mistyped. Nothing you saved is lost.</p>
        <ul className="mt-5 space-y-2 text-slate-800">
          <li><Link href="/path" className={link}>Your Path</Link>: your next step</li>
          <li><Link href="/start" className={link}>Start here</Link>: places to start, no account needed</li>
          <li><Link href="/help" className={link}>What things are called</Link>: every place in the app</li>
          <li><Link href="/" className={link}>The home page</Link></li>
        </ul>
      </div>
    </main>
  )
}
