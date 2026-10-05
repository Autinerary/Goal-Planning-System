'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Rocket, PlayCircle, ArrowRight } from 'lucide-react'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import OnboardingFeedback from '../components/OnboardingFeedback'
import { useAgentPath } from '../context/AgentPathContext'
import { usePreferences } from '../context/usePreferences'
import PushOptIn from '../components/PushOptIn'
import { START_GOALS, isStartGoal, isStartRole, pathwayTitle } from '@/lib/startHere'

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

// What each "What are you looking for today?" answer leads to first (Riipen
// Labs, Group 2: people who arrive with a specific need "may want to reach
// useful content quickly"). Community and learning both lead to Tidbits.
type StartItem = { title: string; body: string; href?: string; cta?: string }
const INTERESTS: Record<string, StartItem> = {
  services: { title: 'Find services in ResourceHub.', body: 'Search places and services, with ratings from people with similar norms. If you skipped your location, it will ask for your city so it can show places near you.', href: '/go/servicehub?next=/search', cta: 'Find services now' },
  community: { title: 'Read and ask in Tidbits.', body: 'Questions and answers from people with similar experiences.', href: '/go/servicehub?next=/community', cta: 'See what people say' },
  learning: { title: 'Learn from others in Tidbits.', body: 'Questions and answers from people with similar experiences.', href: '/go/servicehub?next=/community', cta: 'Start learning' },
  tools: { title: 'Browse tools, apps and products.', body: 'Things other people found useful, in the ResourceHub shop.', href: '/go/servicehub?next=/shop', cta: 'Browse tools' },
}

// A first step that fits who someone is here for (Riipen Labs, Group 3: "a
// short personalized starter pathway for each user").
const FOR_ROLE: Record<string, StartItem> = {
  child: { title: 'Add your child, if they are under 18.', body: 'On the Family page you can add a family member and manage their path.', href: '/family', cta: 'Open Family' },
  family: { title: 'Planning with a family member under 18?', body: 'On the Family page you can add them and manage their path.', href: '/family', cta: 'Open Family' },
  work: { title: 'Find tools and services to recommend.', body: 'Search ResourceHub for what has helped others, with ratings from people with similar norms.', href: '/go/servicehub?next=/search', cta: 'Find tools and services' },
  ally: { title: 'Learn from people with lived experience.', body: 'Questions and answers in Tidbits, from neurodivergent people and their families.', href: '/go/servicehub?next=/community', cta: 'Read Tidbits' },
}

