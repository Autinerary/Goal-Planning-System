'use client'

import { useEffect, useState } from 'react'
import BackButton from '../../components/BackButton'

/**
 * The team's one-time welcome email for people who finished setup before it
 * existed (app/api/admin/welcome). Shows how many, and sends only after a
 * second, explicit confirmation. Team only.
 */
export default function WelcomeEmailsPage() {
  const [info, setInfo] = useState<{ count?: number; canSend?: boolean; error?: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/admin/welcome', { cache: 'no-store', credentials: 'include' })
      .then(async (r) => setInfo(await r.json()))
      .catch(() => setInfo({ error: 'Could not load.' }))
  }, [])

  const send = async () => {
    setBusy(true)
    const r = await fetch('/api/admin/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ confirm: 'send-welcome' }) }).catch(() => null)
    const j = await r?.json().catch(() => null)
    setBusy(false)
    setConfirming(false)
    setResult(r?.ok ? `Sent ${j.sent}${j.failed ? `; ${j.failed} could not be sent` : ''}.` : j?.error || 'That didn’t work.')
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-4">
        <BackButton fallback="/path" />
        <h1 className="text-2xl font-bold text-slate-900">Welcome emails</h1>
        {!info ? (
          <p className="text-slate-700">Loading…</p>
        ) : info.error ? (
          <p className="text-red-800">{info.error}</p>
        ) : (
          <>
            <p className="text-slate-800">
              {info.count} {info.count === 1 ? 'person' : 'people'} finished setup before the welcome email existed and never got one. Team and test accounts are left out.
            </p>
            {!info.canSend && <p className="text-amber-900">Email isn&apos;t set up on this server (RESEND_API_KEY), so nothing can be sent from here.</p>}
            {info.canSend && !!info.count && !confirming && (
              <button type="button" onClick={() => setConfirming(true)} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
                Send the welcome email to {info.count} {info.count === 1 ? 'person' : 'people'}…
              </button>
            )}
            {confirming && (
              <div role="alertdialog" aria-labelledby="confirm-heading" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p id="confirm-heading" className="font-semibold text-slate-900">Send it to {info.count} real people now?</p>
                <p className="mt-1 text-sm text-slate-800">Each gets it once. This can&apos;t be undone.</p>
                <div className="mt-3 flex gap-3">
                  <button type="button" disabled={busy} onClick={send} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
                    {busy ? 'Sending…' : 'Yes, send'}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-800">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {result && <p role="status" className="text-slate-900">{result}</p>}
          </>
        )}
      </div>
    </main>
  )
}
