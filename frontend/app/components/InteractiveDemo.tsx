'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowRight, ArrowLeft, Sparkles, PlayCircle } from 'lucide-react'

/**
 * Interactive demo / tutorial.
 *
 * A dependency-free guided walkthrough that explains how to use the app. It
 * shows a sequence of cards, each optionally routing the user to the relevant
 * screen so they see the real UI as they learn. Triggered automatically on a
 * user's first visit (once), or manually via the `autinerary:start-demo` event
 * (e.g. a "How it works" button).
 */

interface DemoFeature {
  name: string
  desc: string
}

interface DemoStep {
  title: string
  /** A general description of the page/view (shown first). */
  overview: string
  /** What the key buttons/features on this view do. */
  features?: DemoFeature[]
  emoji: string
  route?: string
}

const STEPS: DemoStep[] = [
  {
    emoji: '👋',
    title: 'Welcome to Autinerary',
    overview:
      'This quick tour walks you through each screen — first what the page is for, then what the main buttons do. It takes about a minute, and you can leave anytime.',
  },
  {
    emoji: '🧭',
    title: 'Paths View',
    overview:
      'This is the Paths View — your home base. It gives a general overview of your progress: your goals (as “races”), a motivational message, your streak, and quick actions.',
    features: [
      { name: 'Show more / Simplify', desc: 'Switch between a simple layout and the full set of features.' },
      { name: 'Compare', desc: 'Compare different saved versions of your path side by side.' },
      { name: 'Save snapshot', desc: 'Save the current path so you can look back and compare later.' },
      { name: 'Streak 🔥', desc: 'Shows how many days in a row you’ve completed a task.' },
    ],
    route: '/path',
  },
  {
    emoji: '🏁',
    title: 'Races & Milestones',
    overview:
      'This is the Races View. Each goal is a “race”, broken into milestones. It shows how far along each goal is.',
    features: [
      { name: 'A race card', desc: 'Tap one to open its milestones and see the next steps.' },
      { name: 'Motivation Pinwheel', desc: 'Spin it for an encouraging message for the day.' },
      { name: 'Progress bar', desc: 'Fills in automatically as you check off milestones.' },
    ],
    route: '/races',
  },
  {
    emoji: '🪧',
    title: 'Milestone View',
    overview:
      'This is the Milestone View. It pairs the tools you can use with the barriers you’re unlocking for the current milestone.',
    features: [
      { name: 'Tools & Barriers dropdown', desc: 'Collapse or expand the list to keep the page tidy.' },
      { name: 'Wishlist / Currently Using', desc: 'Save a tool to your ResourceHub list or mark that you’re using it.' },
      { name: 'Effectiveness stars', desc: 'Rate how well a tool worked — this also clears the barrier.' },
    ],
    route: '/milestones',
  },
  {
    emoji: '📅',
    title: 'Calendar View',
    overview:
      'This is the Calendar View — your schedule as a travel guide for each day, built around your energy.',
    features: [
      { name: 'List / Time Blocks', desc: 'Switch between a simple list and a time-blocked layout.' },
      { name: 'Low / Balanced / High energy', desc: 'See a schedule that matches how much energy you have.' },
      { name: 'Day / Week / Month', desc: 'Change how much of your schedule you see at once.' },
      { name: 'Compare', desc: 'Line your day up against a role model or mentor’s.' },
    ],
    route: '/calendar',
  },
  {
    emoji: '🛒',
    title: 'Pit Stop',
    overview:
      'This is the Pit Stop — your cart of tools and supports. Everything is tailored to your Diagnostics profile.',
    features: [
      { name: 'Search', desc: 'Find autism-friendly services, products, and communities.' },
      { name: 'Add to cart', desc: 'Save what helps to your list; skip the rest.' },
    ],
    route: '/pit-stop',
  },
  {
    emoji: '📖',
    title: 'Journal & Reflections',
    overview:
      'This is the Journal. Reflect on how things are going — you can import past journals and get a monthly Motivation Style report.',
    route: '/reflection',
  },
  {
    emoji: '🎨',
    title: 'Settings & Personalize',
    overview:
      'This is Settings. Make the app yours — adjust the look, move widgets, set accessibility options, and manage reminders.',
    features: [
      { name: 'View energy', desc: 'Dial how playful vs. calm the interface feels.' },
      { name: 'Accessibility', desc: 'Larger text, reduced motion, high contrast, and more.' },
    ],
    route: '/profile/accessibility',
  },
  {
    emoji: '🚀',
    title: 'You’re ready!',
    overview:
      'That’s the tour. Start checking off milestones and watch your Dream Land come to life. You can replay this anytime from “How it works”.',
  },
]

const SEEN_KEY = 'autinerary_demo_seen_v1'

export default function InteractiveDemo() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Auto-start once for brand-new users.
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        // Slight delay so the app renders first.
        const t = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(t)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const start = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener('autinerary:start-demo', start)
    return () => window.removeEventListener('autinerary:start-demo', start)
  }, [])

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next))
    setStep(clamped)
    const route = STEPS[clamped].route
    if (route) router.push(route)
  }

  if (!open) return null
  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6">
        <button
          onClick={finish}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
          aria-label="Close tour"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-cyan-600">
            Interactive tour
          </span>
        </div>

        <div className="text-5xl mb-3">{s.emoji}</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{s.title}</h2>
        <p className="text-slate-600 text-sm mb-4">{s.overview}</p>

        {s.features && s.features.length > 0 && (
          <div className="mb-6 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What the buttons do</p>
            {s.features.map((f) => (
              <div key={f.name} className="flex gap-2 text-sm">
                <span className="font-semibold text-slate-800 whitespace-nowrap">{f.name}</span>
                <span className="text-slate-500">— {f.desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-cyan-500' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={finish}
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
          >
            Skip tour
          </button>

          {isLast ? (
            <button
              onClick={finish}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:shadow-lg"
            >
              Get started
            </button>
          ) : (
            <button
              onClick={() => go(step + 1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:shadow-lg"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
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
