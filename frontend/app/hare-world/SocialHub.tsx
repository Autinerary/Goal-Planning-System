'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Heart, MessageCircle, Trash2 } from 'lucide-react'
import { PersonAvatar } from './PeopleBoard'
import type { Person } from '@/lib/social'

/**
 * What you do with your people in Hare World (Riipen Labs, Group 34): updates
 * from them, notes of support, memes, calls, tasks from mentors, and goals
 * worked on together. These were listed as "Coming later"; their rules are
 * in the database (STEP 66), and until STEP 66 is applied each says it isn't
 * switched on yet. Updates need nothing new and work now.
 */

type TabId = 'updates' | 'notes' | 'memes' | 'calls' | 'tasks' | 'together'
const TABS: { id: TabId; label: string }[] = [
  { id: 'updates', label: 'Updates' },
  { id: 'notes', label: 'Notes of support' },
  { id: 'memes', label: 'Memes' },
  { id: 'calls', label: 'Calls' },
  { id: 'tasks', label: 'Mentor tasks' },
  { id: 'together', label: 'Goals together' },
]

const when = (iso?: string | null, withTime = false) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { day: 'numeric', month: 'short' })
}

async function send(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, json }
  } catch {
    return { ok: false, json: { error: 'Something went wrong. Please try again.' } }
  }
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    fetch(url, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setData(j); setFailed(false) })
      .catch(() => setFailed(true))
  }, [url])
  useEffect(() => { load() }, [load])
  return { data, failed, reload: load }
}

const NotYet = () => (
  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">This isn’t switched on yet. It will be soon.</p>
)

const Status = ({ text }: { text: string }) => <p role="status" className="mt-2 text-sm text-slate-800">{text}</p>

function PersonPicker({ id, people, value, onChange, label = 'Who' }: { id: string; people: Person[]; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-slate-800">
      {label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        <option value="">Choose someone</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  )
}

const card = 'rounded-xl border border-slate-200 bg-white p-4'
const button = 'rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50'
const quiet = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50'

// ── Updates ──────────────────────────────────────────────────────────────
function Updates() {
  const { data, failed } = useLoad<{ updates: { person: Person; step: string | null; completed_at: string }[]; people: number }>('/api/social/updates')
  if (failed) return <p className="text-sm text-slate-700">Updates could not be loaded.</p>
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>
  if (!data.people) return <p className="text-sm text-slate-700">When you’re connected with people, the steps they finish show here.</p>
  if (!data.updates.length) return <p className="text-sm text-slate-700">Nothing new from your people in the last 30 days.</p>
  return (
    <ul className="space-y-2">
      {data.updates.map((u, i) => (
        <li key={i} className={`${card} flex items-center gap-3`}>
          <PersonAvatar person={u.person as any} size={36} />
          <p className="min-w-0 flex-1 text-sm text-slate-800">
            <span className="font-semibold text-slate-900">{u.person.name}</span> finished {u.step ? <>“{u.step}”</> : 'a step on their path'}.
            <span className="block text-xs text-slate-600">{when(u.completed_at)}</span>
          </p>
          <Link href={`/friend/${u.person.id}`} className="shrink-0 text-xs font-semibold text-purple-800 underline underline-offset-2">See their path</Link>
        </li>
      ))}
    </ul>
  )
}

// ── Notes of support ─────────────────────────────────────────────────────
const NOTE_IDEAS = ['You’ve got this!', 'Proud of you.', 'One step at a time.', 'Thinking of you today.', 'Take a break if you need one.']

export function NoteForm({ people, to: fixedTo, onSent }: { people: Person[]; to?: string; onSent?: () => void }) {
  const [to, setTo] = useState(fixedTo || '')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to) { setStatus('Choose someone first.'); return }
    setBusy(true)
    const { ok, json } = await send('/api/social/messages', 'POST', { to, content: text, kind: 'support' })
    setBusy(false)
    if (!ok) { setStatus(json.error || 'Your note could not be sent.'); return }
    setText('')
    setStatus('Sent. They’ll see it in Hare World and on their Path.')
    onSent?.()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedTo && <PersonPicker id="note-to" people={people} value={to} onChange={setTo} label="Send a note to" />}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ideas">
        {NOTE_IDEAS.map((idea) => (
          <button key={idea} type="button" onClick={() => setText(idea)} className="rounded-full border border-pink-300 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-900 hover:bg-pink-100">{idea}</button>
        ))}
      </div>
      <label htmlFor={fixedTo ? `note-text-${fixedTo}` : 'note-text'} className="block text-sm font-medium text-slate-800">
        Your note
        <textarea id={fixedTo ? `note-text-${fixedTo}` : 'note-text'} value={text} maxLength={300} rows={2} onChange={(e) => { setText(e.target.value); setStatus('') }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={busy || !text.trim()} className={button}>{busy ? 'Sending…' : 'Send note'}</button>
      <Status text={status} />
    </form>
  )
}

