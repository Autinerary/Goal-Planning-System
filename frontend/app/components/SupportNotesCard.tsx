'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'

/**
 * New notes of support, on the Path (Riipen Labs, Group 34; STEP 66): the
 * ones from the last two weeks you haven't opened yet. Nothing shows when
 * there are none, or before STEP 66 is applied.
 */

type Note = { id: string; from: { id: string; name: string }; content: string; created_at: string; read_at: string | null }

export default function SupportNotesCard() {
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/social/messages?notes=1', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.available) return
        const since = Date.now() - 14 * 86400000
        setNotes((j.notes as Note[]).filter((n) => !n.read_at && Date.parse(n.created_at) > since).slice(0, 2))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!notes.length) return null
  return (
    <section aria-labelledby="support-notes-heading" className="mb-6 rounded-2xl border border-pink-200 bg-pink-50 p-4">
      <h2 id="support-notes-heading" className="flex items-center gap-2 font-semibold text-slate-900">
        <Heart className="h-4 w-4 text-pink-700" aria-hidden="true" /> {notes.length === 1 ? 'A note of support for you' : 'Notes of support for you'}
      </h2>
      <ul className="mt-2 space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="text-sm text-slate-900">
            “{n.content}” <span className="text-slate-700">from {n.from.name}.</span>{' '}
            <Link href={`/hare-world/messages?with=${n.from.id}`} className="font-medium text-purple-800 underline underline-offset-2">Reply</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
