'use client'

import RelationshipBadge from '@/components/community/RelationshipBadge'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { contentNoteLabel } from '@/lib/community/contentNotes'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Sparkles,
  Clock,
  TrendingUp,
  MessageCircleQuestion,
  CheckCircle2,
  Lightbulb,
  Plus,
  Award,
  ChefHat,
  Cookie,
  ExternalLink,
  PenLine,
  Users,
  Boxes,
} from 'lucide-react'
import ChefAvatar from '@/components/community/ChefAvatar'
import RulesDialog, { useCommunityRules } from '@/components/community/RulesDialog'
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
  /** False before STEP 83: questions only. */
  tidbits?: boolean
  chefs_pick?: CommunityPostSummary | null
}

// The Tidbits round (STEP 83): what kind of post, and the Tidbits' own filters.
const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'tidbit', label: 'Tidbits' },
  { id: 'question', label: 'Questions' },
] as const
const SOURCES = [
  { id: '', label: 'From anywhere' },
  { id: 'internal_rated', label: 'Our own, rated' },
  { id: 'internal_unrated', label: 'Our own, not rated yet' },
  { id: 'external', label: 'Reviews of outside articles' },
]

/** "Tidbit · 320 words", the group, and where it came from. */
function TidbitBadges({ p }: { p: CommunityPostSummary }) {
  if (p.kind !== 'tidbit') return null
  return (
    <>
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">
        <ChefHat className="h-3 w-3" aria-hidden="true" /> {p.length_type === 'tadbit' ? 'Tadbit' : 'Tidbit'}
      </span>
      {p.source === 'external' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-950">
          <ExternalLink className="h-3 w-3" aria-hidden="true" /> Review{p.external_platform ? ` · ${p.external_platform}` : ''}
        </span>
      )}
      {(p.item_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-950">
          <Boxes className="h-3 w-3" aria-hidden="true" /> {p.item_count} {p.item_count === 1 ? 'resource' : 'resources'}
        </span>
      )}
    </>
  )
}

