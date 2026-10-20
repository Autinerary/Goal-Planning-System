'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Shared challenges: goals you're working on with someone (Riipen Labs,
 * Group 34: "Collab" on races; STEP 66). The team's notes, October 2026:
 * "'Shared Challenges' should be a unique color & highlighted as a 'shared
 * challenge'". Teal is theirs alone on Races: the section, and a badge on
 * each race that is one. Shows only when there is at least one.
 */

export type Collab = { id: string; goal: string; status: string; mine: boolean; with: { id: string; name: string } }

let once: Promise<Collab[]> | null = null
function loadCollabs(): Promise<Collab[]> {
  if (!once) {
    once = fetch('/api/social/collabs', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.available ? (j.collabs as Collab[]).filter((c) => c.status === 'accepted') : []))
      .catch(() => [])
  }
  return once
}

/** The accepted shared challenges, read once per page. */
export function useSharedChallenges(enabled = true): Collab[] {
  const [collabs, setCollabs] = useState<Collab[]>([])
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadCollabs().then((c) => { if (!cancelled) setCollabs(c) })
    return () => { cancelled = true }
  }, [enabled])
  return collabs
}

const norm = (s: string) => s.trim().toLowerCase()

/** The shared challenge a race (by its goal) is, if any. */
export function sharedFor(goal: string | null | undefined, collabs: readonly Collab[]): Collab | null {
  if (!goal) return null
  const g = norm(goal)
  return collabs.find((c) => norm(c.goal) === g) || null
}

/** The badge on a race that is a shared challenge. */
export function SharedBadge({ collab, small = false }: { collab: Collab; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-teal-700 font-bold text-white ${small ? 'px-1.5 py-0.5 text-[0.5625rem]' : 'px-2 py-0.5 text-xs'}`} title={`Shared with ${collab.with.name}`}>
      <span aria-hidden="true">🤝</span> Shared challenge
    </span>
  )
}

export default function GoalsTogether({ day, collabs }: { day: boolean; collabs: Collab[] }) {
  if (!collabs.length) return null
  return (
    <section
      aria-labelledby="shared-challenges-heading"
      className={`mx-auto mt-4 w-full max-w-3xl rounded-2xl border-2 p-4 ${day ? 'border-teal-500 bg-teal-50' : 'border-teal-400 bg-teal-950/80'}`}
      data-shared-challenges
    >
      <h2 id="shared-challenges-heading" className={`flex items-center gap-2 font-bold ${day ? 'text-teal-950' : 'text-teal-50'}`}>
        <span aria-hidden="true">🤝</span> Shared challenges
      </h2>
      <ul className="mt-2 space-y-2">
        {collabs.map((c) => (
          <li key={c.id} className={`flex flex-wrap items-center gap-2 text-sm ${day ? 'text-teal-950' : 'text-teal-50'}`}>
            <SharedBadge collab={c} small />
            <span className="font-semibold">{c.goal}</span>
            <span>with {c.with.name}{c.mine ? '' : ' (their goal)'}.</span>
            <Link href={`/friend/${c.with.id}`} className={`font-medium underline underline-offset-2 ${day ? 'text-teal-900' : 'text-teal-100'}`}>See their progress</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
