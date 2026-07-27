'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Home,
  Waves,
  MessageCircle,
  Clock,
  Plus,
} from 'lucide-react'

const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'
import { goHubHref } from '@/lib/serviceHub'

/**
 * Resource Roadmap — a placeholder screen for resource *types* we are seeding
 * during Phase 3 testing and will fill in with real, rated resources later.
 * Each category is a life-domain bucket; the items are example sub-types so the
 * team (and testers) can see the intended shape before content lands.
 */

type Status = 'planned' | 'seeding' | 'live'

interface Category {
  key: string
  title: string
  blurb: string
  icon: typeof ShieldCheck
  tint: string
  iconTint: string
  status: Status
  examples: string[]
  /** Optional live destination (e.g. Tidbits already exists). */
  href?: string
  external?: boolean
}

const CATEGORIES: Category[] = [
  {
    key: 'legacy',
    title: 'After‑death / "What if I\'m not here" planning',
    blurb:
      'Peace-of-mind planning for families: what happens to care, finances, and support if a parent or caregiver is no longer around.',
    icon: ShieldCheck,
    tint: 'from-rose-50 to-white border-rose-200',
    iconTint: 'bg-rose-100 text-rose-600',
    status: 'planned',
    examples: [
      'Special-needs trusts & estate planning',
      'Guardianship & future-care letters',
      'Life / disability insurance guidance',
      'Government benefits continuity (ODSP, etc.)',
    ],
  },
  {
    key: 'workplace',
    title: 'Workplace — fitting in',
    blurb:
      'Support for thriving at work: understanding unwritten social rules, requesting accommodations, and disclosure decisions.',
    icon: Briefcase,
    tint: 'from-amber-50 to-white border-amber-200',
    iconTint: 'bg-amber-100 text-amber-600',
    status: 'seeding',
    examples: [
      'Accommodation request templates',
      'Disclosure: when & how',
      'Navigating workplace social norms',
      'Neurodiversity-friendly employers',
    ],
  },
  {
    key: 'society',
    title: 'Functioning in society',
    blurb:
      'Living independently — socially, economically, and day-to-day: managing a home, money, and relationships on your own terms.',
    icon: Home,
    tint: 'from-sky-50 to-white border-sky-200',
    iconTint: 'bg-sky-100 text-sky-600',
    status: 'seeding',
    examples: [
      'Independent-living skills',
      'Budgeting & financial independence',
      'Building & keeping friendships',
      'Public services & self-advocacy',
    ],
  },
  {
    key: 'afterschool',
    title: 'After‑school & activities',
    blurb:
      'Enriching activities outside the classroom — movement, animals, and hobbies that build confidence and joy.',
    icon: Waves,
    tint: 'from-emerald-50 to-white border-emerald-200',
    iconTint: 'bg-emerald-100 text-emerald-600',
    status: 'planned',
    examples: [
      'Adaptive swimming programs',
      'Equestrian / therapeutic riding',
      'Animal-assisted therapy',
      'Sensory-friendly clubs & camps',
    ],
  },
  {
    key: 'tidbits',
    title: 'Tidbits — community Q&A',
    blurb:
      'Ask, share, and learn from people facing the same barriers. Pseudonymous, tagged by barrier, and already live.',
    icon: MessageCircle,
    tint: 'from-indigo-50 to-white border-indigo-200',
    iconTint: 'bg-indigo-100 text-indigo-600',
    status: 'live',
    examples: [
      'Tagged barrier Q&A threads',
      'What worked for people like you',
      'Ask for help anonymously',
      'Accepted-solution insights',
    ],
    href: goHubHref('/community?from=hare-world&context=resource-roadmap'),
    external: true,
  },
]

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  planned: { label: 'Planned', cls: 'bg-slate-100 text-slate-600' },
  seeding: { label: 'Seeding now', cls: 'bg-amber-100 text-amber-700' },
  live: { label: 'Live', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function ResourceRoadmapPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-cyan-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Resource Roadmap</h1>
          </div>
          <p className="text-slate-600 max-w-2xl">
            The resource types we&apos;re building next. These life-domain areas are being seeded
            during Phase&nbsp;3 testing and will fill in with real, community-rated resources over
            time. Tap any live area to explore what&apos;s already there.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            const status = STATUS_META[c.status]
            const Inner = (
              <div
                className={`h-full rounded-2xl border-2 bg-gradient-to-br ${c.tint} p-5 shadow-sm transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.iconTint}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.cls}`}>
                    {c.status !== 'live' && <Clock className="inline w-3 h-3 mr-1" aria-hidden="true" />}
                    {status.label}
                  </span>
                </div>
                <h2 className="font-bold text-slate-900 mb-1">{c.title}</h2>
                <p className="text-sm text-slate-600 mb-3">{c.blurb}</p>
                <ul className="space-y-1.5">
                  {c.examples.map((ex) => (
                    <li key={ex} className="flex items-start gap-2 text-xs text-slate-500">
                      <Plus className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                      {ex}
                    </li>
                  ))}
                </ul>
                {c.href && (
                  <div className="mt-3 text-sm font-medium text-cyan-700">
                    {c.status === 'live' ? 'Explore now →' : 'Preview →'}
                  </div>
                )}
              </div>
            )
            if (c.href) {
              return c.external ? (
                <a key={c.key} href={c.href} target="_blank" rel="noopener noreferrer" className="block">
                  {Inner}
                </a>
              ) : (
                <Link key={c.key} href={c.href} className="block">
                  {Inner}
                </Link>
              )
            }
            return <div key={c.key}>{Inner}</div>
          })}
        </div>

        <div className="mt-8 rounded-2xl border-2 border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-600">
            Want to help fill these in? Recommend a resource and it&apos;ll be reviewed, then powers
            Autinerary once approved.
          </p>
          <a
            href={goHubHref('/resources/new?from=hare-world')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Recommend a resource
          </a>
        </div>
      </div>
    </div>
  )
}
