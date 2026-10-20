'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GalleryVerticalEnd as Images, StickyNote } from 'lucide-react'
import BackButton from '../../components/BackButton'
import MomentCard from '../MomentCard'
import { noteKindLabel, type FutureNote, type Moment } from '@/lib/moments'

/**
 * Your Memories (Hare World Social; the team's notes, October 2026: "give
 * each user a 'Memories' profile, with a collection of all those
 * photos/videos ... the caption & the task/milestone it was associated
 * with"). With the notes you left future you (when you stopped a task, and
 * your Journal's Quick Notes to Self). Only you see this page; each moment
 * says who else can see it, and you can change that.
 */
export default function MemoriesPage() {
  const [moments, setMoments] = useState<Moment[] | null>(null)
  const [notes, setNotes] = useState<FutureNote[]>([])
  const [available, setAvailable] = useState(true)
  const [tab, setTab] = useState<'moments' | 'notes'>('moments')

  useEffect(() => {
    fetch('/api/moments?scope=mine', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { moments: [] }))
      .then((d) => {
        setAvailable(d.available !== false)
        setMoments(d.moments || [])
      })
      .catch(() => setMoments([]))
    fetch('/api/future-notes', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((d) => setNotes(d.notes || []))
      .catch(() => null)
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <BackButton fallback="/hare-world?view=social" />
        <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          <Images className="h-7 w-7 text-purple-700" aria-hidden="true" /> Your Memories
        </h1>
        <p className="mt-1 text-sm text-slate-800">
          Your moments from finishing tasks and milestones, and the notes you left yourself. Only you see this page; each moment says who else can see it.
        </p>

        <div role="group" aria-label="Show" className="mt-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={tab === 'moments'} onClick={() => setTab('moments')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'moments' ? 'bg-purple-700 text-white' : 'bg-white text-slate-800 border border-slate-300'}`}>
            Moments{moments ? ` (${moments.length})` : ''}
          </button>
          <button type="button" aria-pressed={tab === 'notes'} onClick={() => setTab('notes')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'notes' ? 'bg-purple-700 text-white' : 'bg-white text-slate-800 border border-slate-300'}`}>
            Notes to future you ({notes.length})
          </button>
        </div>

        {tab === 'moments' ? (
          !available ? (
            <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-slate-900">Memories open soon.</p>
          ) : moments === null ? (
            <p className="mt-6 text-slate-700">Loading…</p>
          ) : moments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <p className="font-semibold text-slate-900">No moments yet.</p>
              <p className="mt-1 text-sm text-slate-800">When you finish a task or a milestone, “Capture this moment” lets you keep a photo, a video or a few words about how you got there.</p>
              <Link href="/calendar" className="mt-3 inline-block rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
                Go to today’s tasks
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {moments.map((m) => (
                <MomentCard key={m.id} moment={m} onRemove={(id) => setMoments((list) => (list || []).filter((x) => x.id !== id))} />
              ))}
            </div>
          )
        ) : notes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">No notes yet.</p>
            <p className="mt-1 text-sm text-slate-800">
              Write one from a task (“Stop for now”) or in your Journal (
              <Link href="/reflection?mode=note" className="font-medium text-indigo-800 underline underline-offset-2">
                Quick Note to Self
              </Link>
              ).
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="flex items-center gap-2 text-xs text-slate-700">
                  <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                  {noteKindLabel(n.kind)}
                  {n.task_title ? ` · ${n.task_title}` : ''} · {new Date(n.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="mt-1 whitespace-pre-line text-slate-900">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
