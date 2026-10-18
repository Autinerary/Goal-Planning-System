'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/context/AuthContext'
import { TERMS_VERSION } from '@/lib/legal'

/**
 * Once, for people who made their account before the Terms and Conditions
 * (or before a new version): say there are terms, link to them, and record
 * "OK" (terms_acceptances, STEP 79). New accounts accept at sign-up, so they
 * never see it. Not on the terms page itself, or the sign-in pages.
 */
export default function TermsNotice() {
  const { user } = useAuth()
  const pathname = usePathname() || '/'
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    let seen = false
    try {
      seen = localStorage.getItem('autinerary_terms_ok') === TERMS_VERSION
    } catch {}
    if (seen) return
    fetch('/api/me/terms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setShow(Boolean(d && d.accepted === false)))
      .catch(() => {})
  }, [user])

  if (!show || !user || ['/terms', '/login', '/signup', '/auth/age'].includes(pathname)) return null
  const ok = async () => {
    setBusy(true)
    const res = await fetch('/api/me/terms', { method: 'POST' }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      try {
        localStorage.setItem('autinerary_terms_ok', TERMS_VERSION)
      } catch {}
      setShow(false)
    }
  }
  return (
    <aside aria-labelledby="terms-notice-heading" className="border-b border-indigo-200 bg-indigo-50 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-900">
          <span id="terms-notice-heading" className="font-semibold">
            Autinerary now has Terms and Conditions.
          </span>{' '}
          They cover the app and ResourceHub, and say what Autinerary is and is not, and the rules for ratings and posts.{' '}
          <Link href="/terms" className="font-medium text-indigo-800 underline underline-offset-2">
            Read them
          </Link>
        </p>
        <button
          type="button"
          onClick={ok}
          disabled={busy}
          className="shrink-0 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
        >
          OK
        </button>
      </div>
    </aside>
  )
}
