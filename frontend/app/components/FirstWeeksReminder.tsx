'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/usePreferences'
import { REMINDER_TIMES, browserTimeZone, firstWeeksEnd, timeZoneName } from '@/lib/reminderSchedule'
import { FIRST_WEEKS_CONSENT, firstWeeksStillAhead } from '@/lib/firstWeeks'

/**
 * Reminders for the first two weeks, two ways, both off unless chosen here:
 *
 *  - Three emails, on the day after joining, after a week and after two
 *    weeks, each about what the person did and one next thing (Riipen Labs,
 *    Group 15: "Milestone-based emails, not a newsletter";
 *    lib/firstWeeks.ts). The first choice.
 *  - The daily reminder email, at a time the person picks, with an end date:
 *    it stops by itself two weeks after the account was made (Group 29:
 *    "gentle in-app and email reminders during the first 7 to 14 days";
 *    lib/reminderSchedule.ts, reminderDue). After the first two weeks it is
 *    the ordinary daily reminder, with no end.
 *
 * The address they go to is said beside the switch, and what was agreed to is
 * kept with the choice.
 */
function readableDate(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00`)
  return Number.isNaN(d.getTime()) ? isoDay : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export default function FirstWeeksReminder({ onSaved }: { onSaved?: () => void }) {
  const { user, supabaseUser } = useAuth()
  const { prefs, update } = usePreferences()
  const created = supabaseUser?.created_at || null
  const zone = prefs.reminders?.timeZone || prefs.firstWeeks?.timeZone || browserTimeZone()
  const threeAhead = firstWeeksStillAhead(created, zone, new Date())
  const [kind, setKind] = useState<'three' | 'daily'>(threeAhead ? 'three' : 'daily')
  const [time, setTime] = useState(prefs.reminders?.time || '09:00')
  const [agree, setAgree] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const inFirstWeeks = !created || Date.now() - new Date(created).getTime() < 14 * 86_400_000
  const until = inFirstWeeks ? firstWeeksEnd(created, zone) : undefined
  const email = user?.email || ''
  const threeOn = Boolean(prefs.firstWeeks?.enabled)
  const dailyOn = Boolean(prefs.reminders?.enabled)

  if (threeOn || dailyOn) {
    const t = REMINDER_TIMES.find((x) => x.id === prefs.reminders?.time)?.label || prefs.reminders?.time
    return (
      <div className="space-y-1 text-sm text-slate-800">
        {threeOn && <p>On: three emails about your first two weeks, to {email}.</p>}
        {dailyOn && (
          <p>
            On: an email {t ? `at ${t.split('·').pop()?.trim()}` : 'each day'} to {prefs.reminders?.contact || email}
            {prefs.reminders?.until ? `, until ${readableDate(prefs.reminders.until)}` : ''}.
          </p>
        )}
        <p>
          <Link href="/profile/settings#emails" className="font-medium text-indigo-800 underline underline-offset-2">Change or turn off in Settings</Link>
        </p>
      </div>
    )
  }

  async function save() {
    if (!agree || !email) return
    setState('saving')
    const ok = kind === 'three'
      ? await update({
        firstWeeks: {
          ...(prefs.firstWeeks || {}),
          enabled: true,
          consent: FIRST_WEEKS_CONSENT,
          startedAt: new Date().toISOString(),
          timeZone: zone,
          stoppedAt: null,
        },
      })
      : await update({
        reminders: { enabled: true, channel: 'email', contact: email, time, consent: true, timeZone: zone, ...(until ? { until } : {}) },
      })
    setState(ok ? 'saved' : 'error')
    if (ok) onSaved?.()
  }

  const option = (on: boolean) =>
    `flex cursor-pointer items-start gap-2 rounded-lg border-2 px-3 py-2 text-sm ${on ? 'border-cyan-600 bg-cyan-50 text-cyan-950' : 'border-slate-200 text-slate-800 hover:border-slate-300'}`

  return (
    <div className="space-y-3">
      {threeAhead && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-slate-800">Which?</legend>
          <label className={option(kind === 'three')}>
            <input type="radio" name="first-weeks-kind" checked={kind === 'three'} onChange={() => { setKind('three'); setAgree(false) }} className="mt-1" />
            <span>
              <span className="block font-semibold">Three emails, about what you did</span>
              <span className="block text-xs text-slate-700">The day after you joined, after a week and after two weeks. Each says what you have done and one next thing.</span>
            </span>
          </label>
          <label className={option(kind === 'daily')}>
            <input type="radio" name="first-weeks-kind" checked={kind === 'daily'} onChange={() => { setKind('daily'); setAgree(false) }} className="mt-1" />
            <span>
              <span className="block font-semibold">One email a day, about your next step</span>
              <span className="block text-xs text-slate-700">At a time you choose{until ? `, until ${readableDate(until)}` : ''}.</span>
            </span>
          </label>
        </fieldset>
      )}
      {kind === 'daily' && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="first-weeks-time" className="mb-1 block text-xs font-semibold text-slate-800">When</label>
            <select id="first-weeks-time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              {REMINDER_TIMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <p className="pb-2 text-xs text-slate-700">{timeZoneName(zone)}</p>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-400" />
        <span>
          {kind === 'three'
            ? <>Email me at {email || 'my account address'}. {FIRST_WEEKS_CONSENT} I can stop them at any time.</>
            : <>Email me at {email || 'my account address'} once a day about my next step{until ? `, until ${readableDate(until)}` : ''}. I can turn it off at any time.</>}
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
