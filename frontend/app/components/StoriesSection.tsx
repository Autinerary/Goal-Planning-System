'use client'

import { useEffect, useState } from 'react'
import { Headphones, Play, Quote } from 'lucide-react'
import MediaPlayer from './MediaPlayer'
import { STORY_RECORDINGS, lengthLabel } from '@/lib/media'

type Story = { id: string; text: string; byline: string }

/**
 * "In their words" on the home page: up to three stories that people shared,
 * approved word for word and agreed to show here (Riipen Labs, Group 11:
 * lived-experience testimonials, shared with consent; app/api/stories).
 * Nothing shows until there is one: Autinerary never writes stand-ins.
 *
 * Every story is shown as text. One the team also recorded with its teller
 * (STORY_RECORDINGS, lib/media.ts) has a button to watch or listen, so each
 * visitor can take it in the way they prefer.
 */
export default function StoriesSection() {
  const [stories, setStories] = useState<Story[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/stories')
      .then((res) => (res.ok ? res.json() : { stories: [] }))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.stories)) setStories(json.stories)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (stories.length === 0) return null
  return (
    <section className="border-t border-slate-200 bg-white px-4 py-12 md:py-16" aria-labelledby="stories-heading">
      <div className="mx-auto max-w-5xl">
        <h2 id="stories-heading" className="text-2xl font-bold md:text-3xl">In their words</h2>
        <p className="mt-2 text-slate-700">From people using Autinerary, shared with their permission and approved by them.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function StoryCard({ story }: { story: Story }) {
  const recording = STORY_RECORDINGS[story.id]
  const [open, setOpen] = useState(false)
  const verb = recording?.kind === 'video' ? 'Watch' : 'Listen'
  const Icon = recording?.kind === 'video' ? Play : Headphones
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <Quote className="h-5 w-5 text-indigo-700" aria-hidden="true" />
      <blockquote className="mt-2 whitespace-pre-line text-slate-800">{story.text}</blockquote>
      <p className="mt-3 text-sm font-semibold text-slate-900">{story.byline}</p>
      {recording && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={`story-${story.id}-recording`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {open ? `Hide the ${recording.kind === 'video' ? 'video' : 'recording'}` : `${verb} (${lengthLabel(recording.seconds)})`}
          </button>
          {open && (
            <div id={`story-${story.id}-recording`} className="mt-3">
              <MediaPlayer item={recording} />
            </div>
          )}
        </>
      )}
    </li>
  )
}
