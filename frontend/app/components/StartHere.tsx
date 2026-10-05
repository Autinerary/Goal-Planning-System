'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { track } from '@/lib/funnel'
import { goHubHref } from '@/lib/serviceHub'
import { savePreferences } from '@/lib/preferences'
import {
  START_ROLES, START_GOALS, START_FOR_KEY, START_NEED_KEY,
  isStartRole, isStartGoal, pathwayFor, pathwayTitle, searchPath,
} from '@/lib/startHere'
import type { StarterItem } from '../api/starter-resources/route'

/**
 * "Start here", on the home page and on its own at /start.
 *
 * Riipen Labs, Group 3: there was no clear "step one". Group 4: a guided,
 * role- and goal-based "Start Here" before the full ecosystem: who you are
 * here for (with "Not sure yet"), what you need today, then a first pathway
 * of real resources with one plain-language explanation and one primary
 * action, "Save this path". No account is needed to see it.
 *
 * One question at a time, with where you are shown above it. Choices are
 * buttons rather than radio buttons, so arrow keys never jump ahead a step.
 * Answers are kept in this browser, setup starts with them (so nobody is
 * asked twice), and they are saved to the account with the path.
 *
 * Campaign links can start part-way: /start?for=child, or
 * /start?for=child&need=services to open straight on a pathway.
 */

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-6 py-3 text-lg font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300'
const CHOICE =
  'w-full rounded-xl border px-4 py-3 text-left font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1'
const TEXT_BUTTON = 'font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950'

type Step = 'role' | 'goal' | 'pathway'