function Notes({ people }: { people: Person[] }) {
  const { data, failed } = useLoad<{ available: boolean; notes: { id: string; from: Person; content: string; created_at: string }[] }>('/api/social/messages?notes=1')
  if (failed) return <p className="text-sm text-slate-700">Notes could not be loaded.</p>
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>
  if (!data.available) return <NotYet />
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold text-slate-900">Notes you got</h4>
        {data.notes.length === 0 ? <p className="text-sm text-slate-700">None yet.</p> : (
          <ul className="space-y-2">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-pink-200 bg-pink-50 p-3">
                <p className="text-sm text-slate-900">“{n.content}”</p>
                <p className="mt-1 text-xs text-slate-700">From {n.from.name}, {when(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={card}>
        <h4 className="mb-2 font-semibold text-slate-900">Send one</h4>
        {people.length ? <NoteForm people={people} /> : <p className="text-sm text-slate-700">Connect with someone first.</p>}
      </div>
    </div>
  )
}

// ── Memes ────────────────────────────────────────────────────────────────
const MEME_EMOJI = ['🎉', '💪', '🌱', '🐢', '🚀', '😂', '😅', '🙌', '☕', '🧩', '🌈', '🐇']
type Meme = { id: string; by: Person; mine: boolean; content_type: string; content: string; caption: string | null; likes: number; liked: boolean; created_at: string }

function Memes() {
  const { data, failed, reload } = useLoad<{ available: boolean; memes: Meme[] }>('/api/social/memes')
  const [emoji, setEmoji] = useState('')
  const [words, setWords] = useState('')
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState('')
  if (failed) return <p className="text-sm text-slate-700">Memes could not be loaded.</p>
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>
  if (!data.available) return <NotYet />

  const post = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = words.trim() || emoji
    if (!content) { setStatus('Pick an emoji or write a few words.'); return }
    const { ok, json } = await send('/api/social/memes', 'POST', { content, content_type: words.trim() ? 'text' : 'emoji', caption })
    if (!ok) { setStatus(json.error || 'Your meme could not be shared.'); return }
    setEmoji(''); setWords(''); setCaption('')
    setStatus('Shared with your connections.')
    reload()
  }
  const like = async (m: Meme) => {
    const { ok } = await send('/api/social/memes/like', 'POST', { id: m.id, like: !m.liked })
    if (ok) reload()
  }
  const remove = async (m: Meme) => {
    const { ok } = await send('/api/social/memes', 'DELETE', { id: m.id })
    setStatus(ok ? 'Deleted.' : 'That meme could not be deleted.')
    if (ok) reload()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <form onSubmit={post} className={`${card} space-y-3`}>
        <h4 className="font-semibold text-slate-900">Share a meme</h4>
        <div role="group" aria-label="Pick an emoji" className="grid grid-cols-6 gap-1">
          {MEME_EMOJI.map((e) => (
            <button key={e} type="button" aria-pressed={emoji === e} aria-label={`Emoji ${e}`} onClick={() => setEmoji(emoji === e ? '' : e)} className={`keep-colors grid h-10 place-items-center rounded-lg text-xl ${emoji === e ? 'bg-purple-100 ring-2 ring-purple-600' : 'hover:bg-slate-100'}`}>{e}</button>
          ))}
        </div>
        <label htmlFor="meme-words" className="block text-sm font-medium text-slate-800">
          Or a few words
          <input id="meme-words" value={words} maxLength={300} onChange={(e) => setWords(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label htmlFor="meme-caption" className="block text-sm font-medium text-slate-800">
          Caption (optional)
          <input id="meme-caption" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-slate-600">Everyone you’re connected to sees it.</p>
        <button type="submit" className={button}>Share</button>
        <Status text={status} />
      </form>
      <div>
        {data.memes.length === 0 ? <p className="text-sm text-slate-700">No memes yet. Share the first one.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.memes.map((m) => (
              <li key={m.id} className={card}>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <PersonAvatar person={m.by as any} size={24} /> <span className="font-semibold text-slate-900">{m.mine ? 'You' : m.by.name}</span> · {when(m.created_at)}
                </div>
                <p className={`my-3 text-center ${m.content_type === 'emoji' ? 'keep-colors text-5xl' : 'text-lg font-semibold text-slate-900'}`}>{m.content}</p>
                {m.caption && <p className="text-center text-sm text-slate-800">{m.caption}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => like(m)} aria-pressed={m.liked} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${m.liked ? 'bg-pink-100 text-pink-900' : 'bg-slate-100 text-slate-800'}`}>
                    <Heart className={`h-3.5 w-3.5 ${m.liked ? 'fill-current' : ''}`} aria-hidden="true" /> {m.likes} <span className="sr-only">{m.liked ? ', you like this' : ', like'}</span>
                  </button>
                  {m.mine && (
                    <button type="button" onClick={() => remove(m)} aria-label="Delete this meme" className="inline-flex items-center gap-1 text-xs font-medium text-red-800 hover:underline">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Calls ────────────────────────────────────────────────────────────────
type Call = { id: string; with: Person; booked_by_me: boolean; status: string; scheduled_at: string | null; notes: string | null; room_url: string | null }

export function CallForm({ people, to: fixedTo, onBooked }: { people: Person[]; to?: string; onBooked?: () => void }) {
  const [to, setTo] = useState(fixedTo || '')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const idp = fixedTo ? `call-${fixedTo}` : 'call'
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to || !day || !time) { setStatus('Choose who, the day and the time.'); return }
    setBusy(true)
    const { ok, json } = await send('/api/social/calls', 'POST', { with: to, scheduled_at: new Date(`${day}T${time}`).toISOString(), notes, room_url: link })
    setBusy(false)
    if (!ok) { setStatus(json.error || 'The call could not be booked.'); return }
    setNotes(''); setLink('')
    setStatus('Booked. You’ll both see it under Calls, with the link to join.')
    onBooked?.()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedTo && <PersonPicker id={`${idp}-to`} people={people} value={to} onChange={setTo} label="Call with" />}
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${idp}-day`} className="block text-sm font-medium text-slate-800">Day<input id={`${idp}-day`} type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label htmlFor={`${idp}-time`} className="block text-sm font-medium text-slate-800">Time<input id={`${idp}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>
      <label htmlFor={`${idp}-notes`} className="block text-sm font-medium text-slate-800">What it’s about (optional)<input id={`${idp}-notes`} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <label htmlFor={`${idp}-link`} className="block text-sm font-medium text-slate-800">
        Your own video link (optional)
        <input id={`${idp}-link`} type="url" inputMode="url" value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} aria-describedby={`${idp}-link-help`} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <p id={`${idp}-link-help`} className="text-xs text-slate-600">Leave it empty and we make a private Jitsi Meet room. It works in a browser, with no account.</p>
      <button type="submit" disabled={busy} className={button}>{busy ? 'Booking…' : 'Book the call'}</button>
      <Status text={status} />
    </form>
  )
}

function Calls({ people }: { people: Person[] }) {
  const { data, failed, reload } = useLoad<{ available: boolean; calls: Call[] }>('/api/social/calls')
  const [status, setStatus] = useState('')
  if (failed) return <p className="text-sm text-slate-700">Calls could not be loaded.</p>
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>
  if (!data.available) return <NotYet />
  const set = async (c: Call, s: 'cancelled' | 'completed') => {
    const { ok, json } = await send('/api/social/calls', 'PATCH', { id: c.id, status: s })
    setStatus(ok ? (s === 'cancelled' ? 'Cancelled.' : 'Marked as done.') : json.error || 'That could not be saved.')
    if (ok) reload()
  }
  const upcoming = data.calls.filter((c) => c.status === 'scheduled').sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
  const past = data.calls.filter((c) => c.status !== 'scheduled').slice(0, 10)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold text-slate-900">Coming up</h4>
        {upcoming.length === 0 ? <p className="text-sm text-slate-700">No calls booked.</p> : (
          <ul className="space-y-2">
            {upcoming.map((c) => (
              <li key={c.id} className={card}>
                <p className="font-semibold text-slate-900">{c.with.name}</p>
                <p className="text-sm text-slate-800">{when(c.scheduled_at, true)}{c.notes ? ` · ${c.notes}` : ''}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.room_url && <a href={c.room_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Join the call<span className="sr-only"> (opens in a new tab)</span></a>}
                  <button type="button" onClick={() => set(c, 'completed')} className={quiet}>Mark as done</button>
                  <button type="button" onClick={() => set(c, 'cancelled')} className={quiet}>Cancel</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">Earlier calls</summary>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {past.map((c) => <li key={c.id}>{c.with.name}, {when(c.scheduled_at, true)}: {c.status === 'cancelled' ? 'cancelled' : 'done'}</li>)}
            </ul>
          </details>
        )}
        <Status text={status} />
      </div>
      <div className={card}>
        <h4 className="mb-2 font-semibold text-slate-900">Book a call</h4>
        {people.length ? <CallForm people={people} onBooked={reload} /> : <p className="text-sm text-slate-700">Connect with someone first.</p>}
      </div>
    </div>
  )
}

// ── Mentor tasks ─────────────────────────────────────────────────────────
type Task = { id: string; title: string; note: string | null; due_on: string | null; status: string; from?: Person; to?: Person }
const TASK_WORD: Record<string, string> = { suggested: 'New', accepted: 'Accepted', done: 'Done', declined: 'Declined' }

export function TaskForm({ people, to: fixedTo, onSent }: { people: Person[]; to?: string; onSent?: () => void }) {
  const mentees = people.filter((p) => p.chose_you_as_mentor)
  const [to, setTo] = useState(fixedTo || '')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [status, setStatus] = useState('')
  const idp = fixedTo ? `task-${fixedTo}` : 'task'
  if (!fixedTo && mentees.length === 0) return <p className="text-sm text-slate-700">When someone chooses you as their mentor, you can suggest small tasks to them here.</p>
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to) { setStatus('Choose someone first.'); return }
    const { ok, json } = await send('/api/social/tasks', 'POST', { mentee: to, title, note, due_on: due || null })
    if (!ok) { setStatus(json.error || 'The task could not be sent.'); return }
    setTitle(''); setNote(''); setDue('')
    setStatus('Sent. They can accept it, decline it or tick it off.')
    onSent?.()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedTo && <PersonPicker id={`${idp}-to`} people={mentees} value={to} onChange={setTo} label="For" />}
      <label htmlFor={`${idp}-title`} className="block text-sm font-medium text-slate-800">Task<input id={`${idp}-title`} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="For example: write down three questions for the interview" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <label htmlFor={`${idp}-note`} className="block text-sm font-medium text-slate-800">A note (optional)<input id={`${idp}-note`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <label htmlFor={`${idp}-due`} className="block text-sm font-medium text-slate-800">By (optional)<input id={`${idp}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <button type="submit" disabled={!title.trim()} className={button}>Send task</button>
      <Status text={status} />
    </form>
  )
}

function Tasks({ people }: { people: Person[] }) {
  const { data, failed, reload } = useLoad<{ available: boolean; forMe: Task[]; fromMe: Task[] }>('/api/social/tasks')
  const [status, setStatus] = useState('')
  if (failed) return <p className="text-sm text-slate-700">Tasks could not be loaded.</p>
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>
  if (!data.available) return <NotYet />
  const answer = async (t: Task, s: string) => {
    const { ok, json } = await send('/api/social/tasks', 'PATCH', { id: t.id, status: s })
    setStatus(ok ? `Saved: ${TASK_WORD[s]}.` : json.error || 'That could not be saved.')
    if (ok) reload()
  }
  const remove = async (t: Task) => {
    const { ok } = await send('/api/social/tasks', 'DELETE', { id: t.id })
    setStatus(ok ? 'Removed.' : 'That task could not be removed.')
    if (ok) reload()
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold text-slate-900">From your mentors</h4>
        {data.forMe.length === 0 ? <p className="text-sm text-slate-700">No tasks yet. A mentor you chose can suggest some.</p> : (
          <ul className="space-y-2">
            {data.forMe.map((t) => (
              <li key={t.id} className={card}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{TASK_WORD[t.status]} · from {t.from?.name}</p>
                <p className={`font-semibold text-slate-900 ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</p>
                {t.note && <p className="text-sm text-slate-800">{t.note}</p>}
                {t.due_on && <p className="text-xs text-slate-700">By {new Date(`${t.due_on}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.status === 'suggested' && <button type="button" onClick={() => answer(t, 'accepted')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Accept</button>}
                  {t.status !== 'done' && t.status !== 'declined' && <button type="button" onClick={() => answer(t, 'done')} className={quiet}>Done</button>}
                  {t.status === 'suggested' && <button type="button" onClick={() => answer(t, 'declined')} className={quiet}>No, thanks</button>}
                  {(t.status === 'done' || t.status === 'declined') && <button type="button" onClick={() => remove(t)} className={quiet}>Remove</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.fromMe.length > 0 && (
          <>
            <h4 className="mb-2 mt-4 font-semibold text-slate-900">Tasks you suggested</h4>
            <ul className="space-y-2">
              {data.fromMe.map((t) => (
                <li key={t.id} className={`${card} flex items-start justify-between gap-3`}>
                  <span className="text-sm text-slate-800"><span className="font-semibold text-slate-900">{t.title}</span><span className="block text-xs text-slate-700">For {t.to?.name}: {TASK_WORD[t.status].toLowerCase()}</span></span>
                  <button type="button" onClick={() => remove(t)} className={quiet}>Remove</button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Status text={status} />
      </div>
      <div className={card}>
        <h4 className="mb-2 font-semibold text-slate-900">Suggest a task</h4>
        <TaskForm people={people} onSent={reload} />
      </div>
    </div>
  )
}

// ── Goals together ───────────────────────────────────────────────────────
type Collab = { id: string; goal: string; note: string | null; status: string; mine: boolean; with: Person }

export function CollabForm({ people, goals, to: fixedTo, onSent }: { people: Person[]; goals: string[]; to?: string; onSent?: () => void }) {
  const [to, setTo] = useState(fixedTo || '')
  const [goal, setGoal] = useState(goals[0] || '')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const idp = fixedTo ? `collab-${fixedTo}` : 'collab'
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to) { setStatus('Choose someone first.'); return }
    const { ok, json } = await send('/api/social/collabs', 'POST', { partner: to, goal, note })
    if (!ok) { setStatus(json.error || 'The invitation could not be sent.'); return }
    setNote('')
    setStatus('Invited. You’ll see it here when they answer.')
    onSent?.()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedTo && <PersonPicker id={`${idp}-to`} people={people} value={to} onChange={setTo} label="With" />}
      <label htmlFor={`${idp}-goal`} className="block text-sm font-medium text-slate-800">
        Goal
        <input id={`${idp}-goal`} list={`${idp}-goals`} value={goal} maxLength={200} onChange={(e) => setGoal(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <datalist id={`${idp}-goals`}>{goals.map((g) => <option key={g} value={g} />)}</datalist>
      </label>
      <label htmlFor={`${idp}-note`} className="block text-sm font-medium text-slate-800">A note (optional)<input id={`${idp}-note`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <button type="submit" disabled={!goal.trim()} className={button}>Invite</button>
      <Status text={status} />
    </form>
  )
}

function Together({ people, goals }: { people: Person[]; goals: string[] }) {
  const { data, failed, reload } = useLoad<{ available: boolean; collabs: Collab[] }>('/api/social/collabs')
  const [status, setStatus] = useState('')
  if (failed) return <p className="text-sm text-slate-700">Goals together could not be loaded.</p>
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>
  if (!data.available) return <NotYet />
  const respond = async (c: Collab, accept: boolean) => {
    const { ok, json } = await send('/api/social/collabs', 'PATCH', { id: c.id, accept })
    setStatus(ok ? (accept ? 'Accepted. You’re working on it together.' : 'Declined.') : json.error || 'That could not be saved.')
    if (ok) reload()
  }
  const leave = async (c: Collab) => {
    const { ok } = await send('/api/social/collabs', 'DELETE', { id: c.id })
    setStatus(ok ? 'Removed.' : 'That could not be removed.')
    if (ok) reload()
  }
  const invites = data.collabs.filter((c) => c.status === 'invited' && !c.mine)
  const together = data.collabs.filter((c) => c.status === 'accepted')
  const waiting = data.collabs.filter((c) => c.status === 'invited' && c.mine)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        {invites.length > 0 && (
          <div>
            <h4 className="mb-2 font-semibold text-slate-900">Invitations</h4>
            <ul className="space-y-2">
              {invites.map((c) => (
                <li key={c.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-slate-900"><span className="font-semibold">{c.with.name}</span> asked you to work on “{c.goal}” together.</p>
                  {c.note && <p className="text-sm text-slate-800">“{c.note}”</p>}
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => respond(c, true)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Accept</button>
                    <button type="button" onClick={() => respond(c, false)} className={quiet}>Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h4 className="mb-2 font-semibold text-slate-900">Working on together</h4>
          {together.length === 0 ? <p className="text-sm text-slate-700">Nothing yet. Invite someone to one of your goals.</p> : (
            <ul className="space-y-2">
              {together.map((c) => (
                <li key={c.id} className={card}>
                  <p className="font-semibold text-slate-900">{c.goal}</p>
                  <p className="text-sm text-slate-800">With {c.with.name}{c.mine ? '' : ` (their goal)`}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/friend/${c.with.id}`} className={quiet}>See their progress</Link>
                    <Link href={`/hare-world/messages?with=${c.with.id}`} className={quiet}>Message</Link>
                    <button type="button" onClick={() => leave(c)} className={quiet}>Stop</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {waiting.length > 0 && <p className="text-sm text-slate-700">Waiting for an answer: {waiting.map((c) => `${c.with.name} (${c.goal})`).join(', ')}.</p>}
        <Status text={status} />
      </div>
      <div className={card}>
        <h4 className="mb-2 font-semibold text-slate-900">Invite someone to a goal</h4>
        {people.length ? <CollabForm people={people} goals={goals} onSent={reload} /> : <p className="text-sm text-slate-700">Connect with someone first.</p>}
      </div>
    </div>
  )
}

// ── The panel ────────────────────────────────────────────────────────────
export default function SocialHub({ goals }: { goals: string[] }) {
  const [tab, setTab] = useState<TabId>('updates')
  const [people, setPeople] = useState<Person[]>([])
  const [unread, setUnread] = useState(0)
  const [messagesOn, setMessagesOn] = useState<boolean | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    fetch('/api/social/messages', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        setPeople(j.people || [])
        setMessagesOn(Boolean(j.available))
        setUnread((j.conversations || []).reduce((n: number, c: { unread: number }) => n + (c.unread || 0), 0))
      })
      .catch(() => {})
    // Links such as /hare-world#calls open that part.
    const hash = window.location.hash.replace('#', '')
    if (TABS.some((t) => t.id === hash)) {
      setTab(hash as TabId)
      setTimeout(() => rootRef.current?.scrollIntoView({ block: 'start' }), 300)
    }
  }, [])

  // Arrow keys move between the tabs (the ARIA tabs pattern).
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[TABS[next].id]?.focus()
  }

  const panels: Record<TabId, ReactNode> = {
    updates: <Updates />,
    notes: <Notes people={people} />,
    memes: <Memes />,
    calls: <Calls people={people} />,
    tasks: <Tasks people={people} />,
    together: <Together people={people} goals={goals} />,
  }

  return (
    <section ref={rootRef} id="together-with-your-people" aria-labelledby="social-hub-heading" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="social-hub-heading" className="text-lg font-bold text-slate-900">With your people</h3>
        <Link href="/hare-world/messages" className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Messages{messagesOn && unread > 0 ? ` (${unread} new)` : ''}
        </Link>
      </div>
      <div role="tablist" aria-label="With your people" className="mt-4 flex flex-wrap gap-2" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el }}
            id={`social-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`social-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`social-panel-${tab}`} role="tabpanel" aria-labelledby={`social-tab-${tab}`} tabIndex={0} className="mt-4 focus:outline-none">
        {panels[tab]}
      </div>
    </section>
  )
}
