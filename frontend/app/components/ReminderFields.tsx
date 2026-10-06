'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { ReminderPreferences } from '@/lib/preferences'
import { REMINDER_TIMES, browserTimeZone, timeZoneName } from '@/lib/reminderSchedule'

/**
 * The details of a daily reminder: when, and by email or text. Used by setup
 * and by Settings → Emails, so both promise exactly what the send does
 * (lib/reminderRun.ts): one a day, at the chosen time in the person's own
 * time zone (Riipen Labs, Group 11: "Users choose the timing").
 *
 * Texts are offered only when they are set up (lib/sms.ts), and go only to a
 * number its owner proved is theirs with a texted code.
 */
export default function ReminderFields({
  value,
  onChange,
}: {
  value: ReminderPreferences
  onChange: (patch: Partial<ReminderPreferences>) => void
}) {
  const [sms, setSms] = useState<{ available: boolean; phone: string | null }>({ available: false, phone: null })
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [smsNote, setSmsNote] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/sms', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return
        setSms({ available: Boolean(json.available), phone: json.phone || null })
        // A verified number means texts can go; one removed means they cannot.
        if (value.channel === 'sms' && Boolean(json.phone) !== Boolean(value.smsVerified)) onChange({ smsVerified: Boolean(json.phone) })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // Once, when shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reminders go out in the time zone of the device they were set on.
  useEffect(() => {
    if (!value.timeZone) onChange({ timeZone: browserTimeZone() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.timeZone])

  const zone = timeZoneName(value.timeZone || browserTimeZone())
  const byText = value.channel === 'sms' && sms.available
  const timeLabel = (REMINDER_TIMES.find((t) => t.id === value.time) || REMINDER_TIMES[0]).label.split(' · ')[1]

  const post = async (url: string, body: object) => {
    setBusy(true)
    setSmsNote('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      return { ok: res.ok, json }
    } catch {
      return { ok: false, json: { error: 'Something went wrong. Please try again.' } }
    } finally {
      setBusy(false)
    }
  }

  const sendCode = async () => {
    const { ok, json } = await post('/api/me/sms/start', { phone })
    if (ok) {
      setCodeSent(true)
      setSmsNote('We texted you a code. It can take a minute to arrive.')
    } else setSmsNote(json.error || 'The code could not be sent.')
  }

  const confirmCode = async () => {
    const { ok, json } = await post('/api/me/sms/check', { phone, code })
    if (ok) {
      setSms((s) => ({ ...s, phone: json.phone }))
      setCodeSent(false)
      setCode('')
      onChange({ smsVerified: true })
      setSmsNote('')
    } else setSmsNote(json.error || 'That code did not match.')
  }

  const removeNumber = async () => {
    setBusy(true)
    await fetch('/api/me/sms', { method: 'DELETE', credentials: 'include' }).catch(() => {})
    setBusy(false)
    setSms((s) => ({ ...s, phone: null }))
    onChange({ smsVerified: false })
  }

  const field = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
  const choice = (on: boolean) =>
    `px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${on ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`

  return (
    <div className="space-y-4">
      <div>
        <span id="reminder-time-label" className="block text-sm font-medium text-slate-800 mb-2">When?</span>
        <div role="group" aria-labelledby="reminder-time-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REMINDER_TIMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={value.time === t.id}
              onClick={() => onChange({ time: t.id, timeZone: browserTimeZone() })}
              className={choice(value.time === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-700">In your time zone: {zone}.</p>
      </div>

      {sms.available && (
        <div>
          <span id="reminder-channel-label" className="block text-sm font-medium text-slate-800 mb-2">How should we reach you?</span>
          <div role="group" aria-labelledby="reminder-channel-label" className="grid grid-cols-2 gap-3">
            <button type="button" aria-pressed={!byText} onClick={() => onChange({ channel: 'email' })} className={choice(!byText)}>
              Email
            </button>
            <button type="button" aria-pressed={byText} onClick={() => onChange({ channel: 'sms', smsVerified: Boolean(sms.phone) })} className={choice(byText)}>
              Text message
            </button>
          </div>
        </div>
      )}

      {byText ? (
        <div className="space-y-2">
          {sms.phone ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Texts go to {sms.phone}.
              <button type="button" onClick={removeNumber} disabled={busy} className="font-medium text-indigo-800 underline underline-offset-2">
                Use another number
              </button>
            </p>
          ) : (
            <>
              <label htmlFor="reminder-phone" className="block text-sm font-medium text-slate-800">
                Mobile number (Canada or US)
              </label>
              <div className="flex flex-wrap gap-2">
                <input id="reminder-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="416 555 0123" className={`${field} max-w-xs`} />
                <button type="button" onClick={sendCode} disabled={busy || !phone.trim()} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-300 disabled:text-slate-700">
                  {codeSent ? 'Send a new code' : 'Text me a code'}
                </button>
              </div>
              {codeSent && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Code from the text
                    <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className={`${field} mt-1 max-w-[10rem]`} />
                  </label>
                  <button type="button" onClick={confirmCode} disabled={busy || !code.trim()} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-300 disabled:text-slate-700">
                    Confirm
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-700">We only text a number after you type the code we send to it.</p>
            </>
          )}
          {smsNote && <p role="status" className="text-sm text-slate-800">{smsNote}</p>}
        </div>
      ) : (
        <div>
          <label htmlFor="reminder-contact" className="block text-sm font-medium text-slate-800 mb-1">
            Email address
          </label>
          <input
            id="reminder-contact"
            type="email"
            value={value.contact}
            onChange={(e) => onChange({ contact: e.target.value, channel: 'email' })}
            placeholder="you@example.com"
            className={field}
          />
        </div>
      )}

      <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={value.consent}
          onChange={(e) => onChange({ consent: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
        />
        <span>
          {byText
            ? 'I agree to receive one text a day with my goal reminder at this number. Message and data rates may apply. I can reply STOP to stop, or turn it off in Settings.'
            : 'I agree to receive daily goal reminders at this email address. I can turn these off anytime.'}
        </span>
      </label>

      {value.consent && !byText && !value.contact.trim() && (
        <p className="text-xs text-amber-800">Add an email address so we know where to send reminders.</p>
      )}
      {value.consent && byText && !sms.phone && (
        <p className="text-xs text-amber-800">Confirm your number with the code we text you, so we know where to send reminders.</p>
      )}

      <p className="text-xs text-slate-700">
        One {byText ? 'text' : 'email'} a day, at about {timeLabel} ({zone}). Turn it off anytime in Settings.
      </p>
    </div>
  )
}
