'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { noteKindLabel, type FutureNote } from '@/lib/moments'

/**
 * "From past you" on the Task View: the notes you left yourself when you
 * stopped a task, and the quick notes you asked to see again (STEP 87). Each
 * goes away once you say you've read it.
 */
export default function PastYouNotes() {
  const [notes, setNotes] = useState<FutureNote[]>([])

  useEffect(() => {
    fetch('/api/future-notes?due=1', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNotes((d?.notes || []).slice(0, 3)))
      .catch(() => null)
  }, [])

  const seen = async (id: string) => {
    setNotes((list) => list.filter((n) => n.id !== id))
    await fetch('/api/future-notes', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, seen: true }) }).catch(() => null)
  }

  if (!notes.length) return null
  return (
    <section aria-labelledby="past-you" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <h2 id="past-you" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo-900">
        <Mail className="h-4 w-4" aria-hidden="true" /> From past you
      </h2>
      <ul className="mt-2 space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl bg-white p-3">
            <p className="text-xs text-slate-700">
              {noteKindLabel(n.kind)}
              {n.task_title ? ` · ${n.task_title}` : ''} · {new Date(n.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-900">{n.body}</p>
            <button type="button" onClick={() => seen(n.id)} className="mt-2 text-sm font-semibold text-indigo-800 underline">
              Got it
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
