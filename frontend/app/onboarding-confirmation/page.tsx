'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Rocket, PlayCircle, ArrowRight, CheckCircle2, Map as MapIcon } from 'lucide-react'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import OnboardingFeedback from '../components/OnboardingFeedback'
import { useAgentPath } from '../context/AgentPathContext'
import { usePreferences } from '../context/usePreferences'
import Define from '../components/Define'
import { START_GOALS, isStartGoal, isStartRole, pathwayTitle } from '@/lib/startHere'
import MediaPlayer from '../components/MediaPlayer'
import { HOW_TO, lengthLabel } from '@/lib/media'
import ProfileCompletion from '../components/ProfileCompletion'
import CrisisLines from '../components/CrisisLines'

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
  // A parent's needs (Riipen Labs, Group 24): the starter kits, step by step.
  assessment: { title: 'Open the starter kit for an autism assessment.', body: 'Step by step, from what you notice to the Ontario Autism Program, with places that can help.', href: '/kits/assessment', cta: 'Open the starter kit' },
  school: { title: 'Open the starter kit for support at school.', body: 'What an IEP and an IPRC are, how to ask, and what the school has to do.', href: '/kits/school', cta: 'Open the starter kit' },
  urgent: { title: 'Who to call, if you need help right now.', body: 'Free lines, open at any time.', href: '/help#talk-now', cta: 'Who to call' },
}

// A first step that fits who someone is here for (Riipen Labs, Group 3: "a
// short personalized starter pathway for each user").
const FOR_ROLE: Record<string, StartItem> = {
  child: { title: 'Open the starter kits for parents.', body: 'Getting an autism assessment, and support at school, step by step (Ontario).', href: '/kits', cta: 'Open the starter kits' },
  family: { title: 'Planning with a family member under 18?', body: 'On the Family page you can add them and manage their path.', href: '/family', cta: 'Open Family' },
  work: { title: 'Find tools and services to recommend.', body: 'Search ResourceHub for what has helped others, with ratings from people with similar norms.', href: '/go/servicehub?next=/search', cta: 'Find tools and services' },
  ally: { title: 'Learn from people with lived experience.', body: 'Questions and answers in Tidbits, from neurodivergent people and their families.', href: '/go/servicehub?next=/community', cta: 'Read Tidbits' },
}

