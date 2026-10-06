'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { NEWSLETTER_KEY } from './StartHere'

const DELAY_MS = 45_000

/**
 * The weekly email, offered once on the home page (Riipen Labs, Group 11:
 * "After 30-60 seconds: 'Every week: 3 neurodivergent-friendly resources ...
 * plus one practical tip. No spam.' ... Never a hard email wall").
 *
 * Gentle on purpose: a small card at the bottom, not a box over the page. It
 * never takes focus, shows only to visitors without an account, only once
 * per browser, and never again after "No thanks", Escape or a sign-up
 * (including Start here's email form). Confirmed by email before anything is
 * sent (app/api/newsletter).
 */
export default function NewsletterPrompt() {
  const { user, isLoading } = useAuth()
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const box = useRef<HTMLElement>(null)

  useEffect(() => {
    if (isLoading || user) return
    try {
      if (localStorage.getItem(NEWSLETTER_KEY)) return
    } catch {
      return
    }
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(NEWSLETTER_KEY)) setShow(true)
      } catch {}
    }, DELAY_MS)
    return () => clearTimeout(t)
  }, [user, isLoading])

  const close = (why: 'dismissed' | 'asked') => {
    try {
      localStorage.setItem(NEWSLETTER_KEY, why)
    } catch {}
    setShow(false)
  }

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && box.current?.contains(document.activeElement)) close('dismissed')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show])

  if (!show || user) return null

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
    if (res?.ok) {
      try {
        localStorage.setItem(NEWSLETTER_KEY, 'asked')
      } catch {}
      setNote('Thank you. Check your inbox to confirm; nothing is sent until you do.')
    } else setNote(json?.error || 'This could not be sent just now.')
  }

  return (
    <aside
      ref={box}
      aria-labelledby="newsletter-heading"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-indigo-200 bg-white p-4 shadow-lg sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-sm sm:rounded-2xl sm:border"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="newsletter-heading" className="font-semibold text-slate-900">A little help each week</h2>
        <button type="button" onClick={() => close('dismissed')} aria-label="Close" className="rounded p-1 text-slate-700 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {note ? (
        <p role="status" className="mt-2 text-sm text-slate-800">{note}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-800">
            Every week: three places and ideas to start with, and one practical tip. No spam, and you can stop anytime.
          </p>
          <form onSubmit={signUp} className="mt-3 flex flex-wrap gap-2">
            <label htmlFor="newsletter-email" className="sr-only">Your email</label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" />
            <button type="submit" disabled={sending} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {sending ? 'Sending…' : 'Sign me up'}
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-700">
            <button type="button" onClick={() => close('dismissed')} className="font-medium text-slate-800 underline underline-offset-2">No thanks</button>
            {' · '}We confirm by email first.{' '}
            <Link href="/privacy" className="font-medium text-indigo-800 underline underline-offset-2">Privacy</Link>
          </p>
        </>
      )}
    </aside>
  )
}
