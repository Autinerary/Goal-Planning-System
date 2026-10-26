'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, UserPlus, X } from 'lucide-react'
import { NAME_MAX, cleanDetails, splitName } from '@/lib/signups'
import { APPLYING_FOR, CONTACT_BY, LIMITS, cleanExtras, formMessage, type ApplyingFor, type ContactBy } from '@/lib/requests'
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
  // For local services' requests (lib/requests.ts), all optional.
  const [phone, setPhone] = useState('')
  const [applyingFor, setApplyingFor] = useState<ApplyingFor>('me')
  const [theirName, setTheirName] = useState('')
  const [theirAge, setTheirAge] = useState('')
  const [needs, setNeeds] = useState('')
  const [contactBy, setContactBy] = useState<ContactBy>('email')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Filled while rendering, each time it opens, so it never shows empty first.
  const [filledFor, setFilledFor] = useState<unknown>(null)
  if (open && filledFor !== app.asking) {
    setFilledFor(app.asking)
    const start = app.details || splitName(app.suggested)
    setFirstName(start.firstName)
    setLastName(start.lastName)
    const x = app.extras
    setPhone(x.phone || '')
    setApplyingFor(x.applyingFor)
    setTheirName(x.theirName || '')
    setTheirAge(x.theirAge != null ? String(x.theirAge) : '')
    setNeeds(x.needs || '')
    setContactBy(x.contactBy)
    setError('')
  }
  if (!open) return null

  const services = (app.asking?.services || []).map((s) => app.serviceInfo(s.service)).filter((r): r is NonNullable<typeof r> => !!r)
  const thenSign = services.length > 0
  const requests = services.filter((r) => r.kind === 'request')
  // Only local services: nothing is signed up for, no password; the request goes and they reply.
  const onlyRequests = thenSign && requests.length === services.length
  const extrasRaw = { phone, applyingFor, theirName, theirAge, needs, contactBy }
  const checkedExtras = cleanExtras(extrasRaw)
  const save = async () => {
    const checked = cleanDetails({ firstName, lastName })
    if (!checked.ok) { setError(checked.error); return }
    if (!checkedExtras.ok) { setError(checkedExtras.error); return }
    setBusy(true)
    const r = await fetch('/api/me/signups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ details: { ...checked.details, extras: checkedExtras.extras } }),
    }).catch(() => null)
    const j = await r?.json().catch(() => null)
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'That didn’t save. Try again.'); return }
    app.detailsSaved(j.details, j.extras)
  }
  const chip = (on: boolean) => `cursor-pointer rounded-full border px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-indigo-500 ${on ? 'border-indigo-700 bg-indigo-50 font-semibold text-indigo-900' : 'border-slate-300 text-slate-900'}`
  // What a local service gets, word for word.
  const preview = requests.length && checkedExtras.ok
    ? formMessage({ firstName: firstName.trim() || 'Your', lastName: lastName.trim() || 'name', email: app.email || 'your email', extras: checkedExtras.extras, serviceName: requests[0].name })
    : null
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
            {onlyRequests ? 'Sending your request, the first time' : 'Signing you up, the first time'}
          </h2>
          <button type="button" onClick={app.closeDetails} aria-label="Close" className="rounded-lg p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {onlyRequests ? (
          <p className="mt-2 text-sm text-slate-800">
            When you press <strong>Send my request</strong>, Autinerary sends the service your request to start: by email, or through
            the form on their website. It uses your name and <strong>{app.email || 'your email'}</strong>, and they reply to you. You
            check this once: after that it’s one click.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-800">
            When you press <strong>Sign me up</strong>, Autinerary fills in that service’s own sign-up form for you, so you don’t have to.
            It uses your name and <strong>{app.email || 'your email'}</strong>, and makes a new, strong password for the account, which
            you see once to save. You check this once: after that it’s one click.
          </p>
        )}
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
        <details className="mt-4 rounded-xl border border-slate-200 p-3" open={requests.length > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">For local services (clinics, programs): what your request says, all optional</summary>
          <fieldset className="mt-2">
            <legend className="text-sm font-semibold text-slate-900">Who is it for?</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {APPLYING_FOR.map((o) => (
                <label key={o.id} className={chip(applyingFor === o.id)}>
                  <input type="radio" name="applying-for" checked={applyingFor === o.id} onChange={() => setApplyingFor(o.id)} className="sr-only" /> {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          {applyingFor !== 'me' && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="col-span-2 block text-sm font-semibold text-slate-900">
                Their first name <span className="font-normal">(optional)</span>
                <input value={theirName} onChange={(e) => setTheirName(e.target.value)} maxLength={LIMITS.name} className={field} />
              </label>
              <label className="block text-sm font-semibold text-slate-900">
                Age <span className="font-normal">(optional)</span>
                <input value={theirAge} onChange={(e) => setTheirAge(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" className={field} />
              </label>
            </div>
          )}
          <label className="mt-2 block text-sm font-semibold text-slate-900">
            What are you looking for? <span className="font-normal">(optional)</span>
            <textarea value={needs} onChange={(e) => setNeeds(e.target.value)} maxLength={LIMITS.needs} rows={2} placeholder="For example: an assessment, after-school support, or help finding work" className={field} />
          </label>
          <label className="mt-2 block text-sm font-semibold text-slate-900">
            Phone <span className="font-normal">(optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={LIMITS.phone} type="tel" autoComplete="tel" className={field} />
          </label>
          <fieldset className="mt-2">
            <legend className="text-sm font-semibold text-slate-900">How should they contact you?</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {CONTACT_BY.map((o) => (
                <label key={o.id} className={chip(contactBy === o.id)}>
                  <input type="radio" name="contact-by" checked={contactBy === o.id} onChange={() => setContactBy(o.id)} className="sr-only" /> {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          {preview && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900">What {requests[0].name} gets</p>
              <pre tabIndex={0} aria-label="What the service gets" className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" data-request-preview>{preview}</pre>
            </div>
          )}
        </details>
        {services.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">{requests.length === services.length ? 'Your request goes to:' : 'Signing up means agreeing to each service’s terms:'}</p>
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
            {busy ? 'Saving…' : !thenSign ? 'Save' : onlyRequests ? (services.length > 1 ? `Save and send ${services.length} requests` : 'Save and send my request') : services.length > 1 ? `Save and sign me up for ${services.length}` : 'Save and sign me up'}
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
