'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GOAL_AREAS } from '@/lib/goalAreas'
import { PersonAvatar } from './PeopleBoard'

/**
 * Relationships: matching, which never worked before (STEP 87). Only people
 * who opt in are suggested to each other, and only what they choose to show
 * is shown: what they're looking for, the areas of life they're working on,
 * and a short note. A match is a friend request: they accept or not, as
 * always. People who can't be found (Profile & Discovery) and Family
 * accounts (under 18) aren't part of it.
 */

const LOOKING: { id: string; label: string; category: 'friends' | 'mentors' }[] = [
  { id: 'friends', label: 'Friends', category: 'friends' },
  { id: 'accountability', label: 'An accountability buddy', category: 'friends' },
  { id: 'mentor', label: 'A mentor', category: 'mentors' },
  { id: 'mentee', label: 'Someone to mentor', category: 'friends' },
]

interface Candidate {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_emoji: string | null
  avatar_url: string | null
  pronouns: string | null
  looking_for: string[]
  topics: string[]
  note: string | null
  in_common: number
}

const areaLabel = (id: string) => GOAL_AREAS.find((a) => a.id === id)?.label || id
const lookingLabel = (id: string) => LOOKING.find((l) => l.id === id)?.label || id

export default function Relationships() {
  const [state, setState] = useState<{ available: boolean; managed: boolean; discoverable: boolean; profile: { looking_for: string[]; topics: string[]; note: string | null } | null; people: Candidate[] } | null>(null)
  const [editing, setEditing] = useState(false)
  const [looking, setLooking] = useState<string[]>(['friends'])
  const [topics, setTopics] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const load = () =>
    fetch('/api/matches', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setState(d)
        if (d.profile) {
          setLooking(d.profile.looking_for)
          setTopics(d.profile.topics)
          setNote(d.profile.note || '')
        }
      })
      .catch(() => null)

  useEffect(() => {
    load()
  }, [])

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const save = async () => {
    setBusy(true)
    setStatus('')
    const res = await fetch('/api/matches', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ looking_for: looking, topics, note }) })
    const d = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setStatus(d?.error || 'That didn’t save.')
    setEditing(false)
    setStatus('Saved. You’re in Relationships.')
    load()
  }

  const optOut = async () => {
    if (!window.confirm('Stop being suggested to others in Relationships?')) return
    await fetch('/api/matches', { method: 'DELETE', credentials: 'include' })
    setStatus('You’re out of Relationships. Nobody is suggested you any more.')
    load()
  }

  const pass = async (id: string) => {
    setState((s) => (s ? { ...s, people: s.people.filter((p) => p.user_id !== id) } : s))
    await fetch('/api/matches', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass: id }) })
  }

  const ask = async (p: Candidate) => {
    setStatus('')
    const category = p.looking_for.includes('mentee') && looking.includes('mentor') ? 'mentors' : 'friends'
    const res = await fetch('/api/connections', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, target_user_id: p.user_id, name: p.display_name || p.username || 'Someone', role: 'Matched in Relationships' }),
    })
    const d = await res.json().catch(() => null)
    if (!res.ok) return setStatus(d?.error || 'The request couldn’t be sent.')
    setState((s) => (s ? { ...s, people: s.people.filter((x) => x.user_id !== p.user_id) } : s))
    setStatus(`Request sent to ${p.display_name || 'them'}. They’ll see it at the top of Hare World.`)
  }

  if (!state) return <p className="text-sm text-slate-700">Loading…</p>
  if (!state.available) return <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900">Relationships open soon.</p>
  if (state.managed) return <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900">Relationships (meeting new people) isn’t available for Family accounts.</p>

  const form = (
    <div className="space-y-4 rounded-2xl border border-purple-200 bg-white p-4" data-match-form>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">What you’re looking for</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LOOKING.map((l) => (
            <label key={l.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${looking.includes(l.id) ? 'border-purple-700 bg-purple-50 font-semibold text-purple-900' : 'border-slate-300 text-slate-900'}`}>
              <input type="checkbox" className="sr-only" checked={looking.includes(l.id)} onChange={() => setLooking(toggle(looking, l.id))} />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">Areas of life you’re working on (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {GOAL_AREAS.map((a) => (
            <label key={a.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${topics.includes(a.id) ? 'border-purple-700 bg-purple-50 font-semibold text-purple-900' : 'border-slate-300 text-slate-900'}`}>
              <input type="checkbox" className="sr-only" checked={topics.includes(a.id)} onChange={() => setTopics(toggle(topics, a.id))} />
              {a.emoji} {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold text-slate-900">
        A short note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} rows={2} placeholder="e.g. Learning to cook and would love a buddy" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" />
      </label>
      <p className="text-xs text-slate-700">
        Others in Relationships see your name, your picture (
        <Link href="/profile" className="font-medium text-purple-900 underline">
          Your profile
        </Link>
        ), these choices and your note. Nothing else. A match is a friend request they can accept or not.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy || !looking.length} className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60">
          {state.profile ? 'Save' : 'Join Relationships'}
        </button>
        {state.profile && (
          <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">
            Cancel
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4" data-relationships>
      <div>
        <h3 className="text-lg font-bold text-slate-900">Meet people on a similar path</h3>
        <p className="text-sm text-slate-800">Only people who join Relationships are suggested to each other, most in common first.</p>
      </div>
      {!state.discoverable && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          People can’t find you right now, so you won’t be suggested to anyone.{' '}
          <Link href="/profile#discovery" className="font-semibold underline">
            Profile &amp; Discovery
          </Link>
        </p>
      )}
      {!state.profile || editing ? (
        form
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-slate-900">
          <span>
            You’re in Relationships, looking for {state.profile.looking_for.map(lookingLabel).join(', ').toLowerCase()}
            {state.profile.topics.length ? ` · ${state.profile.topics.map(areaLabel).join(', ')}` : ''}.
          </span>
          <button type="button" onClick={() => setEditing(true)} className="font-semibold text-purple-900 underline">
            Change
          </button>
          <button type="button" onClick={optOut} className="font-semibold text-slate-800 underline">
            Leave Relationships
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="text-sm text-slate-900">
          {status}
        </p>
      )}
      {state.profile && !editing && (
        state.people.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">Nobody to suggest right now. As more people join, they’ll show here.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.people.map((p) => (
              <li key={p.user_id} className="rounded-2xl border border-slate-200 bg-white p-4" data-match={p.user_id}>
                <div className="flex items-center gap-3">
                  <PersonAvatar person={{ id: p.user_id, name: p.display_name || 'Someone', role: '', status: '', icon: p.avatar_emoji || '🙂', avatar_url: p.avatar_url }} size={56} />
                  <div className="min-w-0">
                    <p className="break-words text-lg font-bold text-slate-900">{p.display_name || p.username || 'Someone'}</p>
                    <p className="text-xs text-slate-700">{[p.username ? `@${p.username}` : null, p.pronouns].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-900">Looking for: {p.looking_for.map(lookingLabel).join(', ').toLowerCase()}</p>
                {p.topics.length > 0 && <p className="text-sm text-slate-900">Working on: {p.topics.map(areaLabel).join(', ')}</p>}
                {p.in_common > 0 && <p className="mt-1 text-xs font-semibold text-purple-900">{p.in_common} {p.in_common === 1 ? 'area' : 'areas'} in common</p>}
                {p.note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm italic text-slate-900">“{p.note}”</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => ask(p)} className="rounded-lg bg-purple-700 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-800">
                    Ask to connect
                  </button>
                  <button type="button" onClick={() => pass(p.user_id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                    Not now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
