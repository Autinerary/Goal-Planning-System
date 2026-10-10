'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { savePreferences } from '@/lib/preferences'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * Pause or delete your account (Riipen Labs, Group 34, slide 21).
 *
 * Pausing is a break with nothing lost: no reminders, check-ins, weekly picks
 * or notifications, and nobody finds you in search, until you resume
 * (app/api/me/pause). Deleting removes the account and everything linked to
 * it straight away (app/api/me/account, STEP 65); it asks you to type DELETE
 * first, and points to the back-up in Settings.
 */

type DeleteStatus = null | { deletable: true } | { deletable: false; reason: 'not_ready' | 'staff' | 'error' }

export default function AccountControls({ onDiscoverable }: {
  /** Pausing hides you from search and resuming restores it; tell the page. */
  onDiscoverable: (discoverable: boolean) => void
}) {
  const { prefs } = usePreferences()
  const paused = prefs.paused && prefs.paused.since ? prefs.paused : null

  const [pauseBusy, setPauseBusy] = useState(false)
  const [pauseMsg, setPauseMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const setPaused = async (next: boolean) => {
    setPauseBusy(true)
    setPauseMsg(null)
    try {
      const res = await fetch('/api/me/pause', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: next }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'That could not be saved. Please try again.')
      savePreferences({ paused: body.paused })
      onDiscoverable(Boolean(body.discoverable))
      setPauseMsg({ ok: true, text: next ? 'Your account is paused.' : 'Welcome back. Your account is on again.' })
    } catch (e: any) {
      setPauseMsg({ ok: false, text: e.message })
    } finally {
      setPauseBusy(false)
    }
  }

  // ── Delete ──
  const [status, setStatus] = useState<DeleteStatus>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/account', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { deletable: false, reason: 'error' }))
      .then((json) => { if (!cancelled) setStatus(json) })
      .catch(() => { if (!cancelled) setStatus({ deletable: false, reason: 'error' }) })
    return () => { cancelled = true }
  }, [])

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (typed.trim() !== 'DELETE') { setDeleteError('Type DELETE, in capital letters, to confirm.'); return }
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/me/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Your account could not be deleted. Please try again, or email us.')
      // Nothing of the account stays on this device either.
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      window.location.href = '/login?deleted=1'
    } catch (err: any) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-indigo-800 underline underline-offset-2">{CONTACT_EMAIL}</a>

  return (
    <>
      <section id="pause" aria-labelledby="pause-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="pause-heading" className="text-lg font-bold text-slate-900">Take a break</h2>
        {paused ? (
          <>
            <p className="mt-2 text-sm text-slate-800">
              Your account has been paused since {new Date(paused.since).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
              We send you nothing and nobody can find you in search. Everything else is as you left it.
            </p>
            <button
              type="button"
              onClick={() => setPaused(false)}
              disabled={pauseBusy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {pauseBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Resume my account
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-800">
              Pausing turns off reminders, check-ins, weekly picks and notifications, and hides you from search. Your plan,
              your people and everything else stay as they are. Come back any time and press Resume.
            </p>
            <button
              type="button"
              onClick={() => setPaused(true)}
              disabled={pauseBusy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              {pauseBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Pause my account
            </button>
          </>
        )}
        <p role="status" className={`mt-2 text-sm ${pauseMsg?.ok ? 'font-medium text-emerald-800' : 'text-red-700'}`}>{pauseMsg?.text || ''}</p>
      </section>

      <section id="delete" aria-labelledby="delete-heading" className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 id="delete-heading" className="text-lg font-bold text-slate-900">Delete your account</h2>
        <p className="mt-2 text-sm text-slate-800">
          This deletes your account and everything linked to it, straight away: your plan, calendar, journal, people and
          photos, and what you posted in Tidbits and ResourceHub. Resources you suggested stay in ResourceHub without your
          name. It can’t be undone. If you might want your plan later,{' '}
          <Link href="/profile/settings" className="font-medium text-indigo-800 underline underline-offset-2">back up your data in Settings</Link> first.
        </p>

        {status === null && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…</p>
        )}
        {status && !status.deletable && (
          <p className="mt-3 text-sm text-slate-800">
            {status.reason === 'staff'
              ? <>Your account has team access, so it can’t be deleted here. Email {mail} and we will close it.</>
              : <>To delete your account, email {mail} from your sign-in address. We will delete it within 30 days.</>}
          </p>
        )}
        {status?.deletable && !open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setDeleteError('') }}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
          >
            Delete my account…
          </button>
        )}
        {status?.deletable && open && (
          <form onSubmit={deleteAccount} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <label htmlFor="delete-confirm" className="block text-sm font-semibold text-red-900">Type DELETE to confirm</label>
            <input
              id="delete-confirm"
              value={typed}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => { setTyped(e.target.value); setDeleteError('') }}
              aria-describedby="delete-confirm-error"
              className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 focus:border-red-600 focus:outline-none sm:w-60"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={deleting || typed.trim() !== 'DELETE'}
                className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {deleting ? 'Deleting…' : 'Delete my account for good'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setTyped(''); setDeleteError('') }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Keep my account
              </button>
            </div>
            <p id="delete-confirm-error" role="alert" className="mt-2 text-sm text-red-800">{deleteError}</p>
          </form>
        )}
      </section>
    </>
  )
}
