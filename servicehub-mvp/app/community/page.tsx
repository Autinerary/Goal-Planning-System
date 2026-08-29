'use client'

import RelationshipBadge from '@/components/community/RelationshipBadge'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Sparkles,
  Clock,
  TrendingUp,
  MessageCircleQuestion,
  CheckCircle2,
  Plus,
} from 'lucide-react'
import type { CommunityPostSummary, FeedSort } from '@/types/community'
import BadgeList from '@/components/community/BadgeList'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TidbitsFilterSidebar from '@/components/community/TidbitsFilterSidebar'

interface FeedResponse {
  posts: CommunityPostSummary[]
  page: number
  page_size: number
}

const SORTS: ReadonlyArray<{ id: FeedSort; label: string; icon: typeof Clock }> = [
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'top', label: 'Top', icon: TrendingUp },
  { id: 'unanswered', label: 'Unanswered', icon: MessageCircleQuestion },
  { id: 'solved', label: 'Solved', icon: CheckCircle2 },
]

function FeedInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sort = (searchParams?.get('sort') as FeedSort) || 'recent'
  const initialQ = searchParams?.get('q') ?? ''
  const initialBarrier = searchParams?.get('barrier') ?? ''
  const from = searchParams?.get('from') ?? ''
  const context = searchParams?.get('context') ?? ''

  const [q, setQ] = useState(initialQ)
  // Multi-select now (Odosa: same filter list as ResourceHub). The URL still
  // carries a comma-separated `barrier`, so existing single-value links from
  // Goal Planning keep working.
  const [barriers, setBarriers] = useState<string[]>(
    initialBarrier ? initialBarrier.split(',').filter(Boolean) : []
  )
  const [conditions, setConditions] = useState<string[]>([])
  const [lifeAreas, setLifeAreas] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [posts, setPosts] = useState<CommunityPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const withOriginContext = useCallback(
    (path: string) => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (context) params.set('context', context)
      const query = params.toString()
      return query ? `${path}?${query}` : path
    },
    [from, context]
  )

  const setQuery = useCallback(
    (next: Partial<{ sort: FeedSort; q: string; barrier: string }>) => {
      const params = new URLSearchParams(searchParams?.toString())
      if (next.sort !== undefined) params.set('sort', next.sort)
      if (next.q !== undefined) {
        if (next.q) params.set('q', next.q)
        else params.delete('q')
      }
      if (next.barrier !== undefined) {
        if (next.barrier) params.set('barrier', next.barrier)
        else params.delete('barrier')
      }
      router.push(`/community?${params.toString()}`)
    },
    [router, searchParams]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('sort', sort)
    if (q) params.set('q', q)
    // Conditions are norm tokens too ('autism:level_2'); send the base norm so
    // a level selection still narrows the feed rather than matching nothing.
    const normTokens = [...barriers, ...conditions.map((c) => c.split(':')[0])]
    const uniqueNorms = Array.from(new Set(normTokens.filter(Boolean)))
    if (uniqueNorms.length) params.set('barrier', uniqueNorms.join(','))
    if (lifeAreas.length) params.set('category', lifeAreas.join(','))
    fetch(`/api/community/posts?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Load failed (${res.status})`)
        return (await res.json()) as FeedResponse
      })
      .then((data) => {
        if (!cancelled) setPosts(data.posts ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [sort, q, barriers, conditions, lifeAreas])

  const activeFilterCount = barriers.length + conditions.length + lifeAreas.length

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  const clearFilters = () => {
    setBarriers([])
    setConditions([])
    setLifeAreas([])
  }

  const filterPanel = (
    <TidbitsFilterSidebar
      barriers={barriers}
      conditions={conditions}
      lifeAreas={lifeAreas}
      onBarrierToggle={(b) => setBarriers((cur) => toggleIn(cur, b))}
      onConditionsChange={setConditions}
      onLifeAreaToggle={(a) => setLifeAreas((cur) => toggleIn(cur, a))}
      onClear={clearFilters}
    />
  )

  return (
    /* Odosa: "Tabs above from ResourceHub are completely missing; how will a
       user get back to ResourceHub from here?" — Tidbits rendered no Navbar,
       so it was a dead end. Same chrome and same sidebar layout as search, so
       the two read as one product rather than two apps. */
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Tidbits', href: '/community' }]} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tidbits</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Ask, share, and learn from people who share your norms. Always pseudonymous.
          </p>
        </div>
        <Link
          href={withOriginContext('/community/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Ask a question
        </Link>
        </div>

        <div className="flex gap-8">
          {/* Filters — same taxonomy as ResourceHub search, minus everything
              that only applies to a place you visit (cost, distance, rating,
              resource type). A post has no price and no address. */}
          <aside className="hidden lg:block lg:w-64 shrink-0">
            <div className="sticky top-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {filterPanel}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setQuery({ q })}
            onKeyDown={(e) => e.key === 'Enter' && setQuery({ q })}
            placeholder="Search posts…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <nav className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
        {SORTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setQuery({ sort: id })}
            className={`inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-sm border-b-2 transition ${
              sort === id
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* Mobile filter drawer — the sidebar is hidden under lg */}
      {showFilters && (
        <div className="lg:hidden mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {filterPanel}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        /* Odosa: "honestly the whole thing is empty". It genuinely is — there
           are no posts yet — so rather than a bare line, say what this is for
           and give people the two things they can actually do from here. */
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <MessageCircleQuestion className="w-8 h-8 mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-900">
            {activeFilterCount > 0 || q ? 'Nothing matches those filters yet' : 'No tidbits yet'}
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
            {activeFilterCount > 0 || q
              ? 'Try widening your filters — the community is still small, so narrow searches often come up empty.'
              : 'Tidbits is where people work through the things a resource listing never tells you. Ask what you are stuck on, or share what finally worked.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {(activeFilterCount > 0 || q) && (
              <button
                type="button"
                onClick={() => { clearFilters(); setQ(''); setQuery({ q: '' }) }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
            <Link
              href={withOriginContext('/community/new')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Ask a question
            </Link>
            <Link
              href="/search"
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Browse ResourceHub
            </Link>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={withOriginContext(`/community/post/${p.id}`)}
              className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex gap-4">
                <div className="hidden sm:flex flex-col items-center text-xs text-gray-500 w-12 shrink-0">
                  <div className={`font-semibold tabular-nums ${
                    p.score > 0 ? 'text-emerald-700' : p.score < 0 ? 'text-rose-700' : 'text-gray-700'
                  }`}>
                    {p.score}
                  </div>
                  <div>votes</div>
                  <div className="mt-2 font-semibold tabular-nums text-gray-700">
                    {p.answer_count}
                  </div>
                  <div>answers</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {p.is_solved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                        <CheckCircle2 className="w-3 h-3" />
                        Solved
                      </span>
                    )}
                    {p.is_locked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                        Locked
                      </span>
                    )}
                    <h2 className="text-lg font-semibold text-gray-900 truncate">{p.title}</h2>
                  </div>
                  {p.is_solved && p.solved_key_insight && (
                    <p className="text-sm text-emerald-700 mb-1 line-clamp-2">
                      <Sparkles className="inline w-3.5 h-3.5 mr-1" />
                      <span className="font-medium">Solved insight:</span> {p.solved_key_insight}
                    </p>
                  )}
                  {p.unlocking_moment && (
                    <p className="text-sm text-amber-800 mb-1 line-clamp-2 italic">
                      <Sparkles className="inline w-3.5 h-3.5 mr-1 text-amber-500" />
                      “{p.unlocking_moment}”
                    </p>
                  )}
                  {p.what_didnt_work && (
                    <p className="text-sm text-rose-800 mb-1 line-clamp-2 italic">
                      <Sparkles className="inline w-3.5 h-3.5 mr-1 text-rose-500" />
                      Didn&apos;t work: “{p.what_didnt_work}”
                    </p>
                  )}
                  <p className="text-sm text-gray-600 line-clamp-2">{p.excerpt}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {p.barrier_tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"
                      >
                        #{t}
                      </span>
                    ))}
                    <span className="ml-auto flex items-center gap-2">
                      <span className="font-medium text-gray-700">{p.author.pseudonym}</span>
                      <RelationshipBadge relationship={p.author_relationship} />
                      <BadgeList badges={p.author.top_badges} max={1} />
                      <span aria-hidden="true">·</span>
                      <span>{new Date(p.last_activity_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
        </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function CommunityFeedPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-10 text-gray-500">Loading…</div>}>
      <FeedInner />
    </Suspense>
  )
}
