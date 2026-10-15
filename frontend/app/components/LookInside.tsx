'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { track } from '@/lib/funnel'

export interface InsideShot {
  id: 'path' | 'step' | 'calendar' | 'resourcehub'
  /** The tab's name. */
  title: string
  src: string
  alt: string
  /** What you do there, in a sentence or two. */
  detail: string
}

/**
 * A look inside, one screen at a time, chosen by the visitor (Riipen Labs,
 * Group 12: "a short, guided demo paired with a more flexible, self-paced
 * onboarding flow, allowing one to choose what they want to explore based on
 * their own needs and interests"; Group 11: "a short visual tour"). The four
 * screens were a grid all at once. Opening one is counted (feature_use
 * inside_<id>), so the funnel report can show Group 12's "how many users went
 * through the demo, where it drops off". Tabs follow the WAI-ARIA pattern:
 * arrow keys, Home and End move between them.
 */
export default function LookInside({ shots }: { shots: InsideShot[] }) {
  const [current, setCurrent] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const open = (i: number, focus = false) => {
    setCurrent(i)
    track('feature_use', `inside_${shots[i].id}`)
    if (focus) tabs.current[i]?.focus()
  }
  const onKey = (e: KeyboardEvent, i: number) => {
    const last = shots.length - 1
    const to = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (to === null) return
    e.preventDefault()
    open(to, true)
  }
  const shot = shots[current]
  const next = current < shots.length - 1 ? shots[current + 1] : null
  return (
    <div className="mt-8">
      <p id="inside-pick" className="font-medium text-slate-900">Pick a part of the app to look at</p>
      <div role="tablist" aria-labelledby="inside-pick" className="mt-2 flex flex-wrap gap-2">
        {shots.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => { tabs.current[i] = el }}
            type="button"
            role="tab"
            id={`inside-tab-${s.id}`}
            aria-selected={i === current}
            aria-controls="inside-panel"
            tabIndex={i === current ? 0 : -1}
            onClick={() => open(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-[2.75rem] rounded-full border-2 px-4 text-sm font-semibold ${i === current ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'}`}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="inside-panel" aria-labelledby={`inside-tab-${shot.id}`} className="mt-5 grid items-start gap-6 md:grid-cols-[280px_1fr]">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={600}
          height={1000}
          sizes="(min-width: 768px) 280px, 70vw"
          className="h-auto w-full max-w-[280px] rounded-xl border border-slate-300 bg-white shadow-sm"
        />
        <div>
          <h3 className="text-xl font-bold">{shot.title}</h3>
          <p className="mt-2 text-lg text-slate-700">{shot.detail}</p>
          <p className="mt-4 text-sm text-slate-700">{current + 1} of {shots.length}</p>
          {next ? (
            <button
              type="button"
              onClick={() => open(current + 1, true)}
              className="mt-2 min-h-[2.75rem] rounded-lg border-2 border-indigo-700 bg-white px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-50"
            >
              Next: {next.title}
            </button>
          ) : (
            <p className="mt-2 text-slate-800">
              That is all four.{' '}
              <a href="#start" className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">Find starter resources</a>
              {' '}or{' '}
              <Link href="/signup" className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">create your free account</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
