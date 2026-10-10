'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Change the address you sign in with (Riipen Labs, Group 34, slide 21).
 * Supabase sends a link to the new address (and, with secure email change,
 * one to the old address too); the address changes once the links are
 * opened. Until then you sign in with the old one.
 */
export default function ChangeEmail({ current, pending }: { current: string; pending: string | null }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<null | 'saving' | { ok: boolean; text: string }>(null)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) field.current?.focus() }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) { setState({ ok: false, text: 'Please type a whole email address, like name@example.com.' }); return }
    if (next === current.toLowerCase()) { setState({ ok: false, text: 'That is the address you already use.' }); return }
    setState('saving')
    const { error } = await createClient().auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/profile#account')}` }
    )
    if (error) {
      const message = (error.message || '').toLowerCase()
      setState({
        ok: false,
        text: message.includes('already') || message.includes('exists')
          ? 'That address already has an account.'
          : message.includes('rate') || message.includes('too many')
            ? 'Too many emails were sent just now. Please try again in an hour.'
            : message.includes('reauthentic')
              ? 'For your security, sign out and sign in again, then change your address here.'
              : 'Your address could not be changed. Please try again.',
      })
      return
    }
    setEmail('')
    setOpen(false)
    setState({ ok: true, text: `We sent a link to ${next}. Open it to finish the change. Your old address may get a link too: open both. Until then, sign in with ${current}.` })
  }

  return (
    <div className="mt-2">
      {pending && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Waiting for you to confirm <strong>{pending}</strong>. Open the link we emailed. Until then, sign in with {current}.
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setState(null) }}
          className="text-sm font-medium text-indigo-800 underline underline-offset-2"
        >
          Change email address
        </button>
      ) : (
        <form noValidate onSubmit={submit} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="change-email" className="block text-sm font-semibold text-slate-800">New email address</label>
          <p id="change-email-help" className="mb-2 text-xs text-slate-600">
            You will sign in with this address. Reminders and other emails go to the addresses chosen in Settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={field}
              id="change-email"
              type="email"
              autoComplete="email"
              value={email}
              aria-describedby="change-email-help"
              onChange={(e) => { setEmail(e.target.value); setState(null) }}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-purple-500 focus:outline-none"
            />
            <button type="submit" disabled={state === 'saving'} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
              {state === 'saving' ? 'Sending…' : 'Send link'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setState(null) }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}
      <p role="status" className={`mt-2 text-sm ${state && state !== 'saving' && state.ok ? 'text-emerald-800' : 'text-red-700'}`}>
        {state && state !== 'saving' ? state.text : ''}
      </p>
    </div>
  )
}
