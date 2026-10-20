'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { alike } from '@/lib/sameGoals'

/**
 * "Person's Icon @ Goal: see who's going for the same goals" (Hare World):
 * your people working on a goal like yours, as icons beside it. Only people
 * who share their path with you count (STEP 87). One request per page, shared
 * by every goal that asks.
 */

interface GoalPeople {
  goal: string
  people: { id: string; name: string; icon: string; their_goal: string }[]
}

let loading: Promise<GoalPeople[]> | null = null
function sameGoals(): Promise<GoalPeople[]> {
  if (!loading) {
    loading = fetch('/api/social/same-goals', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { goals: [] }))
      .then((d) => (d.goals || []) as GoalPeople[])
      .catch(() => [])
  }
  return loading
}

/** Icons of your people on a goal like `goal`, linking to their pages. */
export function PeopleOnGoal({ goal }: { goal: string }) {
  const [people, setPeople] = useState<GoalPeople['people']>([])
  useEffect(() => {
    let live = true
    sameGoals().then((all) => {
      if (!live) return
      const match = all.find((g) => alike(g.goal, goal))
      setPeople(match?.people || [])
    })
    return () => {
      live = false
    }
  }, [goal])
  if (!people.length) return null
  return (
    <span className="inline-flex items-center gap-1" data-people-on-goal>
      <span className="sr-only">Also working on this:</span>
      {people.slice(0, 4).map((p) => (
        <Link key={p.id} href={`/friend/${p.id}`} title={`${p.name}: ${p.their_goal}`} aria-label={`${p.name} is working on ${p.their_goal}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-purple-100 text-sm shadow-sm hover:bg-purple-200">
          {p.icon}
        </Link>
      ))}
      {people.length > 4 && <span className="text-xs text-slate-700">+{people.length - 4}</span>}
    </span>
  )
}

/** Hare World's list: each of your goals that your people share. */
export default function SameGoals() {
  const [goals, setGoals] = useState<GoalPeople[] | null>(null)
  useEffect(() => {
    sameGoals().then((all) => setGoals(all.filter((g) => g.people.length)))
  }, [])
  if (!goals || goals.length === 0) return null
  return (
    <section aria-labelledby="same-goals" className="bg-white rounded-2xl border border-purple-200 p-6 shadow-sm" data-same-goals>
      <h3 id="same-goals" className="text-lg font-bold text-slate-900">
        Your people on the same goals
      </h3>
      <p className="text-sm text-slate-800">People you’re connected to, working on goals like yours.</p>
      <ul className="mt-3 space-y-2">
        {goals.map((g) => (
          <li key={g.goal} className="flex flex-wrap items-center gap-2 rounded-xl bg-purple-50 px-3 py-2">
            <span className="min-w-0 flex-1 font-medium text-slate-900">{g.goal}</span>
            <span className="flex flex-wrap gap-1">
              {g.people.map((p) => (
                <Link key={p.id} href={`/friend/${p.id}`} className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-white px-2 py-0.5 text-sm text-purple-950 hover:bg-purple-100">
                  {p.icon} {p.name}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
