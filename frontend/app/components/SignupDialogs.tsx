'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, UserPlus, X } from 'lucide-react'
import { NAME_MAX, cleanDetails, splitName } from '@/lib/signups'
import type { Signups } from '@/lib/useSignups'

/**
 * One-click sign-up's two dialogs (lib/signups.ts):
 *   - "Check once": the name a service's form gets (and the account's email,
 *     which can't be changed here), what happens, and each service's terms.
 *     Saving is the yes; from then on Sign me up is one click.
 *   - The new password, shown once to save. Autinerary never keeps it.
 */
export default function SignupDialogs({ app }: { app: Signups }) {
  return (
    <>
      <DetailsDialog app={app} />
      <PasswordDialog app={app} />
      {/* A partner made the account and gave a way in. */}
      {app.loginLink && (
        <p className="mt-1 text-sm">
          <a href={app.loginLink.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-800 underline underline-offset-2">
            Log in to {app.loginLink.name}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
    </>
  )
}

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    if (!open && ref.current?.open) ref.current.close()
  }, [open])
  return ref
}

function DetailsDialog({ app }: { app: Signups }) {
  const open = Boolean(app.asking)
  const ref = useModal(open)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Filled while rendering, each time it opens, so it never shows empty first.
  const [filledFor, setFilledFor] = useState<unknown>(null)
  if (open && filledFor !== app.asking) {
    setFilledFor(app.asking)
    const start = app.details || splitName(app.suggested)
    setFirstName(start.firstName)
    setLastName(start.lastName)
    setError('')
  }
  if (!open) return null

  const services = (app.asking?.services || []).map((s) => app.serviceInfo(s.service)).filter((r): r is NonNullable<typeof r> => !!r)
  const thenSign = services.length > 0
  const save = async () => {
    const checked = cleanDetails({ firstName, lastName })
    if (!checked.ok) { setError(checked.error); return }
    setBusy(true)
    const r = await fetch('/api/me/signups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ details: checked.details }),
    }).catch(() => null)
    const j = await r?.json().catch(() => null)
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'That didn’t save. Try again.'); return }
    app.detailsSaved(j.details)
  }
  const field = 'mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        app.closeDetails()
      }}
      aria-labelledby="signup-details-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-signup-details
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="signup-details-title" className="text-xl font-bold text-slate-900">
            Signing you up, the first time
          </h2>
          <button type="button" onClick={app.closeDetails} aria-label="Close" className="rounded-lg p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-800">
          When you press <strong>Sign me up</strong>, Autinerary fills in that service’s own sign-up form for you, so you don’t have to.
          It uses your name and <strong>{app.email || 'your email'}</strong>, and makes a new, strong password for the account, which
          you see once to save. You check this once: after that it’s one click.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-900">
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={NAME_MAX} required autoComplete="given-name" className={field} />
          </label>
          <label className="block text-sm font-semibold text-slate-900">
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={NAME_MAX} required autoComplete="family-name" className={field} />
          </label>
        </div>
        {services.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">Signing up means agreeing to each service’s terms:</p>
            <ul className="mt-1 space-y-1">
              {services.map((r) => (
                <li key={r.key}>
                  {r.name}
                  {r.terms || r.privacy ? ': ' : ''}
                  {r.terms && (
                    <a href={r.terms} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-800 underline underline-offset-2">
                      terms<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  {r.terms && r.privacy ? ', ' : ''}
                  {r.privacy && (
                    <a href={r.privacy} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-800 underline underline-offset-2">
                      privacy<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  {r.note ? <span className="block text-xs text-slate-700">{r.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Saving…' : !thenSign ? 'Save' : services.length > 1 ? `Save and sign me up for ${services.length}` : 'Save and sign me up'}
          </button>
          <button type="button" onClick={app.closeDetails} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-900 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}

function PasswordDialog({ app }: { app: Signups }) {
  const open = Boolean(app.password)
  const ref = useModal(open)
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [app.password?.service])
  if (!open || !app.password) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(app.password!.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <dialog
      ref={ref}
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="signup-password-title"
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-signup-password
    >
      <div className="p-6">
        <h2 id="signup-password-title" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <KeyRound className="h-5 w-5 text-indigo-700" aria-hidden="true" /> Your new {app.password.name} password
        </h2>
        <p className="mt-2 text-sm text-slate-800">
          Save it in your password manager now. Autinerary doesn’t keep it, so this is the only time it shows. You log in to{' '}
          {app.password.name} with {app.email || 'your email'} and this password.
        </p>
        <p className="mt-3 select-all break-all rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-lg text-slate-900" data-signup-password-value>
          {app.password.password}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-50">
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={app.passwordSeen} className="rounded-xl bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800">
            I’ve saved it
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm text-slate-800">
          {copied ? 'Copied. Paste it into your password manager.' : ''}
        </p>
      </div>
    </dialog>
  )
}
