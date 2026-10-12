'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { goHubHref } from '@/lib/serviceHub'
import { searchPath } from '@/lib/startHere'
import { KIT_PROGRESS_KEY, kitDate, type StarterKit } from '@/lib/starterKits'
import { DisplayButton, DisplayPanel, useDisplayToggle } from '../components/DisplayToggle'

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')
const linkClass = 'font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950'

function readProgress(): Record<string, number[]> {
  try {
    const v = JSON.parse(localStorage.getItem(KIT_PROGRESS_KEY) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/**
 * One starter kit (lib/starterKits.ts): its steps as a checklist kept on this
 * device, the places in ResourceHub that can help, and who wrote it, from
 * what, when it was checked, and whether anyone has reviewed it (Riipen Labs,
 * Group 24: authorship, disclaimers and a "Clinically Reviewed" stamp only
 * once a real reviewer has read it).
 */
export default function KitView({ kit }: { kit: StarterKit }) {
  const { user } = useAuth()
  const display = useDisplayToggle()
  const [done, setDone] = useState<number[]>([])
  useEffect(() => { setDone(readProgress()[kit.id] || []) }, [kit.id])
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i]
    setDone(next)
    try { localStorage.setItem(KIT_PROGRESS_KEY, JSON.stringify({ ...readProgress(), [kit.id]: next })) } catch {}
  }
  const hubHref = (path: string) => (user ? goHubHref(path) : `${HUB}${path}`)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/kits" className={`text-sm ${linkClass}`}>All starter kits</Link>
        <DisplayButton open={display.open} onToggle={display.toggle} />
      </div>
      {display.open && <DisplayPanel onClose={display.close} visitor={!user} />}

      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Starter kit · {kit.forWhom}</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{kit.title}</h1>
      <p className="mt-2 text-slate-800">{kit.summary}</p>

      {/* Who wrote it, from what, when (NN/G's authorship and disclaimers). */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
        {kit.review ? (
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Reviewed by {kit.review.by}, {kit.review.role}, on {kitDate(kit.review.on)}
          </p>
        ) : null}
        <p className={kit.review ? 'mt-1' : ''}>
          Written by the Autinerary team from the Government of Ontario&apos;s own pages, checked {kitDate(kit.checked)}.
          {!kit.review && ' Not yet reviewed by a clinician or advocate.'}
        </p>
        <p className="mt-1">General information, not medical or legal advice. Rules and services change, so check the linked pages, or ask your doctor or school board.</p>
      </div>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Step by step</h2>
      <p className="mt-1 text-sm text-slate-700">Tick a step when it&apos;s done. Your ticks stay on this device. Do them in any order.</p>
      <p role="status" className="mt-1 text-sm font-medium text-slate-800">{done.length} of {kit.steps.length} done</p>
      <ol className="mt-3 space-y-3">
        {kit.steps.map((step, i) => {
          const on = done.includes(i)
          return (
            <li key={step.title} className={`rounded-xl border p-4 ${on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={on} onChange={() => toggle(i)} className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400 text-emerald-700" />
                <span>
                  <span className="font-semibold text-slate-900">{i + 1}. {step.title}</span>
                  <span className="mt-1 block text-slate-800">{step.body}</span>
                </span>
              </label>
              {step.link && (
                <a href={step.link.href} target="_blank" rel="noopener noreferrer" className={`ml-8 mt-2 inline-flex items-center gap-1 text-sm ${linkClass}`}>
                  {step.link.label} <ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </li>
          )
        })}
      </ol>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Places that can help</h2>
      <ul className="mt-3 space-y-2">
        {kit.places.map((place) => (
          <li key={place.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <a href={hubHref(searchPath(place.params))} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${linkClass}`}>
              {place.label} <ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens ResourceHub in a new tab)</span>
            </a>
            <p className="mt-1 text-sm text-slate-700">{place.detail}</p>
          </li>
        ))}
        <li className="rounded-xl border border-slate-200 bg-white p-4">
          <a href={hubHref('/community')} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${linkClass}`}>
            Ask other parents in Tidbits <ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens ResourceHub in a new tab)</span>
          </a>
          <p className="mt-1 text-sm text-slate-700">For example: “{kit.ask}”{!user && ' A free account is needed to ask.'}</p>
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Sources</h2>
      <ul className="mt-2 space-y-1 text-sm text-slate-800">
        {kit.sources.map((src) => (
          <li key={src.href}>
            <a href={src.href} target="_blank" rel="noopener noreferrer" className={linkClass}>{src.title}</a>, {src.publisher}, updated {src.updated}.
          </li>
        ))}
      </ul>

      <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800">
        Need help right now? <Link href="/help#talk-now" className={linkClass}>Who to call, free and at any time</Link>.
      </p>
      <p className="mt-6 text-sm">
        {user ? <Link href="/path" className={linkClass}>Back to your Path</Link> : <Link href="/start" className={linkClass}>More starter resources</Link>}
      </p>
    </main>
  )
}
