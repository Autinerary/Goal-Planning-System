'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, Users, GalleryVerticalEnd as Images } from 'lucide-react'
import type { Moment } from '@/lib/moments'
import MomentCard from './MomentCard'

/**
 * Hare World Social (the team's notes, October 2026: "Video-ify / social
 * media-ify the app ... a 'Reels'/Posts feed for progress with the highest
 * trending photos/videos. Make this a core part of Hare World"). Moments from
 * finishing tasks and milestones: the most cheered lately (Trending), or your
 * people's, newest first. Your own are in Memories.
 */
export default function HareWorldSocial() {
  const [scope, setScope] = useState<'trending' | 'people'>('trending')
  const [moments, setMoments] = useState<Moment[] | null>(null)
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    setMoments(null)
    fetch(`/api/moments?scope=${scope}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { moments: [] }))
      .then((d) => {
        setAvailable(d.available !== false)
        setMoments(d.moments || [])
      })
      .catch(() => setMoments([]))
  }, [scope])

  return (
    <section aria-labelledby="social-heading" className="space-y-4" data-hare-world-social>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="social-heading" className="text-xl font-bold text-slate-900">
            Hare World Social
          </h2>
          <p className="text-sm text-slate-800">The real journeys behind the wins: moments from finishing tasks and milestones, mess-ups and beginnings included.</p>
        </div>
        <Link href="/hare-world/memories" className="inline-flex items-center gap-2 rounded-xl border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-900 hover:bg-purple-50">
          <Images className="h-4 w-4" aria-hidden="true" /> Your Memories
        </Link>
      </div>

      <div role="group" aria-label="Which moments" className="flex flex-wrap gap-2">
        {(
          [
            ['trending', 'Trending', Flame],
            ['people', 'Your people', Users],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={scope === id}
            onClick={() => setScope(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${scope === id ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {!available ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900">Hare World Social opens soon.</p>
      ) : moments === null ? (
        <p className="text-sm text-slate-700">Loading…</p>
      ) : moments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="font-semibold text-slate-900">{scope === 'people' ? 'Nothing from your people yet.' : 'No moments to show yet.'}</p>
          <p className="mt-1 text-sm text-slate-800">
            When you finish a task or a milestone, you can capture the moment with a photo, a video or a few words, and choose who sees it.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moments.map((m) => (
            <MomentCard key={m.id} moment={m} />
          ))}
        </div>
      )}
    </section>
  )
}
