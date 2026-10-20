'use client'

import { useEffect, useState } from 'react'
import { StickyNote, Trash2 } from 'lucide-react'
import { noteKindLabel, type FutureNote } from '@/lib/moments'
import { playPageTurnSound } from '@/lib/taskSound'

/**
 * Quick Note to Self, in the Journal (the team's notes, October 2026: "Move
 * 'Memory' here, as the third option beside New Entry and All Entries, and
 * change its name to 'Quick Note to Self' ... and add where this will show up
 * in the app later"). Notes are saved with your account (STEP 87,
 * future_notes) and only you can read them.
 */
export default function QuickNoteToSelf() {
  const [notes, setNotes] = useState<FutureNote[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [text, setText] = useState('')
  const [later, setLater] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = () =>
    fetch('/api/future-notes', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setAvailable(d.available !== false)
        setNotes(d.notes || [])
      })
      .catch(() => setNotes([]))

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/future-notes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'note', body: text, later }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'Your note could not be saved.')
      playPageTurnSound()
      setText('')
      setNotes((list) => [d.note, ...(list || [])])
      setMessage(later ? 'Saved. It will be waiting for you the next time you open a task.' : 'Saved.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Your note could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const res = await fetch('/api/future-notes', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setNotes((list) => (list || []).filter((n) => n.id !== id))
  }

  if (!available) {
    return <p className="rounded-xl border border-slate-300 bg-white p-4 text-slate-800">Quick notes to yourself open soon.</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="quick-note" className="block text-lg font-bold text-slate-900">
          A quick note to yourself
        </label>
        <p id="quick-note-hint" className="mt-1 text-sm text-slate-700">
          A thought to keep, a reminder, or something to tell future you.
        </p>
        <textarea
          id="quick-note"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          rows={4}
          aria-describedby="quick-note-hint quick-note-where"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Remember to…"
        />
        <label className="mt-2 flex items-start gap-2 text-sm text-slate-800">
          <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} className="mt-0.5 h-4 w-4" />
          Bring it back to me the next time I open a task
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || !text.trim()}
            className="rounded-xl bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save note'}
          </button>
          <span className="text-xs text-slate-700">{text.length}/1000</span>
        </div>
        {message && (
          <p role="status" className="mt-2 text-sm text-slate-900">
            {message}
          </p>
        )}
      </div>

      <div id="quick-note-where" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-900">
        <p className="font-semibold">Where your notes show up</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Here, in your Journal, under Quick Note to Self.</li>
          <li>On the Task View, under “From past you”, the next time you open a task (when you tick the box above).</li>
          <li>In Hare World, on your Memories page, with the notes you write when you stop a task.</li>
        </ul>
        <p className="mt-2">Only you can read them.</p>
      </div>

      <section aria-labelledby="my-notes">
        <h2 id="my-notes" className="flex items-center gap-2 text-base font-bold text-slate-900">
          <StickyNote className="h-4 w-4" aria-hidden="true" /> Your notes
        </h2>
        {notes === null ? (
          <p className="mt-2 text-sm text-slate-700">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-700">No notes yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-700">
                    {noteKindLabel(n.kind)}
                    {n.task_title ? ` · ${n.task_title}` : ''} · {new Date(n.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-slate-900">{n.body}</p>
                </div>
                <button type="button" onClick={() => remove(n.id)} aria-label="Delete this note" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-red-700">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
