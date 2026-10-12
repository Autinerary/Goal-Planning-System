'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/usePreferences'
import { REMINDER_TIMES, browserTimeZone, firstWeeksEnd, timeZoneName } from '@/lib/reminderSchedule'

/**
 * Gentle reminders for the first two weeks (Riipen Labs, Group 29: "send
 * gentle in-app and email reminders during the first 7 to 14 days to help
 * users get their first easy win"). The daily reminder email, at a time the
 * person picks, with an end date: it stops by itself two weeks after the
 * account was made (lib/reminderSchedule.ts, reminderDue). Off unless turned
 * on here, with the address it goes to said beside the switch. After the
 * first two weeks it is the ordinary daily reminder, with no end.
 */
function readableDate(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00`)
  return Number.isNaN(d.getTime()) ? isoDay : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export default function FirstWeeksReminder({ onSaved }: { onSaved?: () => void }) {
  const { user, supabaseUser } = useAuth()
  const { prefs, update } = usePreferences()
  const [time, setTime] = useState(prefs.reminders?.time || '09:00')
  const [agree, setAgree] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const zone = prefs.reminders?.timeZone || browserTimeZone()
  const created = supabaseUser?.created_at || null
  const inFirstWeeks = !created || Date.now() - new Date(created).getTime() < 14 * 86_400_000
  const until = inFirstWeeks ? firstWeeksEnd(created, zone) : undefined
  const email = user?.email || ''
  const on = Boolean(prefs.reminders?.enabled)

  if (on) {
    const t = REMINDER_TIMES.find((x) => x.id === prefs.reminders?.time)?.label || prefs.reminders?.time
    return (
      <p className="text-sm text-slate-800">
        On: an email {t ? `at ${t.split('·').pop()?.trim()}` : 'each day'} to {prefs.reminders?.contact || email}
        {prefs.reminders?.until ? `, until ${readableDate(prefs.reminders.until)}` : ''}.{' '}
        <Link href="/profile/settings#emails" className="font-medium text-indigo-800 underline underline-offset-2">Change or turn off in Settings</Link>
      </p>
    )
  }

  async function save() {
    if (!agree || !email) return
    setState('saving')
    const ok = await update({
      reminders: { enabled: true, channel: 'email', contact: email, time, consent: true, timeZone: zone, ...(until ? { until } : {}) },
    })
    setState(ok ? 'saved' : 'error')
    if (ok) onSaved?.()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="first-weeks-time" className="mb-1 block text-xs font-semibold text-slate-800">When</label>
          <select id="first-weeks-time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
            {REMINDER_TIMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <p className="pb-2 text-xs text-slate-700">{timeZoneName(zone)}</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-400" />
        <span>
          Email me at {email || 'my account address'} once a day about my next step
          {until ? `, until ${readableDate(until)}` : ''}. I can turn it off at any time.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!agree || !email || state === 'saving'}
          className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {state === 'saving' ? 'Saving…' : 'Turn on'}
        </button>
        {state === 'error' && <p role="alert" className="text-sm text-red-700">That could not be saved. Please try again.</p>}
      </div>
    </div>
  )
}
