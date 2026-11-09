'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '../components/BackButton'
import { forgetGroupLines } from '../components/useGroupLines'
import { countWords, MAX_LINES, MIN_MEMBERS_FOR_COUNTS, readGroups, type Group } from '@/lib/groups'
import type { CrisisLine } from '@/lib/crisis'

const linkClass = 'font-medium text-indigo-800 underline underline-offset-2'
const buttonClass = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50'

type Counts = {
  members: number; enough: boolean; minimum: number; smallest: number; days: number
  totals?: Record<string, number | null>
  weeks?: Array<{ week: string } & Record<string, number | null>>
}

const ROWS: [string, string][] = [
  ['care', 'Crisis lines shown'], ['steer', 'Something risky asked, answered safely'], ['hide', 'Personal details hidden from the AI'],
  ['answers', 'Answers redone or left out'], ['unchecked', 'The check couldn’t run'],
]

/** A leader's view of their group: its join code, its own crisis lines, and the safety check's counts (STEP 102). */
function Leading({ group, onSaved }: { group: Group; onSaved: () => void }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [countsNote, setCountsNote] = useState('')
  const [lines, setLines] = useState<CrisisLine[]>(group.lines)
  const [saving, setSaving] = useState('')
  useEffect(() => {
    fetch(`/api/groups/${group.id}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'Couldn’t load the counts.')
        if (d.available === false) setCountsNote('The counts aren’t in the database yet.')
        else setCounts(d.counts)
      })
      .catch((e) => setCountsNote(e instanceof Error ? e.message : 'Couldn’t load the counts.'))
  }, [group.id])

  const set = (i: number, key: keyof CrisisLine, value: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)))
  const save = async () => {
    setSaving('Saving…')
    const r = await fetch(`/api/groups/${group.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines }) })
    const d = await r.json().catch(() => null)
    if (r.ok) { setLines(d.lines); setSaving('Saved.'); forgetGroupLines(); onSaved() } else setSaving(d?.error || 'Couldn’t save.')
  }

  return (
    <div className="mt-4 space-y-6 border-t border-slate-200 pt-4">
      <section>
        <h3 className="font-semibold text-slate-900">The code people join with</h3>
        <p className="mt-1 text-sm text-slate-700">Share it with your group. Anyone with it can join.</p>
        <p className="mt-2 font-mono text-lg tracking-wider text-slate-900">{group.joinCode || 'No code: ask the team for one.'}</p>
      </section>

      <section>
        <h3 className="font-semibold text-slate-900">Your group’s own crisis lines</h3>
        <p className="mt-1 text-sm text-slate-700">
          Shown on your members’ crisis card, under the free lines everyone sees: your campus counselling, for example. Up
          to {MAX_LINES}. Give a number to text, to call, or both.
        </p>
        <div className="mt-2 space-y-3">
          {lines.map((l, i) => (
            <fieldset key={i} className="rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-800">Line {i + 1}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm text-slate-800">Name<input value={l.name} onChange={(e) => set(i, 'name', e.target.value)} maxLength={80} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
                <label className="text-sm text-slate-800">What to do<input value={l.how} onChange={(e) => set(i, 'how', e.target.value)} maxLength={200} placeholder="call 416-000-0000, weekdays 9 to 5" className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
                <label className="text-sm text-slate-800">Number to call<input value={l.tel ?? ''} onChange={(e) => set(i, 'tel', e.target.value)} inputMode="tel" className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
                <label className="text-sm text-slate-800">Number to text<input value={l.sms ?? ''} onChange={(e) => set(i, 'sms', e.target.value)} inputMode="tel" className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
                <label className="text-sm text-slate-800">Word to text (if any)<input value={l.smsBody ?? ''} onChange={(e) => set(i, 'smsBody', e.target.value)} maxLength={30} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
              </div>
              <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="mt-2 text-sm font-medium text-red-800 underline">Remove this line</button>
            </fieldset>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {lines.length < MAX_LINES && <button type="button" onClick={() => setLines((ls) => [...ls, { name: '', how: '' }])} className={buttonClass}>Add a line</button>}
          <button type="button" onClick={save} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-800">Save the lines</button>
          <span role="status" className="text-sm text-slate-800">{saving}</span>
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-slate-900">What the safety check did for your group</h3>
        <p className="mt-1 text-sm text-slate-700">
          Counts only: never anyone’s words, and never who. Shown once the group has at least {MIN_MEMBERS_FOR_COUNTS} members,
          and a count of 1 or 2 shows as “fewer than 3”, so no one can be picked out.{' '}
          <Link href="/help#ai-safety" className={linkClass}>How the safety check works</Link>
        </p>
        {countsNote && <p className="mt-2 text-sm text-slate-800">{countsNote}</p>}
        {counts && !counts.enough && (
          <p className="mt-2 text-sm text-slate-800">Your group has {counts.members} {counts.members === 1 ? 'member' : 'members'}. The counts show from {counts.minimum}.</p>
        )}
        {counts?.enough && counts.totals && (
          <>
            <table className="mt-2 w-full max-w-xl text-sm" aria-label={`The last ${counts.days} days`}>
              <caption className="text-left text-sm text-slate-700">The last {counts.days} days, {counts.members} members</caption>
              <tbody>
                {ROWS.map(([k, label]) => (
                  <tr key={k} className="border-b border-slate-100">
                    <th scope="row" className="py-1.5 pr-4 text-left font-normal text-slate-800">{label}</th>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-slate-900">{countWords(counts.totals![k], counts.smallest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!!counts.weeks?.length && (
              <div className="mt-3 overflow-x-auto" role="region" aria-label="Week by week" tabIndex={0}>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-700">
                      <th scope="col" className="py-1.5 pr-4 font-semibold">Week of</th>
                      {ROWS.map(([k, label]) => <th key={k} scope="col" className="py-1.5 pr-4 text-right font-semibold">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {counts.weeks.map((w) => (
                      <tr key={w.week} className="border-b border-slate-100 tabular-nums text-slate-900">
                        <th scope="row" className="py-1.5 pr-4 text-left font-normal">{w.week}</th>
                        {ROWS.map(([k]) => <td key={k} className="py-1.5 pr-4 text-right">{countWords(w[k] as number | null, counts.smallest)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/**
 * Groups (STEP 17's organisations, with STEP 102; lib/groups.ts): a student group or a service someone uses
 * Autinerary with, joined with its code and left at any time. What joining shares is said before the code box.
 */
export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    fetch('/api/me/groups', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setGroups(readGroups(d)))
      .catch(() => setError('Couldn’t load your groups. Please try again.'))
  useEffect(() => { load() }, [])

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(''); setError('')
    const r = await fetch('/api/me/groups', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
    const d = await r.json().catch(() => null)
    if (!r.ok) return setError(d?.error || 'Couldn’t join just now.')
    setCode(''); setStatus(`You joined ${d.group.name}.`); forgetGroupLines(); load()
  }
  const leave = async (g: Group) => {
    if (!window.confirm(`Leave ${g.name}? You can join again with its code.`)) return
    const r = await fetch(`/api/me/groups?id=${encodeURIComponent(g.id)}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok) return setError('Couldn’t leave just now.')
    setStatus(`You left ${g.name}.`); forgetGroupLines(); load()
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton fallback="/profile/settings" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Groups</h1>
      <p className="mt-1 text-slate-800">
        A group is a student group or a service you use Autinerary with, such as your university’s autism and neurodivergent
        student group. Join with the code they give you.
      </p>
      <section aria-labelledby="joining" className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="joining" className="font-semibold text-slate-900">What joining a group shares</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
          <li>Your group’s own crisis lines, such as your campus counselling, show on your crisis card.</li>
          <li>Its leaders see how often the safety check did something for the group’s members, week by week: never your words, and never who. Only once the group has {MIN_MEMBERS_FOR_COUNTS} members, and 1s and 2s are hidden.</li>
          <li>Its leaders can see that you’re a member, with your name, and, in ResourceHub, the norms on your profile, so they can vouch for them.</li>
          <li>They don’t see your plan, your journal or your chats. You can leave at any time.</li>
        </ul>
        <form onSubmit={join} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-900">The group’s code
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={40}
              className="mt-1 block w-56 rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
          </label>
          <button type="submit" disabled={!code.trim()} className="rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-800 disabled:opacity-50">Join</button>
        </form>
        <p role="status" className="mt-2 text-sm text-emerald-900">{status}</p>
        {error && <p role="alert" className="mt-1 text-sm text-red-800">{error}</p>}
      </section>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Your groups</h2>
      {groups === null && !error && <p className="mt-2 text-slate-700">Loading…</p>}
      {groups?.length === 0 && <p className="mt-2 text-slate-700">You’re not in a group yet.</p>}
      <ul className="mt-3 space-y-4">
        {(groups || []).map((g) => (
          <li key={g.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{g.name}</p>
                <p className="text-sm text-slate-700">{g.role === 'leader' ? 'You lead this group.' : 'Member'}{g.lines.length ? ` · ${g.lines.length} crisis ${g.lines.length === 1 ? 'line' : 'lines'} of its own` : ''}</p>
              </div>
              <button type="button" onClick={() => leave(g)} className={buttonClass}>Leave</button>
            </div>
            {g.role === 'leader' && <Leading group={g} onSaved={load} />}
          </li>
        ))}
      </ul>
    </main>
  )
}
