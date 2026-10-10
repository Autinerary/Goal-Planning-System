'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Goals you're working on with someone (Riipen Labs, Group 34: "Collab" on
 * races; STEP 66), on Races. Shows only when there is at least one.
 */

type Collab = { id: string; goal: string; status: string; mine: boolean; with: { id: string; name: string } }

export default function GoalsTogether({ day }: { day: boolean }) {
  const [collabs, setCollabs] = useState<Collab[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/social/collabs', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.available) setCollabs((j.collabs as Collab[]).filter((c) => c.status === 'accepted')) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!collabs.length) return null
  return (
    <section aria-labelledby="goals-together-heading" className={`mx-auto mt-4 w-full max-w-3xl rounded-2xl border p-4 ${day ? 'border-purple-200 bg-white/90' : 'border-indigo-700 bg-indigo-950/80'}`}>
      <h2 id="goals-together-heading" className={`font-semibold ${day ? 'text-slate-900' : 'text-white'}`}>Goals you’re working on together</h2>
      <ul className="mt-2 space-y-1">
        {collabs.map((c) => (
          <li key={c.id} className={`text-sm ${day ? 'text-slate-800' : 'text-indigo-100'}`}>
            <span className="font-semibold">{c.goal}</span>, with {c.with.name}{c.mine ? '' : ' (their goal)'}.{' '}
            <Link href={`/friend/${c.with.id}`} className={`font-medium underline underline-offset-2 ${day ? 'text-purple-800' : 'text-purple-200'}`}>See their progress</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
