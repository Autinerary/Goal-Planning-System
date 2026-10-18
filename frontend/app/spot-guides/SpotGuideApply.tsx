'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'
import { FEEDBACK_EMAIL } from '@/lib/feedback'

const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('I would like to be a Spot Guide')}&body=${encodeURIComponent('Hello,\n\nThe area I know: \nWhy I would like to help: \n\nThank you,')}`

/** Applying to be a Spot Guide: signed in, a form; otherwise sign in or email. */
export default function SpotGuideApply() {
  const { user } = useAuth()
  const [application, setApplication] = useState<{ area: string; status: string } | null>(null)
  const [area, setArea] = useState('')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [emailInstead, setEmailInstead] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/spot-guides/apply', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.application) setApplication(d.application)
        if (d && d.open === false) setEmailInstead(true)
      })
      .catch(() => {})
  }, [user])

  if (!user) {
    return (
      <p className="text-slate-800">
        <Link href="/signup" className="font-medium text-indigo-800 underline underline-offset-2">
          Make a free account
        </Link>{' '}
        or{' '}
        <Link href="/login?returnTo=/spot-guides" className="font-medium text-indigo-800 underline underline-offset-2">
          sign in
        </Link>{' '}
        to apply, or{' '}
        <a href={mailto} className="font-medium text-indigo-800 underline underline-offset-2">
          email us
        </a>
        .
      </p>
    )
  }
  if (application) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 p-4 text-slate-900">
        {application.status === 'approved'
          ? 'You are a Spot Guide. Thank you! Your review page is Spot Guides in ResourceHub.'
          : `Thanks: we have your application (${application.area}). We will email you.`}
      </p>
    )
  }
  if (emailInstead) {
    return (
      <p className="text-slate-800">
        <a href={mailto} className="font-medium text-indigo-800 underline underline-offset-2">
          Email us to apply
        </a>
        : say which area you know and why you would like to help.
      </p>
    )
  }
  const apply = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNote('')
    const res = await fetch('/api/spot-guides/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area, why }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (res?.ok) setApplication({ area, status: 'pending' })
    else if (d?.email) setEmailInstead(true)
    else setNote(d?.error || 'Could not send that.')
  }
  return (
    <form onSubmit={apply} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-900">The area you know (a city, a region, or a kind of service)</span>
        <input value={area} onChange={(e) => setArea(e.target.value)} required maxLength={200} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-900">
          Why you would like to help <span className="font-normal text-slate-700">(optional)</span>
        </span>
        <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      {note && (
        <p role="alert" className="text-sm text-red-700">
          {note}
        </p>
      )}
      <button type="submit" disabled={busy || !area.trim()} className="rounded-lg bg-amber-800 px-5 py-2.5 font-semibold text-white hover:bg-amber-900 disabled:opacity-60">
        {busy ? 'Sending…' : 'Apply to be a Spot Guide'}
      </button>
    </form>
  )
}
