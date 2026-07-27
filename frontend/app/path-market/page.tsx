'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  User,
  Plus,
  X,
  Loader2,
  Send,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Path Market — 3 layers (Odosa):
 *   1. Your Norms      — the systemic realities you navigate (top context).
 *   2. Life Categories — a domain of life (e.g. Medicine & Science).
 *   3. Models          — specific, named path models within a category. Each
 *                        model is what you actually "Start this Path" from, and
 *                        can carry a contributor + a short description.
 *
 * Seed models are the general starter path per category; community-contributed,
 * named models (e.g. a "Model Madhu") get appended to each category's `models`.
 */

type Status = 'live' | 'coming'

type ModelStatus = Status | 'pending'

interface PathModel {
  key: string
  /** Unique model name (e.g. "Foundations" or "Model Madhu"). */
  name: string
  /** Who contributed this model (a real person), when applicable. */
  contributor?: string | null
  /** Short description of how this path model differs from others. */
  description: string
  seedGoals: string[]
  status: ModelStatus
  /** Set for user-submitted community models. */
  community?: boolean
  isOwn?: boolean
  id?: string
}

interface LifeCategory {
  key: string
  title: string
  blurb: string
  icon: typeof Stethoscope
  tint: string
  iconTint: string
  /** Onboarding goal category this steers into. */
  focusCategory: string
  examples: string[]
  models: PathModel[]
}

/** One general starter model per category (real, community-maintained). */
function starter(key: string, description: string, seedGoals: string[], status: Status): PathModel {
  return { key: `${key}-foundations`, name: 'Foundations', description, seedGoals, status }
}

const CATEGORIES: LifeCategory[] = [
  {
    key: 'med-sci',
    title: 'Medicine & Science',
    blurb: 'Pursue a path in healthcare, research, or the sciences with accommodations built in.',
    icon: Stethoscope,
    tint: 'from-sky-50 to-white border-sky-200',
    iconTint: 'bg-sky-100 text-sky-600',
    focusCategory: 'education',
    examples: ['Pre-med prerequisites', 'Research assistant roles', 'Lab / clinical skills', 'Grad-school applications'],
    models: [
      starter('med-sci', 'The general route into science/medicine — prerequisites, research, and applications.', ['Get into a science/medicine program', 'Build research experience'], 'live'),
    ],
  },
  {
    key: 'living',
    title: 'Independent Living',
    blurb: 'Build the skills and supports to live on your own terms — home, money, and daily routines.',
    icon: Home,
    tint: 'from-emerald-50 to-white border-emerald-200',
    iconTint: 'bg-emerald-100 text-emerald-600',
    focusCategory: 'other',
    examples: ['Budgeting & finances', 'Housing & tenancy', 'Meal planning & cooking', 'Daily-living routines'],
    models: [
      starter('living', 'A grounded start on money, housing, and daily routines for living independently.', ['Live independently', 'Manage my own budget'], 'live'),
    ],
  },
  {
    key: 'career',
    title: 'Career & Workplace',
    blurb: 'Land and thrive in a job that fits you — including disclosure and accommodations.',
    icon: Briefcase,
    tint: 'from-amber-50 to-white border-amber-200',
    iconTint: 'bg-amber-100 text-amber-600',
    focusCategory: 'career',
    examples: ['Resume & interviews', 'Accommodation requests', 'Workplace social norms', 'Career growth'],
    models: [
      starter('career', 'Find work that fits, request accommodations, and grow — the general path.', ['Get a fulfilling job', 'Request workplace accommodations'], 'live'),
    ],
  },
  {
    key: 'education',
    title: 'Education',
    blurb: 'Navigate school, college, or trade programs with the right supports at each step.',
    icon: GraduationCap,
    tint: 'from-indigo-50 to-white border-indigo-200',
    iconTint: 'bg-indigo-100 text-indigo-600',
    focusCategory: 'education',
    examples: ['Accommodations at school', 'Study strategies', 'Applications & funding', 'Graduation planning'],
    models: [
      starter('education', 'Get set up with accommodations and study supports through to graduation.', ['Graduate from my program', 'Set up school accommodations'], 'live'),
    ],
  },
  {
    key: 'health',
    title: 'Health & Wellness',
    blurb: 'Support your physical and mental health with routines, care, and self-advocacy.',
    icon: HeartPulse,
    tint: 'from-rose-50 to-white border-rose-200',
    iconTint: 'bg-rose-100 text-rose-600',
    focusCategory: 'health',
    examples: ['Finding the right care', 'Managing appointments', 'Wellness routines', 'Self-advocacy in healthcare'],
    models: [
      starter('health', 'Build wellness routines and find care that works — the general path.', ['Build a wellness routine', 'Find supportive healthcare'], 'live'),
    ],
  },
  {
    key: 'relationships',
    title: 'Relationships & Community',
    blurb: 'Build and keep meaningful connections — friends, family, and community.',
    icon: Users,
    tint: 'from-purple-50 to-white border-purple-200',
    iconTint: 'bg-purple-100 text-purple-600',
    focusCategory: 'relationships',
    examples: ['Making friends', 'Communication skills', 'Joining communities', 'Navigating family'],
    models: [
      starter('relationships', 'Grow a support network and communication skills at your own pace.', ['Build a support network', 'Improve my communication'], 'live'),
    ],
  },
  {
    key: 'creative',
    title: 'Creative & Hobbies',
    blurb: 'Turn interests into skills or income — art, music, making, and more.',
    icon: Palette,
    tint: 'from-fuchsia-50 to-white border-fuchsia-200',
    iconTint: 'bg-fuchsia-100 text-fuchsia-600',
    focusCategory: 'other',
    examples: ['Develop a craft', 'Share your work', 'Find creative community', 'Monetize a hobby'],
    models: [
      starter('creative', 'Grow a creative skill and share it — the general path.', ['Grow a creative skill'], 'coming'),
    ],
  },
  {
    key: 'travel',
    title: 'Travel & Independence',
    blurb: 'Plan sensory-aware travel and build confidence getting around.',
    icon: Plane,
    tint: 'from-cyan-50 to-white border-cyan-200',
    iconTint: 'bg-cyan-100 text-cyan-600',
    focusCategory: 'other',
    examples: ['Sensory-friendly trip planning', 'Public transit confidence', 'Travel checklists', 'Accessible destinations'],
    models: [
      starter('travel', 'Plan sensory-aware travel and build transit confidence.', ['Plan a trip', 'Get comfortable with transit'], 'coming'),
    ],
  },
]

