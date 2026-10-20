'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { NOTE_KINDS, type FutureNoteKind } from '@/lib/moments'
import { playPageTurnSound } from '@/lib/taskSound'

/**
 * "Stop a task and write a message to your future self, to do better, keep
 * doing good, or remember that today (to be yesterday) walked so that
 * tomorrow (to be today) could run" (Hare World Social, the team's notes,
 * October 2026). It comes back on the Task View from tomorrow, and is in your
 * Journal's Quick Note to Self and your Memories. Only you can read it.
 */
export default function NoteToFutureSelf({
  open,
  taskRef,
  taskTitle,
  onClose,
}: {
  open: boolean
  taskRef?: string
  taskTitle?: string
  onClose: (saved: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<Exclude<FutureNoteKind, 'note'>>('remember_today')
  const [body, setBody] = useState(NOTE_KINDS.find((k) => k.id === 'remember_today')!.starter)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  const choose = (k: Exclude<FutureNoteKind, 'note'>) => {
    setKind(k)
    // A fresh starter, unless they've already written their own.
    if (!touched) setBody(NOTE_KINDS.find((x) => x.id === k)!.starter)
  }

  const save = async () => {
    if (busy || !body.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/future-notes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, body, task_ref: taskRef, task_title: taskTitle }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'Your note could not be saved.')
      playPageTurnSound()
      onClose(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your note could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault()
        onClose(false)
      }}
      aria-labelledby="future-note-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-future-note
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="future-note-title" className="text-xl font-bold text-slate-900">
            Stop for now: a note to future you
          </h2>
          <button type="button" onClick={() => onClose(false)} aria-label="Close" className="rounded-lg p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-800">
          Stopping is fine. Leave yourself a note{taskTitle ? ` about “${taskTitle}”` : ''}: it will be waiting for you on your next task, from tomorrow.
        </p>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-slate-900">What kind of note</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {NOTE_KINDS.map((k) => (
              <label key={k.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${kind === k.id ? 'border-indigo-700 bg-indigo-50 font-semibold text-indigo-900' : 'border-slate-300 text-slate-900'}`}>
                <input type="radio" name="note-kind" value={k.id} checked={kind === k.id} onChange={() => choose(k.id as Exclude<FutureNoteKind, 'note'>)} className="sr-only" />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label htmlFor="future-note-body" className="mt-4 block text-sm font-semibold text-slate-900">
          Your note
        </label>
        <textarea
          id="future-note-body"
          value={body}
          onChange={(e) => {
            setTouched(true)
            setBody(e.target.value.slice(0, 1000))
          }}
          rows={5}
          className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-slate-700">Only you can read it. It’s also in your Journal (Quick Note to Self) and your Memories.</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Keep working
          </button>
          <button type="button" onClick={save} disabled={busy || !body.trim()} className="rounded-xl bg-indigo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            {busy ? 'Saving…' : 'Save and stop for now'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