const SORTS: ReadonlyArray<{ id: FeedSort; label: string; icon: typeof Clock }> = [
  { id: 'recent', label: 'Recent', icon: Clock },
  // The best Tidbits first, by their Well-Dones (the Tidbits round, Goal 10).
  { id: 'best', label: 'Best', icon: Award },
  { id: 'top', label: 'Top', icon: TrendingUp },
  { id: 'unanswered', label: 'Unanswered', icon: MessageCircleQuestion },
  { id: 'solved', label: 'Solved', icon: CheckCircle2 },
  // Odosa's "Solutions": posts where the author recorded the key sentence
  // that unlocked it. Distinct from Solved, which only means someone's
  // answer was accepted.
  { id: 'solutions', label: 'Solutions', icon: Lightbulb },
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
  const kind = (searchParams?.get('kind') as 'all' | 'tidbit' | 'question') || 'all'
  const length = searchParams?.get('length') ?? ''
  const source = searchParams?.get('source') ?? ''
  const integrated = searchParams?.get('integrated') === '1'
  const group = searchParams?.get('group') ?? ''
  const [tidbitsOpen, setTidbitsOpen] = useState(true)
  const [chefsPick, setChefsPick] = useState<CommunityPostSummary | null>(null)
  const [groups, setGroups] = useState<{ slug: string; name: string }[]>([])
  const rules = useCommunityRules()
  const [rulesOpen, setRulesOpen] = useState(false)
  // The first time someone opens Tidbits: the two pages of rules (Goal 2).
  useEffect(() => {
    if (rules.needed) setRulesOpen(true)
  }, [rules.needed])
  useEffect(() => {
    fetch('/api/community/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups((d.groups ?? []).map((g: { slug: string; name: string }) => ({ slug: g.slug, name: g.name }))))
      .catch(() => {})
  }, [])

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
    (next: Partial<{ sort: FeedSort; q: string; barrier: string; kind: string; length: string; source: string; integrated: string; group: string }>) => {
      const params = new URLSearchParams(searchParams?.toString())
      for (const key of ['kind', 'length', 'source', 'integrated', 'group'] as const) {
        const v = next[key]
        if (v === undefined) continue
        if (v && v !== 'all') params.set(key, v)
        else params.delete(key)
      }
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
    if (kind !== 'all') params.set('kind', kind)
    if (kind !== 'question') {
      if (length) params.set('length', length)
      if (source) params.set('source', source)
      if (integrated) params.set('integrated', '1')
      if (group) params.set('group', group)
    }
    fetch(`/api/community/posts?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Load failed (${res.status})`)
        return (await res.json()) as FeedResponse
      })
      .then((data) => {
        if (cancelled) return
        setPosts(data.posts ?? [])
        setTidbitsOpen(data.tidbits !== false)
        setChefsPick(data.chefs_pick ?? null)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [sort, q, barriers, conditions, lifeAreas, kind, length, source, integrated, group])

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
            Short, useful Tidbits from people who&apos;ve been there, and questions for the community. Pseudonymous, or anonymous if you like.
          </p>
          {/* Visible safety signals (Riipen Labs, Group 15: "clear moderation
              policy, content warnings, and an easy report path, especially
              for first-time posters"). */}
          <p className="text-sm text-gray-700 mt-1">
            Moderated by people on the Autinerary team. Report anything from the post itself.{' '}
            <Link href="/community/guidelines" className="font-medium text-blue-800 underline underline-offset-2">Community guidelines</Link>
          </p>
          {/* Riipen Labs, Group 34: the community features "lack transparency";
              explain how each one works and why it is there. Each line is what
              the code does: generated pseudonyms, community_cast_vote (never
              your own), the accept route, karma in 2026_community_tidbits.sql,
              threshold badges, reports to the /admin/community queue, and
              author delete. Update this when any of those change. */}
          <details className="mt-2 max-w-2xl text-sm text-gray-700">
            <summary className="cursor-pointer font-medium text-blue-700 hover:underline">
              How Tidbits works
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>A Tidbit is a short piece, up to 500 words; a Tadbit, up to 1000. You write them in a group you&apos;ve joined, and you can publish one anonymously.</li>
              <li>Reading a Tidbit to the end is a Bite. Rating one, 1 to 5, is a Well-Done. Best puts the best-rated first, and the best of the week is the Chef&apos;s pick.</li>
              <li>Slurs aren&apos;t published, and swear words are bleeped, automatically.</li>
              <li>You post under a pseudonym, not your real name.</li>
              <li>You can vote other people&apos;s posts and answers up or down.</li>
              <li>The person who asked can accept one answer as the solution.</li>
              <li>
                Helpful points are up-votes minus down-votes, plus 15 for each accepted answer.
              </li>
              <li>Badges mark milestones, like a first post.</li>
              <li>You can report a post or answer. A moderator reviews it and may remove it.</li>
              <li>You can delete your own posts and answers.</li>
              <li>It is a place to learn from each other, not a contest.</li>
            </ul>
          </details>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {tidbitsOpen && (
              <Link href="/community/write" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                <PenLine className="w-4 h-4" aria-hidden="true" />
                Write a Tidbit
              </Link>
            )}
            <Link
              href={withOriginContext('/community/new')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tidbitsOpen ? 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <Plus className="w-4 h-4" />
              Ask a question
            </Link>
          </div>
          {tidbitsOpen && (
            <div className="flex gap-4 text-sm">
              <Link href="/community/mine" className="font-medium text-blue-800 underline underline-offset-2">My Tidbits</Link>
              <Link href="/community/groups" className="inline-flex items-center gap-1 font-medium text-blue-800 underline underline-offset-2">
                <Users className="h-4 w-4" aria-hidden="true" /> Groups
              </Link>
            </div>
          )}
        </div>
        </div>

        <div className="flex gap-8">
          {/* Filters — same taxonomy as ResourceHub search, minus everything
              that only applies to a place you visit (cost, distance, rating,
              resource type). A post has no price and no address. */}
          <aside className="hidden lg:block lg:w-64 shrink-0">
            {/* Same self-scrolling behaviour as the search sidebar. */}
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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

      {tidbitsOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="What kind of post">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setQuery({ kind: k.id })}
              className={`rounded-full border px-3 py-1 text-sm ${kind === k.id ? 'border-blue-700 bg-blue-700 font-semibold text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
      {tidbitsOpen && kind !== 'question' && (
        <div className="mb-4 grid gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-gray-900">
            <span className="block text-xs font-semibold text-gray-700">Length</span>
            <select value={length} onChange={(e) => setQuery({ length: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5">
              <option value="">Any length</option>
              <option value="tidbit">Tidbits (up to 500 words)</option>
              <option value="tadbit">Tadbits (up to 1000 words)</option>
            </select>
          </label>
          <label className="text-gray-900">
            <span className="block text-xs font-semibold text-gray-700">Source</span>
            <select value={source} onChange={(e) => setQuery({ source: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5">
              {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-gray-900">
            <span className="block text-xs font-semibold text-gray-700">Group</span>
            <select value={group} onChange={(e) => setQuery({ group: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5">
              <option value="">Every group</option>
              {groups.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-gray-900">
            <input type="checkbox" checked={integrated} onChange={(e) => setQuery({ integrated: e.target.checked ? '1' : '' })} className="h-4 w-4" />
            Has Integrated Resources
          </label>
        </div>
      )}

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

      {chefsPick && (
        <Link href={withOriginContext(`/community/post/${chefsPick.id}`)} className="mb-4 block rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 hover:shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
            <Award className="h-4 w-4" aria-hidden="true" /> Chef&apos;s pick this week
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{chefsPick.title}</h2>
          {chefsPick.excerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-800">{chefsPick.excerpt}</p>}
          <p className="mt-2 text-xs text-gray-800">
            {chefsPick.well_done_avg} out of 5 from {chefsPick.well_done_count} Well-Dones · {chefsPick.author.pseudonym}
          </p>
        </Link>
      )}

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={withOriginContext(`/community/post/${p.id}`)}
              className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex gap-4">
                {p.kind === 'tidbit' ? (
                  <div className="hidden sm:flex flex-col items-center text-xs text-gray-700 w-14 shrink-0">
                    <ChefHat className="h-4 w-4 text-amber-700" aria-hidden="true" />
                    <div className="font-semibold tabular-nums text-gray-900">{p.well_done_avg ?? '–'}</div>
                    <div>{p.well_done_count ?? 0} Well-Done{p.well_done_count === 1 ? '' : 's'}</div>
                    <Cookie className="mt-2 h-4 w-4 text-amber-700" aria-hidden="true" />
                    <div className="font-semibold tabular-nums text-gray-900">{p.bite_count ?? 0}</div>
                    <div>Bites</div>
                  </div>
                ) : (
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
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <TidbitBadges p={p} />
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
                  {/* A content note (lib/community/contentNotes.ts): the note,
                      not the post's words, until someone opens it. */}
                  {p.content_note && (
                    <p className="text-sm text-gray-800 mb-1">
                      <span className="font-semibold">Content note:</span> {contentNoteLabel(p.content_note)}. Open the post to read it.
                    </p>
                  )}
                  {!p.content_note && p.is_solved && p.solved_key_insight && (
                    <p className="text-sm text-emerald-700 mb-1 line-clamp-2">
                      <Sparkles className="inline w-3.5 h-3.5 mr-1" />
                      <span className="font-medium">Solved insight:</span> {p.solved_key_insight}
                    </p>
                  )}
                  {!p.content_note && p.unlocking_moment && (
                    <p className="text-sm text-amber-800 mb-1 line-clamp-2 italic">
                      <Sparkles className="inline w-3.5 h-3.5 mr-1 text-amber-500" />
                      “{p.unlocking_moment}”
                    </p>
                  )}
                  {!p.content_note && p.what_didnt_work && (
                    <p className="text-sm text-rose-800 mb-1 line-clamp-2 italic">
                      <Sparkles className="inline w-3.5 h-3.5 mr-1 text-rose-500" />
                      Didn&apos;t work: “{p.what_didnt_work}”
                    </p>
                  )}
                  {p.excerpt && <p className="text-sm text-gray-600 line-clamp-2">{p.excerpt}</p>}
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
                      <ChefAvatar author={p.author} size="sm" />
                      <span className="font-medium text-gray-700">{p.author.pseudonym}</span>
                      {p.group && <span className="text-gray-600">in {p.group.name}</span>}
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
        <RulesDialog
          open={rulesOpen}
          onClose={() => setRulesOpen(false)}
          onAgree={async () => {
            const ok = await rules.accept()
            if (ok) setRulesOpen(false)
            return ok
          }}
        />
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
