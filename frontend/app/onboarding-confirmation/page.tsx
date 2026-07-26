'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Users, ChevronRight, Rocket } from 'lucide-react'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { useAgentPath } from '../context/AgentPathContext'

/**
 * Post-onboarding confirmation.
 *
 * Shows the REAL agent-generated plan summary (goals, barriers, first
 * milestone) and points the user at Hare World to find real role models and
 * mentors. The previous version was a two-step selection wizard over
 * fabricated people ("Sarah Chen", "Lisa Park") whose choices were never
 * saved anywhere — all of that is gone. Connections made in Hare World are
 * real rows in social_connections and appear across the app.
 */
export default function OnboardingConfirmationPage() {
  const router = useRouter()
  const { payload, pathPlanning } = useAgentPath()

  const goals: string[] = (payload?.userProfile?.goals || []) as string[]
  const barriers: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const firstMilestone = pathPlanning?.milestones?.[0]?.name
  const milestoneCount = (pathPlanning?.milestones || []).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-purple-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-3 mb-6">
          <AgentInsightsBanner agent="path_planning" />
          <AgentInsightsBanner agent="pattern_recognition" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your path is ready</h1>
          <p className="text-slate-600">Here&apos;s what your agents built from your onboarding.</p>
        </div>

        {/* Personalised plan summary — straight from the agents */}
        {(goals.length > 0 || firstMilestone) && (
          <div className="bg-white/70 backdrop-blur-lg border border-slate-300 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="font-bold text-slate-900">Your personalised plan</h2>
            </div>
            {goals.length > 0 && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Goals: </span>{goals.join(' · ')}</div>
            )}
            {barriers.length > 0 && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Barriers considered: </span>{barriers.join(' · ')}</div>
            )}
            {firstMilestone && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">First milestone: </span>{firstMilestone}</div>
            )}
            {milestoneCount > 0 && (
              <div className="text-sm text-slate-700"><span className="font-semibold">Milestones planned: </span>{milestoneCount}</div>
            )}
          </div>
        )}

        {/* Find your people — real connections, not a pre-picked sample list */}
        <div className="bg-white/70 backdrop-blur-lg border border-purple-200 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold text-slate-900">Find role models &amp; mentors</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Connect with real people in Hare World — search for role models, mentors, and friends.
            Anyone you connect with shows up on your Path and can share their journey with you.
          </p>
          <Link
            href="/pit-stop?tab=haveworld&view=people"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:shadow-lg transition-all"
          >
            <Users className="w-4 h-4" /> Meet people in Hare World <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Continue */}
        <div className="text-center">
          <button
            onClick={() => router.push('/path')}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-lg font-bold hover:shadow-xl transition-all"
          >
            <Rocket className="w-5 h-5" /> Go to my Path
          </button>
          <p className="text-xs text-slate-400 mt-3">You can find people and fine-tune everything later.</p>
        </div>
      </div>
    </div>
  )
}
