'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeft,
  Search,
  Stethoscope,
  Home,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Users,
  Palette,
  Plane,
  Sparkles,
  Clock,
} from 'lucide-react'

/**
 * Path Market — a catalog of ready-made "paths" (goal roadmaps) users can start
 * from, grouped by life domain. During Phase 3 these are templates we seed and
 * refine; starting one pre-fills onboarding goals for that domain.
 */

type Status = 'live' | 'coming'

interface PathTemplate {
  key: string
  title: string
  blurb: string
  icon: typeof Stethoscope
  tint: string
  iconTint: string
  status: Status
  examples: string[]
  /** Onboarding goal seeds for this template. */
  seedGoals: string[]
  /**
   * Which onboarding goal category this path steers into (a goalCategories id
   * in onboarding). Drives where seed goals land and which category is
   * emphasised, so the flow feels tailored to the chosen path rather than
   * identical to "start your own path".
   */
  focusCategory: string
}

const PATHS: PathTemplate[] = [
  {
    key: 'med-sci',
    title: 'Medicine & Science',
    blurb: 'Pursue a path in healthcare, research, or the sciences with accommodations built in.',
    icon: Stethoscope,
    tint: 'from-sky-50 to-white border-sky-200',
    iconTint: 'bg-sky-100 text-sky-600',
    status: 'live',
    examples: ['Pre-med prerequisites', 'Research assistant roles', 'Lab / clinical skills', 'Grad-school applications'],
    seedGoals: ['Get into a science/medicine program', 'Build research experience'],
    focusCategory: 'education',
  },
  {
    key: 'living',
    title: 'Independent Living',
    blurb: 'Build the skills and supports to live on your own terms — home, money, and daily routines.',
    icon: Home,
    tint: 'from-emerald-50 to-white border-emerald-200',
    iconTint: 'bg-emerald-100 text-emerald-600',
    status: 'live',
    examples: ['Budgeting & finances', 'Housing & tenancy', 'Meal planning & cooking', 'Daily-living routines'],
    seedGoals: ['Live independently', 'Manage my own budget'],
    focusCategory: 'other',
  },
  {
    key: 'career',
    title: 'Career & Workplace',
    blurb: 'Land and thrive in a job that fits you — including disclosure and accommodations.',
    icon: Briefcase,
    tint: 'from-amber-50 to-white border-amber-200',
    iconTint: 'bg-amber-100 text-amber-600',
    status: 'live',
    examples: ['Resume & interviews', 'Accommodation requests', 'Workplace social norms', 'Career growth'],
    seedGoals: ['Get a fulfilling job', 'Request workplace accommodations'],
    focusCategory: 'career',
  },
  {
    key: 'education',
    title: 'Education',
    blurb: 'Navigate school, college, or trade programs with the right supports at each step.',
    icon: GraduationCap,
    tint: 'from-indigo-50 to-white border-indigo-200',
    iconTint: 'bg-indigo-100 text-indigo-600',
    status: 'live',
    examples: ['Accommodations at school', 'Study strategies', 'Applications & funding', 'Graduation planning'],
    seedGoals: ['Graduate from my program', 'Set up school accommodations'],
    focusCategory: 'education',
  },
  {
    key: 'health',
    title: 'Health & Wellness',
    blurb: 'Support your physical and mental health with routines, care, and self-advocacy.',
    icon: HeartPulse,
    tint: 'from-rose-50 to-white border-rose-200',
    iconTint: 'bg-rose-100 text-rose-600',
    status: 'live',
    examples: ['Finding the right care', 'Managing appointments', 'Wellness routines', 'Self-advocacy in healthcare'],
    seedGoals: ['Build a wellness routine', 'Find supportive healthcare'],
    focusCategory: 'health',
  },
  {
    key: 'relationships',
    title: 'Relationships & Community',
    blurb: 'Build and keep meaningful connections — friends, family, and community.',
    icon: Users,
    tint: 'from-purple-50 to-white border-purple-200',
    iconTint: 'bg-purple-100 text-purple-600',
    status: 'live',
    examples: ['Making friends', 'Communication skills', 'Joining communities', 'Navigating family'],
    seedGoals: ['Build a support network', 'Improve my communication'],
    focusCategory: 'relationships',
  },
  {
    key: 'creative',
    title: 'Creative & Hobbies',
    blurb: 'Turn interests into skills or income — art, music, making, and more.',
    icon: Palette,
    tint: 'from-fuchsia-50 to-white border-fuchsia-200',
    iconTint: 'bg-fuchsia-100 text-fuchsia-600',
    status: 'coming',
    examples: ['Develop a craft', 'Share your work', 'Find creative community', 'Monetize a hobby'],
    seedGoals: ['Grow a creative skill'],
    focusCategory: 'other',
  },
  {
    key: 'travel',
    title: 'Travel & Independence',
    blurb: 'Plan sensory-aware travel and build confidence getting around.',
    icon: Plane,
    tint: 'from-cyan-50 to-white border-cyan-200',
    iconTint: 'bg-cyan-100 text-cyan-600',
    status: 'coming',
    examples: ['Sensory-friendly trip planning', 'Public transit confidence', 'Travel checklists', 'Accessible destinations'],
    seedGoals: ['Plan a trip', 'Get comfortable with transit'],
    focusCategory: 'other',
  },
]

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  live: { label: 'Available', cls: 'bg-emerald-100 text-emerald-700' },
  coming: { label: 'Coming soon', cls: 'bg-slate-100 text-slate-600' },
}

