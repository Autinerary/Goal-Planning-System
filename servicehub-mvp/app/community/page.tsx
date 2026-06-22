'use client'

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

  const [q, setQ] = useState(initialQ)
  const [barrier, setBarrier] = useState(initialBarrier)
  const [posts, setPosts] = useState<CommunityPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    if (barrier) params.set('barrier', barrier)
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
  }, [sort, q, barrier])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tidbits</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Ask, share, and learn from people facing the same barriers. Always pseudonymous.
          </p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Ask a question
        </Link>
      </div>

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
        <input
          type="text"
          value={barrier}
          onChange={(e) => setBarrier(e.target.value.toLowerCase())}
          onBlur={() => setQuery({ barrier })}
          onKeyDown={(e) => e.key === 'Enter' && setQuery({ barrier })}
          placeholder="Filter by barrier tag"
          className="sm:w-56 px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No posts yet. Be the first to ask something — or share what worked for you.
        </div>
      )}

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/community/post/${p.id}`}
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
  )
}

export default function CommunityFeedPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-10 text-gray-500">Loading…</div>}>
      <FeedInner />
    </Suspense>
  )
}
