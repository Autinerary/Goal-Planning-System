'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '../../components/BackButton'

type TeamGroup = { id: string; name: string; slug: string; joinCode: string | null; verified: boolean; members: number; leaders: number }

const buttonClass = 'rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50'

/**
 * The team's groups (STEP 17's organisations, with STEP 102; app/api/admin/groups): make a group for a student group or
 * a service (it gets a code its people join with), and appoint its leaders by their account email. Leaders then see
 * their group's own page (/groups): its code, its crisis lines, and the safety check's counts for it.
 */
export default function TeamGroupsPage() {
  const [groups, setGroups] = useState<TeamGroup[] | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [name, setName] = useState('')
  const [leader, setLeader] = useState<Record<string, string>>({})

  const load = () =>
    fetch('/api/admin/groups', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'Could not load.')
        setGroups(d.groups)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'))
  useEffect(() => { load() }, [])

  const make = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(''); setError('')
    const r = await fetch('/api/admin/groups', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const d = await r.json().catch(() => null)
    if (!r.ok) return setError(d?.error || 'Couldn’t make the group.')
    setName(''); setStatus(`Made ${d.group.name}. Its code is ${d.group.joinCode}.`); load()
  }
  const appoint = async (g: TeamGroup) => {
    setStatus(''); setError('')
    const r = await fetch('/api/admin/groups', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, email: leader[g.id] || '' }) })
    const d = await r.json().catch(() => null)
    if (!r.ok) return setError(d?.error || 'Couldn’t appoint them.')
    setLeader((l) => ({ ...l, [g.id]: '' })); setStatus(`They now lead ${g.name}.`); load()
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Groups</h1>
      <p className="mt-1 text-sm text-slate-700">
        A student group or a service that uses Autinerary with the people it supports. People join with the group’s code
        (<Link href="/groups" className="font-medium text-indigo-800 underline underline-offset-2">Groups</Link>); its leaders see
        its code, set its crisis lines, and see the safety check’s counts for it, never words and never who.
      </p>
      <form onSubmit={make} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-medium text-slate-900">A new group’s name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-1 block w-72 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <button type="submit" disabled={name.trim().length < 3} className={buttonClass}>Make the group</button>
      </form>
      <p role="status" className="mt-2 text-sm text-emerald-900">{status}</p>
      {error && <p role="alert" className="mt-1 text-sm text-red-800">{error}</p>}
      {groups === null && !error && <p className="mt-4 text-slate-700">Loading…</p>}
      {groups?.length === 0 && <p className="mt-4 text-slate-700">No groups yet.</p>}
      <ul className="mt-4 space-y-3">
        {(groups || []).map((g) => (
          <li key={g.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">{g.name}</p>
            <p className="text-sm text-slate-700">
              Code <span className="font-mono">{g.joinCode || 'none'}</span> · {g.members} {g.members === 1 ? 'member' : 'members'} · {g.leaders} {g.leaders === 1 ? 'leader' : 'leaders'}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-sm text-slate-900">A leader’s account email
                <input type="email" value={leader[g.id] || ''} onChange={(e) => setLeader((l) => ({ ...l, [g.id]: e.target.value }))} className="mt-1 block w-72 rounded-lg border border-slate-300 px-3 py-1.5" />
              </label>
              <button type="button" onClick={() => appoint(g)} disabled={!(leader[g.id] || '').includes('@')} className={buttonClass}>Make them a leader</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
