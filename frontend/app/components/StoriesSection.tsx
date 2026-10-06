'use client'

import { useEffect, useState } from 'react'
import { Quote } from 'lucide-react'

/**
 * "In their words" on the home page: up to three stories that people shared,
 * approved word for word and agreed to show here (Riipen Labs, Group 11:
 * lived-experience testimonials, shared with consent; app/api/stories).
 * Nothing shows until there is one: Autinerary never writes stand-ins.
 */
export default function StoriesSection() {
  const [stories, setStories] = useState<{ id: string; text: string; byline: string }[]>([])
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
            <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <Quote className="h-5 w-5 text-indigo-700" aria-hidden="true" />
              <blockquote className="mt-2 whitespace-pre-line text-slate-800">{s.text}</blockquote>
              <p className="mt-3 text-sm font-semibold text-slate-900">{s.byline}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