export default function PathMarketPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = PATHS.filter((p) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      p.title.toLowerCase().includes(q) ||
      p.blurb.toLowerCase().includes(q) ||
      p.examples.some((e) => e.toLowerCase().includes(q))
    )
  })

  const startPath = (p: PathTemplate) => {
    // Seed onboarding with this path's context, then send the user into onboarding.
    // We carry the focus category and example goals so onboarding can tailor the
    // flow to the chosen path instead of showing the generic "start your own path"
    // experience.
    try {
      localStorage.setItem(
        'autinerary_path_seed',
        JSON.stringify({
          key: p.key,
          title: p.title,
          goals: p.seedGoals,
          focusCategory: p.focusCategory,
          suggestions: p.examples,
        })
      )
    } catch {
      /* ignore */
    }
    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-cyan-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Path Market</h1>
          </div>
          <p className="text-slate-600 max-w-2xl">
            Start from a ready-made path built for a life domain. Pick one to pre-fill your goals —
            you can always customize it during onboarding.
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search paths (e.g. medicine, living, career)…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => {
            const Icon = p.icon
            const status = STATUS_META[p.status]
            return (
              <div
                key={p.key}
                className={`rounded-2xl border-2 bg-gradient-to-br ${p.tint} p-5 shadow-sm flex flex-col`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${p.iconTint}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.cls}`}>
                    {p.status === 'coming' && <Clock className="inline w-3 h-3 mr-1" aria-hidden="true" />}
                    {status.label}
                  </span>
                </div>
                <h2 className="font-bold text-slate-900 mb-1">{p.title}</h2>
                <p className="text-sm text-slate-600 mb-3">{p.blurb}</p>
                <ul className="space-y-1 mb-4 flex-1">
                  {p.examples.map((ex) => (
                    <li key={ex} className="text-xs text-slate-500 flex items-start gap-1.5">
                      <span className="text-slate-400">•</span> {ex}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() =>
                    p.status === 'coming'
                      ? router.push(`/under-construction?feature=${encodeURIComponent(p.title)}`)
                      : startPath(p)
                  }
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    p.status === 'coming'
                      ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg'
                  }`}
                >
                  {p.status === 'coming' ? 'Coming soon →' : 'Start this path →'}
                </button>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No paths match “{query}”. Try a different search, or{' '}
            <Link href="/onboarding" className="text-cyan-600 hover:underline">start from scratch</Link>.
          </div>
        )}
      </div>
    </div>
  )
}
