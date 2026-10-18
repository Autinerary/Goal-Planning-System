'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'

/**
 * The newsletter's own sign-up page, for ResourceHub's "Sign up now" (the
 * team's planning note, October 2026, Goal 5: "Vote for this month's
 * Community Choice service, through our Newsletter! + Sign Up Now button").
 * The same weekly email and the same double opt-in as the home page's prompt
 * (/api/newsletter). Someone with an account turns on its version in
 * Settings, which also carries the vote.
 */
export default function NewsletterPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, weekly: true, sendList: false, website: trap }),
    }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    setSending(false)
    setNote(res?.ok ? 'Thank you. Check your inbox to confirm; nothing is sent until you do.' : json?.error || 'This could not be sent just now.')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">The weekly email</h1>
        <p className="mt-4 leading-relaxed text-slate-800">
          Every Monday: three places and ideas to start with, and one practical tip. In each month’s last week it carries the
          vote for{' '}
          <Link href="/community-choice" className="font-medium text-indigo-800 underline underline-offset-2">
            Community’s Choice
          </Link>
          . No spam, and you can stop at any time.
        </p>
        {user ? (
          <p className="mt-6 rounded-lg bg-indigo-50 p-4 text-slate-900">
            You have an account: turn on the weekly email in{' '}
            <Link href="/profile/settings#emails" className="font-medium text-indigo-800 underline underline-offset-2">
              Settings → Emails
            </Link>
            . Yours also has what you saved in ResourceHub.
          </p>
        ) : note ? (
          <p role="status" className="mt-6 rounded-lg bg-emerald-50 p-4 text-slate-900">
            {note}
          </p>
        ) : (
          <form onSubmit={signUp} className="mt-6 space-y-3">
            <label htmlFor="newsletter-page-email" className="block text-sm font-medium text-slate-900">
              Your email
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="newsletter-page-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" />
              <button type="submit" disabled={sending} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
                {sending ? 'Sending…' : 'Sign me up'}
              </button>
            </div>
            <p className="text-xs text-slate-700">
              We confirm by email first.{' '}
              <Link href="/privacy" className="font-medium text-indigo-800 underline underline-offset-2">
                Privacy
              </Link>
            </p>
          </form>
        )}
        <p className="mt-10 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">
            Back to Autinerary
          </Link>
        </p>
      </article>
    </div>
  )
}
