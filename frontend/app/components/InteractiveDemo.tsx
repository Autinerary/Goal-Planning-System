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

interface DemoStep {
  title: string
  body: string
  emoji: string
  route?: string
}

const STEPS: DemoStep[] = [
  {
    emoji: '👋',
    title: 'Welcome to Autinerary',
    body: 'This quick tour shows how to turn your goals into a fun, step-by-step journey. It takes about a minute.',
  },
  {
    emoji: '🧭',
    title: 'Your Path',
    body: 'The Path is your home base. It shows your races (goals), progress, people, and quick actions.',
    route: '/path',
  },
  {
    emoji: '🏁',
    title: 'Races & Milestones',
    body: 'Each goal is a "race". Check off milestones as you complete them — your progress updates in real time.',
    route: '/races',
  },
  {
    emoji: '🛠️',
    title: 'Pit Stop & Resources',
    body: 'Find tools, services, and the Resource Roadmap here. Everything is tailored to your Diagnostics profile.',
    route: '/pit-stop',
  },
  {
    emoji: '📖',
    title: 'Journal & Reflections',
    body: 'Reflect on your journey. You can even import past journals — and get a monthly Motivation Style report.',
    route: '/reflection',
  },
  {
    emoji: '🎨',
    title: 'Make it yours',
    body: 'Personalize the look, move widgets around, and set accessibility options anytime in Settings. Every mode stays a fun checklist.',
    route: '/profile/accessibility',
  },
  {
    emoji: '🚀',
    title: 'You’re ready!',
    body: 'That’s the tour. Start checking off milestones and watch your Dream Land come to life.',
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
        <p className="text-slate-600 text-sm mb-6">{s.body}</p>

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
