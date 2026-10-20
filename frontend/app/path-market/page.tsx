'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Plus, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  NO_FILTERS, awaitingFor, communityModel, facetCounts, foundationsModel, isFiltered, matches, sortModels, startSeed, userNormIds,
  type MarketCategory, type MarketFilters, type MarketModel,
} from '@/lib/pathMarket'
import PathFilters from './PathFilters'
import ModelCard from './ModelCard'
import StartPathDialog from './StartPathDialog'
import ShareModelForm from './ShareModelForm'

/**
 * Path Market (the team's notes, October 2026).
 *
 * Every entry is a Life Path Model: a whole path with a name of its own, its
 * categories, norms and connection type to norm, its races (each with its
 * milestones) and people, its contributors and a short description, and
 * "Start this Path". The filters work like ResourceHub's, with "Path
 * Categories" first: Education, Career, Relationships, Health & Wellness and
 * Norms, each opening onto its specialised categories (one can be under
 * several). Categories come from the database (Odosa: not hardcoded);
 * community models from path_models. Pathways asked for without content are
 * listed as waiting, never filled in by us ("No invented curricula").
 */

interface CategoryDTO {
  key: string
  title: string
  blurb: string
  focusCategory: string
  examples: string[]
  lifeAreas: MarketCategory['lifeAreas']
  foundations: MarketCategory['foundations']
}

export default function PathMarketPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [catsLoading, setCatsLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [filters, setFilters] = useState<MarketFilters>(NO_FILTERS)
  const [starting, setStarting] = useState<MarketModel | null>(null)
  const [sharing, setSharing] = useState(false)
  const [myNormLabels, setMyNormLabels] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    fetch('/api/path-categories', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.categories)) {
          setCategories(
            (j.categories as CategoryDTO[]).map((c) => ({
              key: c.key,
              title: c.title,
              blurb: c.blurb,
              focusCategory: c.focusCategory,
              examples: Array.isArray(c.examples) ? c.examples : [],
              lifeAreas: Array.isArray(c.lifeAreas) ? c.lifeAreas : [],
              foundations: c.foundations,
            })),
          )
        }
      })
      .catch(() => {})
      .finally(() => setCatsLoading(false))
  }, [])

  const loadModels = () => {
    fetch('/api/path-models', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (Array.isArray(j?.models)) setRows(j.models) })
      .catch(() => {})
  }
  useEffect(() => { loadModels() }, [])

  // Your norms (from setup, in this browser), for "Match my norms".
  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem('autinerary_profile') || 'null')?.barrierTypes
      if (Array.isArray(b)) setMyNormLabels(b.filter((x: unknown) => typeof x === 'string'))
    } catch { /* ignore */ }
  }, [])

  const byKey = useMemo(() => Object.fromEntries(categories.map((c) => [c.key, c])), [categories])
  const models = useMemo(
    () => sortModels([...categories.map(foundationsModel), ...rows.map((r) => communityModel(r, byKey))], categories.map((c) => c.key)),
    [categories, rows, byKey],
  )
  const shown = models.filter((m) => matches(m, filters, byKey))
  const counts = facetCounts(models, filters, byKey)
  const awaiting = awaitingFor(filters, byKey)
  const myNorms = userNormIds(myNormLabels)
  const filterCount = filters.areas.length + filters.categories.length + filters.norms.length + filters.connections.length + filters.status.length

  const start = (m: MarketModel, races: string[], steps: Record<string, string[]>) => {
    try {
      localStorage.setItem('autinerary_path_seed', JSON.stringify(startSeed(m, byKey[m.categoryKeys[0]], races, steps)))
    } catch { /* ignore */ }
    router.push('/onboarding')
  }

  const sidebar = <PathFilters filters={filters} setFilters={setFilters} categories={categories} counts={counts} myNorms={myNorms} />

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <button onClick={() => router.push('/path')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>

        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-cyan-600" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Path Market</h1>
          </div>
          <p className="max-w-3xl text-slate-700">
            Each <strong>Life Path Model</strong> is a whole path someone took: its races, their steps, and the people on it.
            Filter by life category, norms and more, then <strong>Start this Path</strong> and take the races and steps you want.
            Nothing is selected for you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 py-2 text-sm font-semibold text-cyan-900 transition-all hover:border-cyan-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Share your path model
            </button>
            <Link href="/bulk-import" className="inline-flex items-center gap-2 rounded-xl border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-900 transition-all hover:border-purple-500">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Recommend a batch
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside aria-label="Filters">
            {/* On a phone the filters fold away, as on ResourceHub. One set of
                filters either way, so every control has one id. */}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="path-filters"
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ''}
            </button>
            <div id="path-filters" className={`${filtersOpen ? 'mt-4 block' : 'hidden'} lg:mt-0 lg:block`}>{sidebar}</div>
            {isFiltered(filters) && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className="mt-4 text-sm font-semibold text-blue-800 underline underline-offset-2">
                Clear filters
              </button>
            )}
          </aside>

          <main>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Search models, races and steps (e.g. medicine, budgeting, resume)…"
                aria-label="Search path models"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <p className="mb-3 text-sm text-slate-700" role="status">
              {catsLoading ? 'Loading path models…' : `${shown.length} ${shown.length === 1 ? 'path model' : 'path models'}`}
            </p>

            {catsLoading && (
              <div className="flex justify-center py-12 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></div>
            )}

            <div className="grid gap-3 sm:grid-cols-2" data-model-list>
              {shown.map((m) => (
                <ModelCard
                  key={m.key}
                  model={m}
                  categories={byKey}
                  onStart={setStarting}
                  onComingSoon={(x) => router.push(`/under-construction?feature=${encodeURIComponent(x.name)}`)}
                />
              ))}
            </div>

            {!catsLoading && shown.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-700">
                {categories.length === 0 ? 'No path categories yet.' : (
                  <>
                    No path models match. Try fewer filters, or{' '}
                    <Link href="/onboarding" className="text-cyan-800 underline underline-offset-2">start from scratch</Link>.
                  </>
                )}
              </div>
            )}

            {awaiting.length > 0 && (
              <section className="mt-10 border-t pt-6" aria-labelledby="awaiting-heading">
                <h2 id="awaiting-heading" className="mb-1 text-xl font-semibold text-slate-900">Pathways awaiting content</h2>
                <p className="mb-3 text-sm text-slate-700">Asked for, and waiting for people who have walked them (or qualified reviewers). We don’t write these ourselves.</p>
                <div className="grid gap-x-8 sm:grid-cols-2">
                  {awaiting.map((p) => (
                    <div key={p.name} className="border-b py-3">
                      <h3 className="font-medium text-slate-900">{p.name}</h3>
                      <p className="mt-1 text-sm text-slate-700">{p.note}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      <StartPathDialog model={starting} categories={byKey} onClose={() => setStarting(null)} onStart={start} />
      <ShareModelForm
        open={sharing}
        onClose={() => setSharing(false)}
        onShared={loadModels}
        categories={categories}
        signedIn={!!user}
        defaultContributor={user?.name || ''}
      />
    </div>
  )
}