export default function OnboardingConfirmationPage() {
  const router = useRouter()
  const { payload, pathPlanning } = useAgentPath()
  const [launching, setLaunching] = useState(false)
  const { prefs, update } = usePreferences()
  const [choices, setChoices] = useState<{ lookingFor?: string[]; audience?: string | null; startPath?: { for: string; need: string } | null }>({})
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('autinerary_onboarding_choices') || 'null')
      if (saved) setChoices(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!launching) return
    const timer = window.setTimeout(() => router.push('/path'), 1200)
    return () => window.clearTimeout(timer)
  }, [launching, router])

  const goals: string[] = (payload?.userProfile?.goals || []) as string[]
  const norms: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const firstMilestone = pathPlanning?.milestones?.[0]?.name
  const milestoneCount = (pathPlanning?.milestones || []).length

  // Lead with what they came for, in the order they picked it; a plan (or no
  // answer) leads with the Path as before.
  const lookingFor = choices.lookingFor?.length ? choices.lookingFor : prefs.lookingFor || []
  // The "Start here" pathway they saw before signing up (Riipen Labs, Group
  // 4: "Save this path") is the most specific thing they came for, so it
  // leads, in place of the general link for the same need.
  const startPath = choices.startPath || prefs.startPath
  const starterItem: StartItem | undefined = startPath && isStartRole(startPath.for) && isStartGoal(startPath.need)
    ? {
        title: 'Open your starter resources.',
        body: `${pathwayTitle(startPath.for, startPath.need)}, saved from before you signed up.`,
        href: '/start',
        cta: 'See your starter resources',
      }
    : undefined
  const starterCovers = starterItem ? START_GOALS.find((g) => g.id === startPath?.need)?.lookingFor : null
  const interestItems = Array.from(new Map(
    lookingFor.filter((k) => INTERESTS[k] && k !== starterCovers).map((k) => [INTERESTS[k].href, INTERESTS[k]] as const),
  ).values())
  const primaryInterest = starterItem || (lookingFor.length > 0 && lookingFor[0] !== 'plan' ? interestItems[0] : undefined)
  const pathItems: StartItem[] = [
    { title: 'Open your Path.', body: 'Each goal is shown as a race with its milestones.' },
    {
      title: firstMilestone ? `Begin with your first milestone: \u201c${firstMilestone}\u201d.` : 'Begin with your first milestone.',
      body: 'Opening it shows tools that can help with it.',
    },
  ]
  const roleItem = FOR_ROLE[choices.audience || prefs.audience || '']
  const ordered = starterItem
    ? [starterItem, ...pathItems, ...interestItems]
    : primaryInterest
      ? [...interestItems, ...pathItems]
      : [...pathItems, ...(interestItems.length ? interestItems : [INTERESTS.services])]
  // The role's step goes second, after the one thing they came for; never twice.
  const startItems: StartItem[] = (roleItem && !ordered.some((i) => i.href && i.href === roleItem.href)
    ? [ordered[0], roleItem, ...ordered.slice(1)]
    : ordered
  ).slice(0, 4)

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

        {/* Start here: one ordered list, one primary button. The button is
            whatever they said they came for first. */}
        <div className="border border-indigo-200 rounded-2xl p-6 mb-6 surface">
          <h2 className="font-bold text-slate-900 mb-3">Start here</h2>
          <ol className="space-y-3 text-slate-800">
            {startItems.map((item, i) => (
              <li key={item.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
                <span>
                  {item.href ? (
                    <Link href={item.href} className="font-semibold text-indigo-800 underline underline-offset-2">{item.title}</Link>
                  ) : (
                    <span className="font-semibold">{item.title}</span>
                  )}{' '}
                  {item.body}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {primaryInterest ? (
              <>
                <Link
                  href={primaryInterest.href!}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-lg font-bold transition-colors"
                >
                  {primaryInterest.cta} <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setLaunching(true)}
                  disabled={launching}
                  className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
                >
                  <Rocket className="w-4 h-4" aria-hidden="true" /> Go to my Path
                </button>
              </>
            ) : (
              <button
                onClick={() => setLaunching(true)}
                disabled={launching}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-lg font-bold transition-colors"
              >
                <Rocket className="w-5 h-5" aria-hidden="true" /> Go to my Path
              </button>
            )}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
              className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
            >
              <PlayCircle className="w-4 h-4" aria-hidden="true" /> Take the one-minute tour
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

        <OnboardingFeedback />

        {/* Riipen Labs, Group 2: "add email and notification opt-in so a
            check-in can reach users who stop opening the app". Off unless
            chosen; the same switch is in Settings. */}
        <div className="border border-slate-200 rounded-2xl p-6 mb-6 surface">
          <h2 className="font-bold text-slate-900 mb-2">If you stop using Autinerary</h2>
          <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(prefs.checkin?.optIn)}
              onChange={(e) => update({ checkin: { optIn: e.target.checked, updatedAt: new Date().toISOString() } })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
            />
            <span>
              Email me one short question if I haven&apos;t opened Autinerary for two weeks, so the team can fix
              what got in the way. You can turn this off anytime in Settings.
            </span>
          </label>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <PushOptIn />
          </div>
        </div>

        {/* Later: people. Secondary, so it sits last. */}
        <p className="text-sm text-slate-700 text-center">
          Later, when you&apos;re ready: find role models and mentors in Hare World, from People on your Path.
        </p>
      </div>
    </div>
  )
}