export default function OnboardingConfirmationPage() {
  const router = useRouter()
  const { payload, pathPlanning } = useAgentPath()
  const [launching, setLaunching] = useState(false)
  const { prefs } = usePreferences()
  type Start = { for: string; need: string }
  const [choices, setChoices] = useState<{ lookingFor?: string[]; audience?: string | null; startPath?: Start | null; suggestedStart?: Start | null; setupEnergy?: string | null }>({})
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('autinerary_onboarding_choices') || 'null')
      if (saved) setChoices(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!launching) return
    const timer = window.setTimeout(() => router.replace('/path'), 1200)
    return () => window.clearTimeout(timer)
  }, [launching, router])

  const goals: string[] = (payload?.userProfile?.goals || []) as string[]
  const norms: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const firstMilestone = pathPlanning?.milestones?.[0]?.name
  const milestoneCount = (pathPlanning?.milestones || []).length

  // Lead with what they came for, in the order they picked it; a plan (or no
  // answer) leads with the Path as before.
  const lookingFor = choices.lookingFor?.length ? choices.lookingFor : prefs.lookingFor || []
  // Starter resources (Riipen Labs, Group 4's "Start here"). The pathway saved
  // before signing up ("Save this path") is the most specific thing they came
  // for, so it leads. Without one, a pathway picked from their setup answers
  // is offered (Group 5: a personalized "Start Here" resource right after the
  // short start); it leads only when they came for something other than a
  // plan. Either way it replaces the general link for the same need.
  const valid = (s?: Start | null): s is Start => Boolean(s && isStartRole(s.for) && isStartGoal(s.need))
  const savedStart = valid(choices.startPath) ? choices.startPath : valid(prefs.startPath) ? prefs.startPath : null
  const suggested = valid(choices.suggestedStart) ? choices.suggestedStart : null
  const start = savedStart || suggested
  const starterItem: StartItem | undefined = start
    ? savedStart
      ? {
          title: 'Open your starter resources.',
          body: `${pathwayTitle(start.for, start.need)}, saved from before you signed up.`,
          href: '/start',
          cta: 'See your starter resources',
        }
      : {
          title: 'See your starter resources.',
          body: `${pathwayTitle(start.for, start.need)}, picked from your answers.`,
          href: `/start?for=${start.for}&need=${start.need}`,
          cta: 'See your starter resources',
        }
    : undefined
  const starterCovers = start ? START_GOALS.find((g) => g.id === start.need)?.lookingFor : null
  const interestItems = Array.from(new Map(
    lookingFor.filter((k) => INTERESTS[k] && k !== starterCovers).map((k) => [INTERESTS[k].href, INTERESTS[k]] as const),
  ).values())
  const cameForMoreThanAPlan = lookingFor.length > 0 && lookingFor[0] !== 'plan'
  const starterLeads = Boolean(starterItem && (savedStart || cameForMoreThanAPlan))
  const primaryInterest = starterLeads ? starterItem : cameForMoreThanAPlan ? interestItems[0] : undefined
  const pathItems: StartItem[] = [
    { title: 'Open your Path.', body: 'Each goal is shown as a race with its milestones.' },
    {
      title: firstMilestone ? `Begin with your first milestone: \u201c${firstMilestone}\u201d.` : 'Begin with your first milestone.',
      body: 'Opening it shows tools that can help with it.',
    },
  ]
  const roleItem = FOR_ROLE[choices.audience || prefs.audience || '']
  // The energy check-in (Riipen Labs, Group 23): "Not much" ends here with one
  // button and nothing else asked; "Plenty" gets the optional questions now.
  const energy = choices.setupEnergy || (prefs as { setupEnergy?: string }).setupEnergy || ''
  const low = energy === 'low'
  const ordered = starterLeads && starterItem
    ? [starterItem, ...pathItems, ...interestItems]
    : primaryInterest
      ? [...interestItems, ...pathItems]
      : starterItem
        ? [...pathItems, starterItem, ...interestItems]
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Opening your Path</h1>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        {/* No confetti emoji (Riipen Labs, Group 18: emoji-heavy screens read
            as generic and untrustworthy); and what a path is, said where the
            word is first used (Groups 16 and 19). */}
        <div className="text-center mb-8">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-700" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Your path is ready</h1>
          <p className="text-slate-700">Here&apos;s what was built from your answers, and where to start.</p>
          <p className="mt-1 text-sm"><Define term="path" ask /></p>
        </div>

        {/* Personalised plan summary, straight from the agents */}
        {(goals.length > 0 || firstMilestone) && (
          <div className="border border-slate-300 rounded-2xl p-6 mb-6 surface">
            <div className="flex items-center gap-2 mb-3">
              <MapIcon className="w-5 h-5 text-indigo-700" aria-hidden="true" />
              <h2 className="font-bold text-slate-900">Your plan</h2>
            </div>
            {goals.length > 0 && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Goals: </span>{goals.join(' · ')}</div>
            )}
            {norms.length > 0 && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Norms considered: </span>{norms.join(' · ')}</div>
            )}
            {firstMilestone && (
              <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">First <Define term="milestone" />: </span>{firstMilestone}</div>
            )}
            {milestoneCount > 0 && (
              <div className="text-sm text-slate-700"><span className="font-semibold">Milestones planned: </span>{milestoneCount}</div>
            )}
            {/* Riipen Labs, Group 32: "value requires engagement". Said once,
                plainly, as the glossary's "Your plan" says it. */}
            <p className="mt-3 text-sm text-slate-800">
              It grows with what you put in: each step you tick off brings up the next one, and each optional answer
              you add later, on your Path under &ldquo;Complete your profile&rdquo;, makes the suggestions fit you better.
            </p>
          </div>
        )}

        {/* Help right now first, if they asked for it (Group 24). */}
        {lookingFor.includes('urgent') && <CrisisLines className="mb-6" ontario={['child', 'family'].includes(choices.audience || prefs.audience || '')} />}

        {low && (
          <p className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-slate-800">
            That&apos;s all for today. Everything else can wait until you have more energy, and nothing changes by itself.
          </p>
        )}

        {/* Start here: one ordered list, one primary button. The button is
            whatever they said they came for first. */}
        <div className="border border-indigo-200 rounded-2xl p-6 mb-6 surface">
          <h2 className="font-bold text-slate-900 mb-3">Start here</h2>
          <ol className="space-y-3 text-slate-800">
            {startItems.slice(0, low ? 2 : 4).map((item, i) => (
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
            {!low && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
                className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
              >
                <PlayCircle className="w-4 h-4" aria-hidden="true" /> Take the two-minute tour
              </button>
            )}
          </div>
          {low && (
            <p className="mt-3 text-sm text-slate-700">When you have more energy, &ldquo;How it works&rdquo; in the top bar explains each page.</p>
          )}
        </div>

        {/* "Plenty": the fuller setup, now and still optional (Group 23: route
            people "to either a short essentials-only path or the fuller
            setup"). The same questions as the Path's card, all at once. */}
        {energy === 'plenty' && (
          <section aria-labelledby="set-up-more" className="mb-6">
            <h2 id="set-up-more" className="mb-2 text-xl font-bold text-slate-900">Set up more now, if you like</h2>
            <p className="mb-3 text-sm text-slate-700">You said you had energy for more. Each answer makes your plan fit you better. Skip any of them.</p>
            <ProfileCompletion variant="page" />
          </section>
        )}

        {!low && (<>

        {/* The "how to use the app" video (Riipen Labs, Group 11), folded
            away so it is there for anyone who prefers to watch. */}
        <details className="border border-slate-200 rounded-2xl p-6 mb-6 surface">
          <summary className="cursor-pointer font-bold text-slate-900">
            Prefer to watch? How to use your Path ({lengthLabel(HOW_TO.seconds)})
          </summary>
          <div className="mt-4">
            <MediaPlayer item={HOW_TO} />
          </div>
        </details>

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
            journal is where you look back. You can replay the tour anytime with the &#9654; button in the top bar: &ldquo;How it works&rdquo;, or &ldquo;Guide&rdquo; on a phone.
          </p>
        </div>

        {/* How the plan was made, folded away: AI named where it worked,
            not as the page's first word (Riipen Labs, Group 18: introduce AI
            "transparently only at the specific step where it functions";
            Group 16: the AI notes after setup were "overwhelming", "a note
            and some information, then a box of options, followed by more
            text"). Group 5: keep AI personalization "running behind the
            scenes until basic onboarding is fully completed". */}
        <details className="border border-slate-200 rounded-2xl p-6 mb-6 surface">
          <summary className="cursor-pointer font-bold text-slate-900">How your plan was made</summary>
          <p className="mt-3 text-sm text-slate-700">
            AI wrote your plan&apos;s steps, and the tools suggested for them, from your answers. The low, balanced and high-energy
            days are worked out by fixed rules. Nothing here is medical or clinical advice.{' '}
            <Link href="/help#ai" className="font-medium text-indigo-800 underline underline-offset-2">How Autinerary uses AI</Link>
          </p>
          <div className="mt-3 space-y-3">
            <AgentInsightsBanner agent="path_planning" />
            <AgentInsightsBanner agent="pattern_recognition" />
          </div>
        </details>

        <OnboardingFeedback />

        {/* Email and notification choices are not asked here any more: they
            come after a first step, on the Path's "Complete your profile"
            card from the next day, and are always in Settings, under Emails
            (Riipen Labs, Group 15: "Guarantee one concrete, useful action
            before any friction (forms, upgrade prompts, notifications
            asks)"; Group 18: questions "presented immediately ... with no
            actual use of the product"). */}

        {/* Later: people. Secondary, so it sits last. */}
        <p className="text-sm text-slate-700 text-center">
          Later, when you&apos;re ready: find role models and mentors in Hare World, from People on your Path.
        </p>
        </>)}
      </div>
    </div>
  )
}
