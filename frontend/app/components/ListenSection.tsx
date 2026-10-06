'use client'

import { useEffect, useState } from 'react'
import { Headphones } from 'lucide-react'
import MediaPlayer from './MediaPlayer'
import { EPISODES, lengthLabel } from '@/lib/media'

const LATER_KEY = 'autinerary_listen_later'

/**
 * "Listen" on the home page: up to two podcast episodes (Riipen Labs, Group
 * 11: "1-2 free on the homepage and a 'resume' or 'remind me later'
 * option"). Shown only once there is an episode in lib/media.ts. Each picks
 * up where it was left; "Remind me later" keeps it at the top of this
 * section, with a note, on the next visit.
 */
export default function ListenSection() {
  const [later, setLater] = useState<string | null>(null)
  useEffect(() => {
    try {
      setLater(localStorage.getItem(LATER_KEY))
    } catch {}
  }, [])

  if (EPISODES.length === 0) return null
  const remind = (id: string | null) => {
    try {
      if (id) localStorage.setItem(LATER_KEY, id)
      else localStorage.removeItem(LATER_KEY)
    } catch {}
    setLater(id)
  }
  const waiting = EPISODES.find((e) => e.id === later)
  const shown = waiting ? [waiting, ...EPISODES.filter((e) => e !== waiting)].slice(0, 2) : EPISODES.slice(0, 2)

  return (
    <section className="border-t border-slate-200 bg-white px-4 py-12 md:py-16" aria-labelledby="listen-heading">
      <div className="mx-auto max-w-3xl">
        <h2 id="listen-heading" className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <Headphones className="h-6 w-6 text-indigo-700" aria-hidden="true" /> Listen
        </h2>
        <p className="mt-2 text-slate-700">Stories and practical tips, about 10 minutes each. Each one picks up where you left off.</p>
        {waiting && (
          <p role="status" className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-slate-800">
            Your episode is waiting: &ldquo;{waiting.title}&rdquo;.{' '}
            <button type="button" onClick={() => remind(null)} className="font-medium text-indigo-800 underline underline-offset-2">
              Not now
            </button>
          </p>
        )}
        <ul className="mt-6 space-y-8">
          {shown.map((episode) => (
            <li key={episode.id}>
              <MediaPlayer item={episode} resume />
              {later !== episode.id && (
                <button type="button" onClick={() => remind(episode.id)} className="mt-2 text-sm font-medium text-indigo-800 underline underline-offset-2">
                  Remind me later ({lengthLabel(episode.seconds)})
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