function remember(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {}
}

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export default function StartHere({ standalone = false }: { standalone?: boolean }) {
  const { user } = useAuth()
  const [role, setRole] = useState('')
  const [goal, setGoal] = useState('')
  const [step, setStep] = useState<Step>('role')
  const [items, setItems] = useState<StarterItem[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [useful, setUseful] = useState<'' | 'yes' | 'no'>('')
  const [savedAs, setSavedAs] = useState('')
  const [saveNote, setSaveNote] = useState('')
  const stepHeading = useRef<HTMLHeadingElement>(null)
  // Focus follows the person between steps, never on page load.
  const moved = useRef(false)
  // Once the person has chosen (or a link chose), a saved path never overrides it.
  const decided = useRef(false)

  const roleInfo = START_ROLES.find((r) => r.id === role)
  const goalInfo = START_GOALS.find((g) => g.id === goal)
  const pathway = role && goal ? pathwayFor(role, goal) : null
  const answer = `${role}.${goal}`

  // A campaign link's answers first, then the ones this browser kept.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkRole = params.get('for')
    const linkGoal = params.get('need')
    let r = isStartRole(linkRole) ? linkRole : null
    let g = isStartGoal(linkGoal) ? linkGoal : null
    if (r || g) {
      decided.current = true
      if (r) remember(START_FOR_KEY, r)
      if (g) remember(START_NEED_KEY, g)
      if (r && g) track('start_pathway', `${r}.${g}`)
      // Someone arriving at the home page from a link wants this section.
      if (!standalone) document.getElementById('start')?.scrollIntoView()
    } else {
      const keptRole = recall(START_FOR_KEY)
      const keptGoal = recall(START_NEED_KEY)
      r = isStartRole(keptRole) ? keptRole : null
      g = isStartGoal(keptGoal) ? keptGoal : null
    }
    if (r) setRole(r)
    if (g) setGoal(g)
    setStep(r && g ? 'pathway' : r ? 'goal' : 'role')
  }, [standalone])

  // Signed in: open on the path saved to the account, unless already choosing.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/me/preferences', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const saved = json?.preferences?.startPath
        if (cancelled || !saved || !isStartRole(saved.for) || !isStartGoal(saved.need)) return
        setSavedAs(`${saved.for}.${saved.need}`)
        if (decided.current) return
        setRole(saved.for)
        setGoal(saved.need)
        setStep('pathway')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (step !== 'pathway' || !role || !goal) return
    let cancelled = false
    setItems(null)
    setLoadFailed(false)
    fetch(`/api/starter-resources?need=${encodeURIComponent(goal)}&for=${encodeURIComponent(role)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json) => {
        if (!cancelled) setItems(Array.isArray(json?.items) ? json.items : [])
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setLoadFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [step, role, goal])

  useEffect(() => {
    if (moved.current) stepHeading.current?.focus()
  }, [step])

  const go = (next: Step) => {
    moved.current = true
    setUseful('')
    setSaveNote('')
    setStep(next)
  }

  const chooseRole = (id: string) => {
    decided.current = true
    setRole(id)
    remember(START_FOR_KEY, id)
    track('start_role', id)
    if (goal) track('start_pathway', `${id}.${goal}`)
    go(goal ? 'pathway' : 'goal')
  }

  const chooseGoal = (id: string) => {
    decided.current = true
    setGoal(id)
    remember(START_NEED_KEY, id)
    track('start_pathway', `${role}.${id}`)
    go('pathway')
  }

  const startOver = () => {
    decided.current = true
    setRole('')
    setGoal('')
    remember(START_FOR_KEY, null)
    remember(START_NEED_KEY, null)
    go('role')
  }

  const rate = (value: 'yes' | 'no') => {
    setUseful(value)
    track('start_useful', `${answer}.${value}`)
  }

  // Signed in, saving keeps the path on the account; signed out, "Save this
  // path" is the free account (setup then saves it, app/onboarding).
  const save = async () => {
    track('start_save', answer)
    const startPath = { for: role, need: goal, savedAt: new Date().toISOString() }
    savePreferences({ startPath })
    const ok = await fetch('/api/me/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ startPath }),
    })
      .then((res) => res.ok)
      .catch(() => false)
    if (ok) setSavedAs(answer)
    setSaveNote(ok ? 'Saved. You can open it again from Quick Links on your Path.' : 'This could not be saved just now. Please try again.')
  }

  const hubHref = (path: string) => (user ? goHubHref(path) : `${HUB}${path}`)

  const H = standalone ? 'h1' : 'h2'
  const StepH = standalone ? 'h2' : 'h3'

  const progress: { id: Step; label: string; value?: string }[] = [
    { id: 'role', label: 'Who you are here for', value: roleInfo?.label },
    { id: 'goal', label: 'What you need today', value: goalInfo?.label },
    { id: 'pathway', label: 'Your starter resources' },
  ]
  const order: Step[] = ['role', 'goal', 'pathway']
  const at = order.indexOf(step)

  return (
    <section
      id="start"
      aria-labelledby="start-heading"
      className={standalone ? 'px-4 py-8 md:py-12' : 'scroll-mt-4 border-t border-slate-200 bg-white px-4 py-12 md:py-16'}
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-800">Start here</p>
        <H id="start-heading" className="mt-1 text-2xl font-bold md:text-3xl">
          Find neurodivergent-friendly resources that fit your situation
        </H>
        <p className="mt-2 text-slate-700">Two quick questions, no account needed. You can change your answers any time.</p>

        {/* Where you are: what is done, what is next (W3C's clear steps). */}
        <ol className="mt-6 flex flex-col gap-2 text-sm" aria-label="Your progress">
          {progress.map((p, i) => {
            const done = i < at
            const current = i === at
            return (
              <li key={p.id} aria-current={current ? 'step' : undefined} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done ? 'bg-emerald-700 text-white' : current ? 'bg-indigo-700 text-white' : 'border border-slate-400 text-slate-700'
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={current ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                  {p.label}
                  {done && p.value ? `: ${p.value}` : ''}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
                {done && step === 'pathway' && (
                  <button type="button" onClick={() => go(p.id)} className={`${TEXT_BUTTON} text-sm`}>
                    Change<span className="sr-only"> {p.label.toLowerCase()}</span>
                  </button>
                )}
              </li>
            )
          })}
        </ol>

        {step === 'role' && (
          <div className="mt-6">
            <StepH ref={stepHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
              Who are you here for?
            </StepH>
            <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Who are you here for?">
              {START_ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => chooseRole(r.id)}
                  aria-pressed={role === r.id}
                  className={`${CHOICE} ${
                    role === r.id ? 'border-indigo-700 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {goal && (
              <button type="button" onClick={() => go('pathway')} className={`mt-4 inline-flex items-center gap-1 ${TEXT_BUTTON}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to your starter resources
              </button>
            )}
          </div>
        )}

        {step === 'goal' && (
          <div className="mt-6">
            <StepH ref={stepHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
              What do you need today?
            </StepH>
            <p className="mt-1 text-slate-700">Pick the one that matters most right now.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="What do you need today?">
              {START_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => chooseGoal(g.id)}
                  aria-pressed={goal === g.id}
                  className={`${CHOICE} ${
                    goal === g.id ? 'border-indigo-700 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
                  }`}
                >
                  <span className="block">{g.label}</span>
                  <span className="block text-sm font-normal text-slate-700">{g.hint}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => go('role')} className={`mt-4 inline-flex items-center gap-1 ${TEXT_BUTTON}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </button>
          </div>
        )}

        {step === 'pathway' && pathway && roleInfo && (
          <div className="mt-6">
            <StepH ref={stepHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
              {pathwayTitle(role, goal)}
            </StepH>
            <p className="mt-2 text-slate-800">{pathway.explanation}</p>

            {/* Announce how many were found, not the whole list. */}
            <p role="status" className="sr-only">
              {items === null
                ? 'Finding starter resources'
                : items.length > 0
                  ? `${items.length} starter resources found`
                  : loadFailed ? 'Starter resources could not be loaded' : 'No starter resources found'}
            </p>
            <div>
              {items === null ? (
                <p className="mt-4 text-slate-700" aria-hidden="true">Finding starter resources&hellip;</p>
              ) : items.length === 0 ? (
                <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-slate-800">
                  {loadFailed ? 'These could not be loaded just now.' : 'Nothing was found for this yet.'}{' '}
                  <a href={hubHref(searchPath(pathway.more.params))} target="_blank" rel="noopener noreferrer" className={TEXT_BUTTON}>
                    {pathway.more.label}
                  </a>{' '}
                  instead, or try a different need.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {items.map((it) => (
                    <li key={it.path} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <a
                          href={hubHref(it.path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => track('start_open', `${answer}.${it.id}`)}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
                        >
                          {it.label}
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="sr-only"> (opens ResourceHub in a new tab)</span>
                        </a>
                        {typeof it.count === 'number' && (
                          <span className="text-sm text-slate-700">
                            {it.count.toLocaleString()} {it.count === 1 ? 'place' : 'places'}
                          </span>
                        )}
                        {it.needsAccount && !user && (
                          <span className="rounded-full border border-slate-400 bg-white px-2 py-0.5 text-xs font-medium text-slate-800">
                            Free account
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{it.detail}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="mt-4 text-sm text-slate-700">
              These are places to start looking, not medical or clinical advice. For health decisions, talk with a professional you trust.
            </p>

            {/* The one next action. */}
            <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              {user ? (
                savedAs === answer ? (
                  <p className="flex items-center gap-2 font-semibold text-emerald-800">
                    <Check className="h-5 w-5" aria-hidden="true" /> Saved to your account
                  </p>
                ) : (
                  <button type="button" onClick={save} className={PRIMARY}>
                    Save this path
                  </button>
                )
              ) : (
                <Link href="/signup" onClick={() => track('start_save', answer)} className={PRIMARY}>
                  Save this path
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              )}
              <p className="mt-2 text-sm text-slate-800" role={saveNote ? 'status' : undefined}>
                {saveNote || (user ? 'Saved paths open from Quick Links on your Path.' : roleInfo.account)}
              </p>
              <p className="mt-3 text-sm">
                <a href={hubHref(searchPath(pathway.more.params))} target="_blank" rel="noopener noreferrer" className={TEXT_BUTTON}>
                  {pathway.more.label}
                  <span className="sr-only"> (opens ResourceHub in a new tab)</span>
                </a>
                {!user && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <Link href="/#how" className={TEXT_BUTTON}>
                      Learn what to expect
                    </Link>
                  </>
                )}
              </p>
            </div>

            {/* Relevance (Group 4: "users mark results as useful"). */}
            <div className="mt-6">
              {useful ? (
                <p role="status" className="text-slate-800">
                  Thank you. This helps us choose better starter resources.
                  {useful === 'no' && (
                    <>
                      {' '}
                      <button type="button" onClick={() => go('goal')} className={TEXT_BUTTON}>
                        Try a different need
                      </button>
                    </>
                  )}
                </p>
              ) : (
                <div role="group" aria-labelledby="start-useful" className="flex flex-wrap items-center gap-2">
                  <span id="start-useful" className="font-medium text-slate-900">
                    Was this useful?
                  </span>
                  <button type="button" onClick={() => rate('yes')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:border-indigo-400">
                    Yes
                  </button>
                  <button type="button" onClick={() => rate('no')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:border-indigo-400">
                    Not really
                  </button>
                </div>
              )}
            </div>

            <button type="button" onClick={startOver} className={`mt-6 text-sm ${TEXT_BUTTON}`}>
              Start over
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
