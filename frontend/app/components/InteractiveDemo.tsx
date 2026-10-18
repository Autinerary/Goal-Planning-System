'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X, ArrowRight, ArrowLeft, PlayCircle, Check, MousePointerClick, Hand, Compass, Signpost, CalendarDays, Palette, Rocket, type LucideIcon, Map as MapIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { track, TOUR_TASK_IDS } from '@/lib/funnel'
import { goHubHref } from '@/lib/serviceHub'

/**
 * The app tour (Riipen Labs, Group 27, September 2026).
 *
 * Group 27 found the tour explained features without asking people to do
 * anything: "add prompts that have users complete a task before moving to the
 * next feature, and explain how features connect", and "identify the 3 to 4
 * features that best show Autinerary's value", introducing the rest
 * "gradually". So the tour is four parts, each with one small thing to try
 * (open your next step, open the Calendar, pick today's energy, open
 * Display), and Next comes after it is done or skipped; then a page on where
 * the rest is, and ResourceHub at the end (Group 26: the most distinctive
 * part). Skipping stays possible at every point: a task nobody can leave is a
 * trap, not a prompt. Group 26 asked for the tour to show where setup's
 * optional questions went (Display, "Complete your profile", AI
 * suggestions), on the fourth part.
 *
 * "Show me" (Group 33) still points at each part on the page. Started once by
 * itself after setup, and from the page guide ("How it works" in the top bar,
 * components/PageGuide.tsx). Counted as tour events (lib/funnel.ts, TOUR_STEP;
 * STEP 70).
 *
 * Riipen Labs, Group 23 found the tour "blocks active use of the page
 * content", "automatically changes the background webpage as users advance"
 * and "resets to step one every time it opens, regardless of which page the
 * user is currently viewing". So the card sits beside the page with no dark
 * layer, and the page stays usable; Next and Back never change the page
 * (a "Go to" button does, when asked); it picks up where it was left, or at
 * the part about the page it was opened from, with "Start over" there too;
 * and Escape closes it.
 */

type TaskId = (typeof TOUR_TASK_IDS)[number]

interface DemoFeature {
  name: string
  desc: string
  /** Where it is on the page (a CSS selector): "Show me" points at it. */
  target?: string
  /** What "Show me" says when it is not on the page just now. */
  missing?: string
}

interface DemoTask {
  id: TaskId
  /** The one thing to try, as an instruction. */
  prompt: string
  /** What to tap (CSS selectors, tried in order); done when it is tapped. */
  target: string | string[]
  /** Said when it is not on the page. */
  missing: string
}

interface DemoStep {
  title: string
  /** What the part is for (shown first). */
  overview: string
  /** How it connects to the rest (Group 27: "explain how features connect"). */
  connects?: string
  features?: DemoFeature[]
  task?: DemoTask
  /** A plain icon for the part (Riipen Labs, Group 18: the emoji read as generic). */
  icon: LucideIcon
  /** The page it is about; "Go to" leads there unless already on `stayOn`. */
  route?: string
  /** That page's name, for "Go to …". */
  routeName?: string
  stayOn?: RegExp
}

