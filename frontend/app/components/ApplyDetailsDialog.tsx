'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import {
  APPLYING_FOR, CONTACT_BY, LIMITS, applicationEmail, cleanDetails, type ApplicationDetails, type ApplyingFor, type ContactBy,
} from '@/lib/applications'
import type { Applications } from '@/lib/useApplications'

/**
 * "Check once, then one click" (the choice, October 2026): what Apply sends
 * to a service, checked by the person before the first one goes, with the
 * exact email the service gets. Saving is the yes to sending these details
 * whenever they press Apply; "Forget these" takes it back.
 */
export default function ApplyDetailsDialog({ app }: { app: Applications }) {
  const open = Boolean(app.asking)
  const dialog = useRef<HTMLDialogElement>(null)
  const start = app.details || app.defaults
  const [fullName, setFullName] = useState('')
  const [applyingFor, setApplyingFor] = useState<ApplyingFor>('me')
  const [theirName, setTheirName] = useState('')
  const [theirAge, setTheirAge] = useState('')
  const [needs, setNeeds] = useState('')
  const [phone, setPhone] = useState('')
  const [contactBy, setContactBy] = useState<ContactBy>('email')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Fill the form each time it opens (their saved details, or a first guess),
  // while rendering, so it never shows empty for a moment first.
  const [filledFor, setFilledFor] = useState<unknown>(null)
  if (open && filledFor !== app.asking) {
    setFilledFor(app.asking)
    setFullName(start?.fullName || '')
    setApplyingFor(start?.applyingFor || 'me')
    setTheirName(start?.theirName || '')
    setTheirAge(start?.theirAge != null ? String(start.theirAge) : '')
    setNeeds(start?.needs || '')
    setPhone(start?.phone || '')
    setContactBy(start?.contactBy || 'email')
    setError('')
  }

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  const raw = { fullName, applyingFor, theirName, theirAge, needs, phone, contactBy }
  const checked = cleanDetails(raw)
  const serviceName = app.asking?.serviceName || ''
  const preview = useMemo(() => {
    const details: ApplicationDetails = checked.ok ? checked.details : { fullName: fullName.trim() || 'Your name', phone: null, applyingFor, theirName: null, theirAge: null, needs: needs.trim() || null, contactBy: 'email' }
    return applicationEmail({ details, replyTo: app.email || 'your email', serviceName: serviceName || '(the service’s name)', claimUrl: '(a link for the service to update its listing)' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(raw), app.email, serviceName])

  const count = app.asking?.ids.length || 0
  const thenSend = app.asking?.then !== 'none' && count > 0
  const saveLabel = !thenSend ? 'Save' : count > 1 ? `Save and send to ${count} services` : `Save and apply`

  const save = async () => {
    if (busy) return
    if (!checked.ok) { setError(checked.error); return }
    setBusy(true)
    setError('')
    const r = await fetch('/api/me/applications/details', {
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

  const forget = async () => {
    setBusy(true)
    const r = await fetch('/api/me/applications/details', { method: 'DELETE', credentials: 'include' }).catch(() => null)
    setBusy(false)
    if (!r?.ok) { setError('That didn’t work. Try again.'); return }
    app.detailsSaved(null)
    app.setNote('Forgotten. Apply will ask again before it sends anything.')
  }

  if (!open) return null
  const field = 'mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const chip = (on: boolean) => `cursor-pointer rounded-full border px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-indigo-500 ${on ? 'border-indigo-700 bg-indigo-50 font-semibold text-indigo-900' : 'border-slate-300 text-slate-900'}`

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault()
        app.closeDetails()
      }}
      aria-labelledby="apply-details-title"
      className="w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-apply-details
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="apply-details-title" className="text-xl font-bold text-slate-900">
            What we send when you press Apply
          </h2>
          <button type="button" onClick={app.closeDetails} aria-label="Close" className="rounded-lg p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-800">
          Autinerary emails this to the service for you, so you never have to fill in their form or visit their website. Their reply
          goes to <strong>{app.email || 'your email'}</strong>, and you get a copy. You check this once: after that, Apply is one click.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-900">
              Your name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={LIMITS.name} required autoComplete="name" className={field} />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">Who is it for?</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {APPLYING_FOR.map((o) => (
                  <label key={o.id} className={chip(applyingFor === o.id)}>
                    <input type="radio" name="applying-for" value={o.id} checked={applyingFor === o.id} onChange={() => setApplyingFor(o.id)} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {applyingFor !== 'me' && (
              <div className="grid grid-cols-3 gap-2">
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

            <label className="block text-sm font-semibold text-slate-900">
              What are you looking for? <span className="font-normal">(optional)</span>
              <textarea
                value={needs}
                onChange={(e) => setNeeds(e.target.value)}
                maxLength={LIMITS.needs}
                rows={3}
                placeholder="For example: an assessment, after-school support, or help finding work"
                className={field}
              />
              <span className="mt-0.5 block text-xs font-normal text-slate-700">Only what you write here is shared: nothing from your plan or profile.</span>
            </label>

            <label className="block text-sm font-semibold text-slate-900">
              Phone <span className="font-normal">(optional)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={LIMITS.phone} type="tel" autoComplete="tel" className={field} />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">How should they contact you?</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {CONTACT_BY.map((o) => (
                  <label key={o.id} className={chip(contactBy === o.id)}>
                    <input type="radio" name="contact-by" value={o.id} checked={contactBy === o.id} onChange={() => setContactBy(o.id)} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <section aria-labelledby="apply-preview-title" className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 id="apply-preview-title" className="text-sm font-bold uppercase tracking-wide text-slate-900">
              The email they get
            </h3>
            <p className="mt-1 text-xs text-slate-800">
              <span className="font-semibold">Subject:</span> {preview.subject}
            </p>
            {/* It scrolls, so it takes the focus: keyboards can scroll it too. */}
            <pre
              tabIndex={0}
              aria-labelledby="apply-preview-title"
              className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded font-sans text-xs leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              data-apply-preview
            >
              {preview.text}
            </pre>
          </section>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            <Send className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : saveLabel}
          </button>
          <button type="button" onClick={app.closeDetails} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-900 hover:bg-slate-50">
            Cancel
          </button>
          {app.details && app.asking?.then === 'none' && (
            <button type="button" onClick={forget} disabled={busy} className="ml-auto text-sm font-semibold text-slate-800 underline underline-offset-2 hover:text-red-800">
              Forget these
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-700">
          Saving means: when you press Apply, send these details to that service. Nothing is sent to anyone you haven’t pressed Apply for.
        </p>
      </form>
    </dialog>
  )
}
