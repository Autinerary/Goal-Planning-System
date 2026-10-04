'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * "Start here" on the home page (Riipen Labs, Group 3: there is no clear "step
 * one"; "create an introduction/starter page that asks users if they are a
 * parent, neurodivergent individual, or an ally"). Choosing shows what
 * Autinerary does for that person, and setup then starts with the same answer
 * already chosen (the onboarding page reads autinerary_start_for), so nobody
 * is asked twice.
 */

const KEY = 'autinerary_start_for'

const ROLES: { id: string; label: string; points: string[] }[] = [
  {
    id: 'self',
    label: 'Myself',
    points: [
      'Turn one goal into small, clear steps.',
      'Plan the steps around your energy, on a calendar.',
      'Find services and places rated by people with similar norms.',
    ],
  },
  {
    id: 'child',
    label: 'My child',
    points: [
      'Make a plan for a goal you are working on together, in small steps.',
      'Find services and places, rated by people with similar norms.',
      'If your child is under 18, add them from the Family page after you sign up.',
    ],
  },
  {
    id: 'family',
    label: 'Another family member or a friend',
    points: [
      'Make a plan for a goal you are helping with.',
      'Find services and places that fit how they work.',
      'Ask questions and read answers from people with similar experiences.',
    ],
  },
  {
    id: 'work',
    label: 'Someone I teach, support or work with',
    points: [
      'Make a plan for a goal you are helping with.',
      'Find tools and services to recommend.',
      'Learn from questions and answers by people with lived experience.',
    ],
  },
  {
    id: 'ally',
    label: "I'm an ally, or just learning",
    points: [
      'Read questions and answers from neurodivergent people and their families.',
      'Browse services and places, and what people say about them.',
      'Start a plan of your own whenever you like.',
    ],
  },
]

export default function StartHere() {
  const [chosen, setChosen] = useState<string>('')
  const role = ROLES.find((r) => r.id === chosen)

  const choose = (id: string) => {
    setChosen(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {}
  }

  return (
    <section className="border-t border-slate-200 bg-white px-4 py-12 md:py-16" aria-labelledby="start-heading">
      <div className="mx-auto max-w-3xl">
        <h2 id="start-heading" className="text-2xl font-bold md:text-3xl">
          Start here: who are you here for?
        </h2>
        <p className="mt-2 text-slate-700">Choose one to see what Autinerary does for you. You can change it later.</p>

        <fieldset className="mt-6">
          <legend className="sr-only">Who are you here for?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <label
                key={r.id}
                className={`cursor-pointer rounded-xl border px-4 py-3 font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                  chosen === r.id ? 'border-indigo-700 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
                }`}
              >
                <input type="radio" name="start-for" value={r.id} checked={chosen === r.id} onChange={() => choose(r.id)} className="sr-only" />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        {role && (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5" aria-live="polite">
            <h3 className="font-semibold text-indigo-950">What you can do</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-800">
              {role.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800"
            >
              Create your free account
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <p className="mt-2 text-sm text-slate-700">Setup will start with this already chosen.</p>
          </div>
        )}
      </div>
    </section>
  )
}
