'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Rocket, PlayCircle, ArrowRight } from 'lucide-react'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { useAgentPath } from '../context/AgentPathContext'

/**
 * Post-onboarding: what was built, and what to do first.
 *
 * Shows the REAL agent-generated plan summary (goals, norms, first
 * milestone). The previous version of this page was a two-step selection
 * wizard over fabricated people ("Sarah Chen", "Lisa Park") whose choices
 * were never saved anywhere; all of that is gone.
 *
 * Riipen Labs' review asked for this moment to "clarify what to expect after
 * onboarding", "give users a clear first step" and "show how key features
 * connect". It was titled "Final Step - Guidance", and the app tour opened by
 * itself over it about a second after a nine-step setup. Now: a numbered
 * "start here" that names the real first milestone, one primary button, and
 * the tour offered rather than imposed (it still starts once, on the Path).
 */

const CONNECTIONS = ['Your path', 'Milestones', 'Tools & ResourceHub', 'Calendar', 'Journal']

export default function OnboardingConfirmationPage() {
  const router = useRouter()
  const { payload, pathPlanning } = useAgentPath()
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    if (!launching) return
    const timer = window.setTimeout(() => router.push('/path'), 1200)
    return () => window.clearTimeout(timer)
  }, [launching, router])

  const goals: string[] = (payload?.userProfile?.goals || []) as string[]
  const norms: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const firstMilestone = pathPlanning?.milestones?.[0]?.name
  const milestoneCount = (pathPlanning?.milestones || []).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-purple-50">
      {launching && (
        <div role="status" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white p-6 text-center">
          <Rocket aria-hidden="true" className="mb-4 h-16 w-16 text-cyan-700 motion-safe:animate-bounce" />
          <h1 className="text-3xl font-bold">Welcome to Dreamland</h1>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-3 mb-6">
          <AgentInsightsBanner agent="path_planning" />
          <AgentInsightsBanner agent="pattern_recognition" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3" aria-hidden="true">🎉</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your path is ready</h1>
          <p className="text-slate-700">Here&apos;s what was built from your answers, and where to start.</p>
        </div>

        {/* Personalised plan summary, straight from the agents */}
        {(goals.length > 0 || firstMilestone) && (
          <div className="border border-slate-300 rounded-2xl p-6 mb-6 surface">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-700" aria-hidden="true" />
              <h2 className="font-bold text-slate-900">Your personalised plan</h2>
            </div>
            {goals.length > 0 && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Goals: </span>{goals.join(' · ')}</div>
            )}
            {norms.length > 0 && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Norms considered: </span>{norms.join(' · ')}</div>
            )}
            {firstMilestone && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">First milestone: </span>{firstMilestone}</div>
            )}
            {milestoneCount > 0 && (
              <div className="text-sm text-slate-700"><span className="font-semibold">Milestones planned: </span>{milestoneCount}</div>
            )}
          </div>
        )}

        {/* Start here: one ordered list, one primary button. */}
        <div className="border border-indigo-200 rounded-2xl p-6 mb-6 surface">
          <h2 className="font-bold text-slate-900 mb-3">Start here</h2>
          <ol className="space-y-3 text-slate-800">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white" aria-hidden="true">1</span>
              <span><span className="font-semibold">Open your Path.</span> Each goal is shown as a race with its milestones.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white" aria-hidden="true">2</span>
              <span>
                <span className="font-semibold">Begin with your first milestone</span>
                {firstMilestone ? <>: &ldquo;{firstMilestone}&rdquo;.</> : '.'} Opening it shows tools that can help with it.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white" aria-hidden="true">3</span>
              <span>
                <span className="font-semibold">Find services in </span>
                <Link href="/go/servicehub" className="font-semibold text-indigo-800 underline underline-offset-2">ResourceHub</Link>
                <span className="font-semibold">.</span> If you skipped your location, it will ask for your city so it can show places near you.
              </span>
            </li>
          </ol>

          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => setLaunching(true)}
              disabled={launching}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-lg font-bold transition-colors"
            >
              <Rocket className="w-5 h-5" aria-hidden="true" /> Go to my Path
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
              className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
            >
              <PlayCircle className="w-4 h-4" aria-hidden="true" /> Take the one-minute tour first
            </button>
          </div>
        </div>

        {/* How the pieces connect, the same order the landing page uses. */}
        <div className="border border-slate-200 rounded-2xl p-6 mb-6 surface">
          <h2 className="font-bold text-slate-900 mb-3">How the pieces connect</h2>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-800">
            {CONNECTIONS.map((c, i) => (
              <li key={c} className="flex items-center gap-2">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">{c}</span>
                {i < CONNECTIONS.length - 1 && <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-slate-700">
            Milestones suggest tools, ResourceHub finds services, the calendar schedules the next steps, and the
            journal is where you look back. You can replay the tour anytime with &ldquo;How it works&rdquo; (the &#9654; button) in the top bar.
          </p>
        </div>

        {/* Later: people. Secondary, so it sits last. */}
        <p className="text-sm text-slate-700 text-center">
          Later, when you&apos;re ready: find role models and mentors in Hare World, from People on your Path.
        </p>
      </div>
    </div>
  )
}
