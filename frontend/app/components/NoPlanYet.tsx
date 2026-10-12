'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { goHubHref } from '@/lib/serviceHub'
import { browserTimeZone } from '@/lib/reminderSchedule'
import { dayKey } from '@/lib/disclosure'

type Nudge = { snoozeUntil?: string | null; stoppedAt?: string | null }
type Reminder = { requestedAt?: string; plan?: string; stoppedAt?: string; sends?: string[] } | null

const QUIET = 'font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950'

/**
 * The card's three choices (Riipen Labs, Group 24: "Every reminder gives three
 * choices: finish now, remind me in a few days, or stop reminders", in the
 * app as well as by email; lib/setupReminders.ts). Snoozed or stopped, the
 * card becomes one quiet line, and the plan is always one tap away.
 */
function useSetupNudge() {
  const [state, setState] = useState<{ nudge: Nudge | null; reminder: Reminder; email: string | null; loaded: boolean }>({ nudge: null, reminder: null, email: null, loaded: false })
  useEffect(() => {
    let cancelled = false
    fetch('/api/me/setup-reminder', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setState({ nudge: json?.setupNudge || null, reminder: json?.setupReminder || null, email: json?.email || null, loaded: true }) })
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, loaded: true })) })
    return () => { cancelled = true }
  }, [])
  const act = async (action: string) => {
    const res = await fetch('/api/me/setup-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, timeZone: browserTimeZone() }),
    }).catch(() => null)
    const json = res?.ok ? await res.json().catch(() => null) : null
    if (json) setState((s) => ({ ...s, nudge: json.setupNudge || null, reminder: json.setupReminder || null }))
    return Boolean(json)
  }
  return { ...state, act }
}

/**
 * What a page shows before there is a plan: someone who chose "Skip for now"
 * in setup (Riipen Labs, Group 33), or whose plan isn't made yet. Group 31
 * found "most of the app remains empty and meaningless until onboarding is
 * completed". So: what will be here, the one step that fills it, in plain
 * words ("Complete onboarding" was the app's word, not theirs), and what
 * works without a plan in the meantime.
 *
 * `card` sits on the Path where "Your next step" goes; `page` fills a page.
 */
export default function NoPlanYet({ what, variant = 'page' }: { what?: string; variant?: 'page' | 'card' }) {
  const body = (
    <>
      <p className="mt-1 text-sm text-slate-700">
        {what ? `${what} once you make your plan. ` : ''}Making it takes two questions, about two minutes: who it is for, and one
        goal. Then your goal becomes small, clear steps.
      </p>
      <Link
        href="/onboarding"
        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
      >
        Make my plan <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <p className="mt-4 text-sm text-slate-700">
        These work without a plan:{' '}
        <a href={goHubHref('/search')} className="font-medium text-indigo-800 underline underline-offset-2">find services</a>,{' '}
        <a href={goHubHref('/community')} className="font-medium text-indigo-800 underline underline-offset-2">questions and answers in Tidbits</a>,{' '}
        <Link href="/hare-world" className="font-medium text-indigo-800 underline underline-offset-2">your people in Hare World</Link>, and{' '}
        <Link href="/help" className="font-medium text-indigo-800 underline underline-offset-2">what things are called</Link>.
      </p>
    </>
  )
  if (variant === 'card') return <NoPlanCard body={body} />
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <section aria-labelledby="no-plan-heading" className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 id="no-plan-heading" className="text-xl font-bold text-slate-900">No plan yet</h1>
        {body}
      </section>
    </div>
  )
}

function NoPlanCard({ body }: { body: React.ReactNode }) {
  const { nudge, reminder, email, loaded, act } = useSetupNudge()
  const [note, setNote] = useState('')
  const today = dayKey(new Date())
  const snoozed = Boolean(nudge?.snoozeUntil && nudge.snoozeUntil > today)
  const stopped = Boolean(nudge?.stoppedAt)
  const emailing = Boolean(reminder?.requestedAt && reminder.plan === 'sequence' && !reminder.stoppedAt)

  if (loaded && (snoozed || stopped)) {
    const when = snoozed ? new Date(`${nudge!.snoozeUntil}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : ''
    return (
      <p className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
        {snoozed ? `We’ll remind you again on ${when}.` : 'No reminders. You can make your plan whenever you like.'}{' '}
        <Link href="/onboarding" className={QUIET}>Make my plan</Link>
      </p>
    )
  }
  const choose = async (action: string, ok: string) => {
    setNote('')
    setNote((await act(action)) ? ok : 'That didn’t save just now. Please try again.')
  }
  return (
    <section aria-labelledby="no-plan-heading" className="mb-6 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
      <h2 id="no-plan-heading" className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Your first step</h2>
      <p className="mt-1 text-lg font-bold text-slate-900">Make your plan</p>
      {body}
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-3 text-sm text-slate-800">
        <span>Not now?</span>
        <button type="button" onClick={() => choose('snooze3', '')} className={QUIET}>Remind me in a few days</button>
        <button type="button" onClick={() => choose('stop', '')} className={QUIET}>Stop reminding me</button>
        {!emailing && email && (
          <button type="button" onClick={() => choose('ask', `We’ll email ${email} at most three times, and stop once your plan is made.`)} className={QUIET}>
            Email me reminders
          </button>
        )}
      </p>
      {note && <p role="status" className="mt-2 text-sm text-slate-800">{note}</p>}
    </section>
  )
}