const STEPS: DemoStep[] = [
  {
    icon: Hand,
    title: 'Welcome to Autinerary',
    overview:
      'Four parts, about two minutes. Each one asks you to try one small thing, so you know where it is next time. You can skip any of them, or the whole tour.',
    connects:
      'How it fits together: your goal is broken into small steps on your Path. Each step suggests tools that can help. The Calendar spreads the steps over your week, at the energy you have. And you can change how the app looks, and add more about you, whenever you like.',
  },
  {
    icon: Compass,
    title: '1. Your next step',
    overview: 'This is the Path, your home base. It shows the one thing to do next: the first small step of your goal.',
    connects: 'Each step you finish brings up the next one, and moves your goal along in Races.',
    features: [
      { name: 'Your next step', desc: 'The one thing to do now. Open it to see how, and the tools that help.', target: 'section[aria-labelledby="next-step-heading"], section[aria-labelledby="no-plan-heading"]' },
      { name: 'Quick Links', desc: 'The places you’ll use most. “All places” lists everything.', target: 'section[aria-labelledby="quick-links-heading"]' },
      { name: 'Find resources', desc: 'Opens ResourceHub: services and places, rated by people with similar norms.', target: 'button[aria-label="Find resources in ResourceHub"]' },
    ],
    task: {
      id: 'next_step',
      prompt: 'Open your next step',
      target: 'section[aria-labelledby="next-step-heading"] a[href^="/milestones/"]',
      missing: 'Your next step appears here once your plan is made. Skip this one for now.',
    },
    route: '/path',
    routeName: 'your Path',
  },
  {
    icon: Signpost,
    title: '2. Tools for each step',
    overview: 'A step says what to do, in small parts, and suggests tools and services that can help. Tick it off when it is done, and the next one opens.',
    connects: 'Tools you save go to Pit Stop. When this step is planned is on the Calendar.',
    features: [
      { name: 'Recommended tools', desc: 'Apps, services and reads that can help with this step.', target: '[data-tour="milestone-tools"]' },
    ],
    task: {
      id: 'calendar',
      prompt: 'Open the Calendar, to see when it is planned',
      // The step page's own link first: one selector list would find the
      // "Your plan" bar's Calendar tab, which comes earlier on the page.
      target: ['main a[href="/calendar"]', 'a[href="/calendar"]'],
      missing: 'The Calendar link is on a step’s page. Skip this one for now.',
    },
    route: '/milestones',
    routeName: 'Milestone View',
    stayOn: /^\/milestones(\/|$)/,
  },
  {
    icon: CalendarDays,
    title: '3. Your week, at your energy',
    overview: 'The Calendar spreads your plan’s tasks across the week. Tell it how much energy you have today and the day fits it: low, balanced or high.',
    connects: 'Ticks here count on your Path and in Life Stats too.',
    features: [
      { name: 'List or time blocks', desc: 'A simple list, or the day laid out in blocks.', target: '[data-tour="calendar-view"]' },
    ],
    task: {
      id: 'energy',
      prompt: 'Pick how much energy you have today',
      target: '[data-tour="calendar-energy"]',
      missing: 'The energy choice is at the top of the Calendar. Skip this one for now.',
    },
    route: '/calendar',
    routeName: 'the Calendar',
  },
  {
    icon: Palette,
    title: '4. Make it yours',
    overview: 'Change how the app looks at any time: light or dark, larger text, higher contrast. Setup asked only what your plan needed; the rest is on the Path, for whenever you like.',
    connects: 'Each answer changes what you see: your city finds services near you, your character stands on your race track.',
    features: [
      { name: 'Display', desc: 'Light or dark, text size, contrast, and how lively it looks.', target: '[data-tour="display"]' },
      // The Path shows one card at a time: this one after "Getting started".
      { name: 'Complete your profile', desc: 'Your city, what motivates you, your norms, your character and more. All optional.', target: 'section[aria-labelledby="profile-card-heading-path"]', missing: 'Complete your profile shows here once “Getting started” is done or hidden. All its questions are in Profile, in the top bar, any time.' },
      { name: 'Suggestions for each step', desc: 'Ideas for each step of your plan, written with AI, with ratings from people who used them.', target: '[data-tour="ai-suggestions"]' },
    ],
    task: {
      id: 'display',
      prompt: 'Open Display',
      target: '[data-tour="display"]',
      missing: 'Display is at the top of the Path. Skip this one for now.',
    },
    route: '/path',
    routeName: 'your Path',
  },
  {
    icon: MapIcon,
    title: 'More, when you are ready',
    overview: 'There is more, for later: Races shows your goals as a race, Pit Stop keeps your tools, the Journal is for looking back, and Hare World is for your people.',
    connects: 'Find them under Quick Links, then “All places”, when you want them.',
    features: [
      { name: 'All places', desc: 'Everything in the app, in groups.', target: 'button[aria-controls="all-places"]' },
    ],
    route: '/path',
    routeName: 'your Path',
  },
  {
    icon: Rocket,
    title: 'Last one, if you like: ResourceHub',
    overview: 'ResourceHub has services and places rated by people with similar norms, and Tidbits, where people ask and answer questions. It opens in this window; come back with your browser’s Back button.',
    connects: '“How it works” in the top bar (“Guide” on a phone) explains the page you are on, and starts this tour again.',
  },
]

const SEEN_KEY = 'autinerary_demo_seen_v1'
// Where the tour was left, so it picks up there (Group 23: it "resets to step
// one every time it opens").
const PROGRESS_KEY = 'autinerary_tour_progress'

/** The first element a target's selectors find, in their order. */
function findTarget(target: string | string[]): Element | null {
  for (const selector of Array.isArray(target) ? target : [target]) {
    const el = document.querySelector(selector)
    if (el) return el
  }
  return null
}