const STATUS_META: Record<ModelStatus, { label: string; cls: string }> = {
  live: { label: 'Available', cls: 'bg-emerald-100 text-emerald-700' },
  coming: { label: 'Coming soon', cls: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pending review', cls: 'bg-amber-100 text-amber-700' },
}

export default function PathMarketPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [norms, setNorms] = useState<string[]>([])

  // Layer 3: community-submitted models, grouped by category_key.
  const [community, setCommunity] = useState<Record<string, PathModel[]>>({})
  const loadCommunity = () => {
    fetch('/api/path-models', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.byCategory) setCommunity(j.byCategory) })
      .catch(() => {})
  }
  useEffect(() => { loadCommunity() }, [])

  // Submit-a-model modal.
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitDone, setSubmitDone] = useState(false)
  const [form, setForm] = useState({ categoryKey: 'med-sci', name: '', contributor: '', description: '', goalsText: '' })

  const submitModel = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    const seedGoals = form.goalsText.split(/\n|,/).map((g) => g.trim()).filter(Boolean)
    if (!form.name.trim() || form.description.trim().length < 10 || seedGoals.length === 0) {
      setSubmitError('Add a name, a short description (10+ chars), and at least one goal.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/path-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryKey: form.categoryKey,
          name: form.name.trim(),
          contributor: form.contributor.trim() || (user?.name || null),
          description: form.description.trim(),
          seedGoals,
        }),
      })
      const j = await res.json()
      if (!res.ok) { setSubmitError(j.error || 'Could not submit.'); return }
      setSubmitDone(true)
      setForm({ categoryKey: form.categoryKey, name: '', contributor: '', description: '', goalsText: '' })
      loadCommunity()
    } finally {
      setSubmitting(false)
    }
  }

  // Layer 1: the user's Norms (their systemic realities), if onboarding captured
  // them. Read from the locally cached profile; empty pre-onboarding.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('autinerary_profile')
      const parsed = raw ? JSON.parse(raw) : null
      const b = parsed?.barrierTypes
      if (Array.isArray(b)) setNorms(b.filter((x: any) => typeof x === 'string'))
    } catch {
      /* ignore */
    }
  }, [])

  const q = query.trim().toLowerCase()
  // Merge seed models with approved (+ own pending) community models per category.
  const merged = CATEGORIES.map((c) => ({ ...c, models: [...c.models, ...(community[c.key] || [])] }))
  const filtered = merged.map((c) => {
    if (!q) return c
    const catMatch =
      c.title.toLowerCase().includes(q) ||
      c.blurb.toLowerCase().includes(q) ||
      c.examples.some((e) => e.toLowerCase().includes(q))
    const models = catMatch
      ? c.models
      : c.models.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            (m.contributor || '').toLowerCase().includes(q)
        )
    return catMatch ? c : { ...c, models }
  }).filter((c) => c.models.length > 0)

  const startModel = (c: LifeCategory, m: PathModel) => {
    try {
      localStorage.setItem(
        'autinerary_path_seed',
        JSON.stringify({
          key: `${c.key}:${m.key}`,
          title: `${c.title}${m.name && m.name !== 'Foundations' ? ` · ${m.name}` : ''}`,
          goals: m.seedGoals,
          focusCategory: c.focusCategory,
          suggestions: c.examples,
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

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-cyan-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Path Market</h1>
          </div>
          <p className="text-slate-600 max-w-2xl">
            Pick a <strong>life category</strong>, then a <strong>path model</strong> to start from. Starting a model
            pre-fills your goals — you can always customize during onboarding.
          </p>
          <button
            onClick={() => { setShowSubmit(true); setSubmitDone(false); setSubmitError('') }}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-cyan-200 text-cyan-700 text-sm font-semibold hover:border-cyan-400 transition-all"
          >
            <Plus className="w-4 h-4" /> Share your path model
          </button>
        </div>

        {/* Layer 1: Your Norms */}
        <div className="mb-6 rounded-2xl border-2 border-slate-200 bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Your Norms</div>
          <p className="text-sm text-slate-600">
            Every path here is shaped around your norms — the systemic realities you navigate.
          </p>
          {norms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {norms.map((n) => (
                <span key={n} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories or models (e.g. medicine, living, career)…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Layer 2: Life Categories, each containing Layer 3: Models */}
        <div className="space-y-4">
          {filtered.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.key} className={`rounded-2xl border-2 bg-gradient-to-br ${c.tint} p-5 shadow-sm`}>
                {/* Category header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconTint}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900">{c.title}</h2>
                    <p className="text-sm text-slate-600">{c.blurb}</p>
                  </div>
                </div>

                {/* Models */}
                <div className="space-y-2">
                  {c.models.map((m) => {
                    const status = STATUS_META[m.status]
                    return (
                      <div key={m.key} className="rounded-xl bg-white/70 border border-white/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status.cls}`}>
                                {m.status === 'coming' && <Clock className="inline w-2.5 h-2.5 mr-0.5" aria-hidden="true" />}
                                {status.label}
                              </span>
                            </div>
                            {m.contributor && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" /> by {m.contributor}
                              </div>
                            )}
                            <p className="text-xs text-slate-600 mt-1">{m.description}</p>
                          </div>
                          <button
                            onClick={() =>
                              m.status === 'coming'
                                ? router.push(`/under-construction?feature=${encodeURIComponent(`${c.title} · ${m.name}`)}`)
                                : startModel(c, m)
                            }
                            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              m.status === 'coming'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg'
                            }`}
                          >
                            {m.status === 'coming' ? 'Coming soon →' : 'Start this Path →'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {/* Invitation for community models */}
                  <p className="text-[11px] text-slate-400 italic px-1">
                    More models from the community appear here as people share their path.
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No categories or models match “{query}”. Try a different search, or{' '}
            <Link href="/onboarding" className="text-cyan-600 hover:underline">start from scratch</Link>.
          </div>
        )}
      </div>

      {/* Share-a-model modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowSubmit(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2"><Plus className="w-5 h-5 text-cyan-500" /> Share your path model</h2>
              <button onClick={() => setShowSubmit(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            {submitDone ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-semibold text-slate-800">Thanks for sharing!</p>
                <p className="text-sm text-slate-500 mt-1">Your model is <strong>pending review</strong>. You’ll see it in its category with a “Pending review” badge until it’s approved for everyone.</p>
                <button onClick={() => setShowSubmit(false)} className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold">Done</button>
              </div>
            ) : (
              <form onSubmit={submitModel} className="space-y-3">
                <p className="text-xs text-slate-500">Share how you navigated a life area so others can start from your path. {!user && <span className="text-amber-600 font-medium">You’ll need to sign in.</span>}</p>
                {submitError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Life category</label>
                  <select
                    value={form.categoryKey}
                    onChange={(e) => setForm({ ...form, categoryKey: e.target.value })}
                    className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                  </select>
                </div>
                <input
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                  placeholder="Model name (e.g. Model Madhu)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                  placeholder="Your name / credit (optional)"
                  value={form.contributor}
                  onChange={(e) => setForm({ ...form, contributor: e.target.value })}
                />
                <textarea
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Short description — how does this path differ? (10–280 chars)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <textarea
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Starting goals — one per line (e.g. Get into a research program)"
                  value={form.goalsText}
                  onChange={(e) => setForm({ ...form, goalsText: e.target.value })}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit model
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