/** The tour's part about this page, if there is one. */
function partFor(pathname: string): number | null {
  const i = STEPS.findIndex((st) => st.stayOn ? st.stayOn.test(pathname) : st.route === pathname)
  return i >= 0 ? i : null
}
// Pages the tour never sits over: setup and signing in.
const NOT_HERE = ['/', '/login', '/signup', '/onboarding', '/forgot-password', '/reset-password', '/auth/age', '/checkin']

export default function InteractiveDemo() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  // "Show me": one control on the page, ringed, the rest dimmed.
  const [spot, setSpot] = useState<{ name: string; desc: string; el: Element } | null>(null)
  // "Try it": the task's control, ringed, and the page usable around it.
  const [trying, setTrying] = useState<{ task: DemoTask; el: Element } | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<Partial<Record<TaskId, 'done' | 'skipped'>>>({})
  const backRef = useRef<HTMLButtonElement>(null)
  const stepRef = useRef(step)
  stepRef.current = step

  const ringed = spot?.el || trying?.el || null
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'on'

  const showMe = (f: DemoFeature) => {
    const el = f.target ? document.querySelector(f.target) : null
    if (!el) {
      setNote(f.missing || `${f.name} isn’t on this screen right now.`)
      return
    }
    setNote('')
    el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' })
    setSpot({ name: f.name, desc: f.desc, el })
  }

  const tryIt = (task: DemoTask) => {
    const el = findTarget(task.target)
    if (!el) {
      setNote(task.missing)
      return
    }
    setNote('')
    el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' })
    setTrying({ task, el })
  }

  const markTask = (id: TaskId, how: 'done' | 'skipped') => {
    setDone((d) => ({ ...d, [id]: how }))
    track('tour', `${how === 'done' ? 'task' : 'skip'}.${id}`)
  }

  // Kept as it goes, so it picks up where it was left.
  useEffect(() => {
    if (!open) return
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ step, done })) } catch {}
  }, [open, step, done])

  // Keep the ring on its control as the page scrolls or moves.
  useEffect(() => {
    if (!ringed) { setRect(null); return }
    const update = () => setRect(ringed.getBoundingClientRect())
    update()
    const timer = window.setInterval(update, 200)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSpot(null); setTrying(null) } }
    window.addEventListener('resize', update)
    window.addEventListener('keydown', onKey)
    // "Try it": focus the control to use, so Enter does the task; "Show me":
    // focus "Back to the tour".
    const control = trying ? (trying.el.matches('a, button') ? trying.el : trying.el.querySelector('a, button')) : null
    if (control instanceof HTMLElement) control.focus({ preventScroll: true })
    else backRef.current?.focus()
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', update)
      window.removeEventListener('keydown', onKey)
    }
  }, [ringed])

  // The task is done when its control is used: a tap inside it. Links go
  // where they lead; the tour follows, on to the next part.
  useEffect(() => {
    if (!trying) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target || !trying.el.contains(target)) return
      if (!(target instanceof Element) || !target.closest('a, button')) return
      markTask(trying.task.id, 'done')
      setTrying(null)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [trying])

  const autoStarted = useRef(false)
  useEffect(() => {
    // Auto-start once for brand-new users — but only when signed in and onboarded
    // (the tour walks real, logged-in screens; it shouldn't pop over login/signup).
    // Once per page load: it used to count a new start on every page change.
    if (!user || !user.hasCompletedOnboarding || autoStarted.current) return
    // Not for someone who said they had little energy for setup (Riipen Labs,
    // Group 23): the page after setup told them where "How it works" is.
    try {
      if (JSON.parse(localStorage.getItem('autinerary_onboarding_choices') || '{}')?.setupEnergy === 'low') return
    } catch {}
    // Not over the page after setup, which offers the tour as a button. It
    // still starts by itself once, on the next page.
    if (pathname === '/onboarding-confirmation') return
    // Nor over the one-question check-in someone opened from an email.
    if (['/checkin', '/privacy', '/terms', '/newsletter', '/community-choice', '/help', '/forgot-password', '/reset-password'].includes(pathname)) return
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        // Slight delay so the app renders first.
        const t = setTimeout(() => { autoStarted.current = true; setOpen(true); track('tour', 'start') }, 800)
        return () => clearTimeout(t)
      }
    } catch {
      /* ignore */
    }
  }, [user, pathname])

  // Opened again: at the part about this page if asked from there, else where
  // it was left; "Start over" is in the card.
  useEffect(() => {
    const start = (e: Event) => {
      let saved: { step?: number; done?: Partial<Record<TaskId, 'done' | 'skipped'>> } = {}
      try { saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {} } catch {}
      const asked = (e as CustomEvent<{ part?: number | null }>).detail?.part
      const here = typeof asked === 'number' ? asked : null
      const resume = typeof saved.step === 'number' && saved.step > 0 && saved.step < STEPS.length - 1 ? saved.step : 0
      setStep(here ?? resume)
      setDone(saved.done || {})
      setNote('')
      setOpen(true)
      track('tour', 'start')
    }
    window.addEventListener('autinerary:start-demo', start)
    return () => window.removeEventListener('autinerary:start-demo', start)
  }, [])

  // Focus moves into the card when it opens, and Escape closes it.
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || trying || spot) return
    cardRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish('close') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, trying, spot])

  // Never over setup or signing in, whatever led there.
  useEffect(() => {
    if (open && NOT_HERE.includes(pathname)) {
      setOpen(false)
      setTrying(null)
      setSpot(null)
    }
  }, [open, pathname])

  // After a task that leads to another page, go on to the next part there.
  useEffect(() => {
    if (!open || trying) return
    const s = STEPS[stepRef.current]
    if (s?.task && done[s.task.id] === 'done' && s.task.id !== 'display') {
      const next = Math.min(STEPS.length - 1, stepRef.current + 1)
      if (STEPS[next].stayOn?.test(pathname) || !STEPS[next].route || STEPS[next].route === pathname) {
        setStep(next)
        setNote('')
      }
    }
  }, [pathname, done, open, trying])

  const finish = (how: 'finish' | 'close') => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
      if (how === 'finish') localStorage.removeItem(PROGRESS_KEY)
    } catch {
      /* ignore */
    }
    track('tour', how)
    setOpen(false)
    setTrying(null)
    setSpot(null)
  }

  // Next and Back change the part, never the page (Group 23); "Go to" does.
  const go = (next: number) => {
    setNote('')
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)))
  }
  const startOver = () => {
    setDone({})
    go(0)
  }

  if (!open) return null
  const s = STEPS[step]
  const isLast = step === STEPS.length - 1
  const taskState = s.task ? done[s.task.id] : undefined
  // Next waits for the task, done or skipped (Group 27: complete a task
  // "before moving to the next feature").
  const canGoOn = !s.task || Boolean(taskState)

  // The ring around a control. A light shade elsewhere, which never takes
  // taps: the page stays usable (Group 23).
  const ring = rect && (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed rounded-xl ring-4 ring-amber-400 keep-colors"
      style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.25)' }}
    />
  )
  const onPage = !s.route || (s.stayOn ? s.stayOn.test(pathname) : s.route === pathname)
  const below = !rect || rect.top + rect.height / 2 < window.innerHeight / 2

  if (trying) {
    // The page stays usable: only the bar takes taps, and the ringed control
    // is the thing to tap.
    return (
      <div className="pointer-events-none fixed inset-0 z-[100]">
        {ring}
        <div role="dialog" aria-labelledby="tour-try-prompt" className={`pointer-events-auto fixed left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-2xl ${below ? 'bottom-4' : 'top-4'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Try it</p>
          <p id="tour-try-prompt" className="mt-1 flex items-center gap-2 font-bold text-slate-900">
            <MousePointerClick className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            {trying.task.prompt}: tap the ringed button.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              ref={backRef}
              type="button"
              onClick={() => setTrying(null)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-500"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the tour
            </button>
            <button
              type="button"
              onClick={() => { markTask(trying.task.id, 'skipped'); setTrying(null) }}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-500"
            >
              Skip this one
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (spot) {
    // The explanation sits away from the control: below if it is in the top
    // half of the screen, above if not.
    return (
      <div className="pointer-events-none fixed inset-0 z-[100]">
        {ring}
        <div role="dialog" aria-modal="false" aria-labelledby="tour-spot-name" className={`pointer-events-auto fixed left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-2xl ${below ? 'bottom-4' : 'top-4'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">{s.title}</p>
          <p id="tour-spot-name" className="mt-1 font-bold text-slate-900">{spot.name}</p>
          <p className="mt-1 text-sm text-slate-700">{spot.desc}</p>
          <button
            ref={backRef}
            type="button"
            onClick={() => setSpot(null)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the tour
          </button>
        </div>
      </div>
    )
  }

  return (
    /*
      Beside the page, not over it (Riipen Labs, Group 23: the tour "blocks
      active use of the page content instead of displaying explanations
      alongside it"): no dark layer, and the page stays usable. Capped to the
      window and scrollable, so it fits at 200% zoom.
    */
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="fixed bottom-3 right-3 z-[100] w-[min(28rem,calc(100vw-1.5rem))] max-h-[min(40rem,calc(100vh-1.5rem))] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
    >
      <div className="relative">
        <button
          onClick={() => finish('close')}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-800"
          aria-label="Close tour"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-cyan-700" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
            Interactive tour
          </span>
        </div>

        <s.icon className="mb-2 h-9 w-9 text-indigo-700" aria-hidden="true" />
        <h2 id="tour-title" className="text-xl font-bold text-slate-900 mb-2">{s.title}</h2>
        {/* The page this part is about, when it is not this one: going there
            is the person's choice (Group 23: the tour "automatically changes
            the background webpage"). */}
        {!onPage && s.route && (
          <button
            type="button"
            onClick={() => router.push(s.route!)}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border-2 border-indigo-600 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-50"
          >
            Go to {s.routeName || 'that page'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <p className="text-slate-700 text-sm mb-3">{s.overview}</p>
        {s.connects && <p className="text-slate-700 text-sm mb-4">{s.connects}</p>}

        {/* The voice-guided intro (narration plus spoken "next"/"back"),
            offered instead of shown as a second tour. It lives on the Path. */}
        {step === 0 && pathname === '/path' && (
          <button
            type="button"
            onClick={() => {
              finish('close')
              window.dispatchEvent(new CustomEvent('autinerary:start-voice-intro'))
            }}
            className="-mt-1 mb-4 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
          >
            Prefer it read aloud? Use the voice-guided intro
          </button>
        )}

        {s.task && (
          <div className={`mb-4 rounded-xl border-2 p-3 ${taskState === 'done' ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
            {taskState === 'done' ? (
              <p role="status" className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> Done: {s.task.prompt.toLowerCase()}.
              </p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Try it</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{s.task.prompt}.</p>
                {taskState === 'skipped' && <p className="mt-1 text-xs text-slate-700">Skipped. You can still try it.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => tryIt(s.task!)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    <MousePointerClick className="h-4 w-4" aria-hidden="true" /> Try it
                  </button>
                  {!taskState && (
                    <button
                      type="button"
                      onClick={() => markTask(s.task!.id, 'skipped')}
                      className="rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-500"
                    >
                      Skip this one
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {s.features && s.features.length > 0 && (
          <div className="mb-6 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Where things are</p>
            {s.features.map((f) => (
              <div key={f.name} className="flex items-start justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold text-slate-800">{f.name}</span>
                  <span className="text-slate-700">: {f.desc}</span>
                </span>
                {f.target && (
                  <button
                    type="button"
                    onClick={() => showMe(f)}
                    aria-label={`Show me ${f.name}`}
                    className="shrink-0 rounded-lg border border-cyan-700 bg-white px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
                  >
                    Show me
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p role="status" className="mb-3 text-xs text-slate-700">{note}</p>

        {/* Progress: dots, and the part in words */}
        <div className="flex items-center gap-1.5 mb-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-cyan-500' : i < step ? 'w-1.5 bg-cyan-700' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>
        <p className="mb-5 text-xs text-slate-600">
          Part {step + 1} of {STEPS.length}
          {step > 0 && (
            <>
              {' · '}
              <button type="button" onClick={startOver} className="underline underline-offset-2 hover:text-slate-900">Start over</button>
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:invisible"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={() => finish('close')}
            className="text-xs text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            Skip tour
          </button>

          {isLast ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => finish('finish')}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-500"
              >
                Finish the tour
              </button>
              <button
                onClick={() => {
                  track('tour', 'task.resourcehub')
                  finish('finish')
                  window.location.href = goHubHref('/')
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold hover:shadow-lg"
              >
                Open ResourceHub <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => go(step + 1)}
              disabled={!canGoOn}
              aria-describedby={!canGoOn ? 'tour-next-hint' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold hover:shadow-lg disabled:bg-slate-200 disabled:text-slate-700 disabled:shadow-none"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {!canGoOn && (
          <p id="tour-next-hint" className="mt-2 text-right text-xs text-slate-700">Try it or skip it to go on.</p>
        )}
      </div>
    </div>
  )
}

/** Small reusable button that (re)launches the tour from anywhere. */
export function StartDemoButton({ className = '' }: { className?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <PlayCircle className="w-4 h-4" /> How it works
    </button>
  )
}
