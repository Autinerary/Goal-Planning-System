'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, CheckCircle2 } from 'lucide-react'

interface RelatedPost {
  id: string
  title: string
  solved: boolean
  solvedSummary: string | null
  score: number
  answerCount: number
}

/**
 * "Integrate Tidbits AS commentaries in ResourceHub (but as solutions)"
 * (Odosa).
 *
 * Real Tidbits discussions that mention this resource by name, surfaced
 * right on its page as community solutions rather than making people go
 * search Tidbits separately. Matched by real text overlap — see
 * /api/resources/related-tidbits for why category tags could not be used —
 * so a resource nobody has actually discussed shows nothing here, honestly.
 */
export default function RelatedTidbits({ resourceName }: { resourceName: string }) {
  const [posts, setPosts] = useState<RelatedPost[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/resources/related-tidbits?name=${encodeURIComponent(resourceName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setPosts(j?.posts || []) })
      .catch(() => { if (!cancelled) setPosts([]) })
    return () => { cancelled = true }
  }, [resourceName])

  if (!posts || posts.length === 0) return null

  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-cyan-600" />
        Community solutions
      </h2>
      <div className="space-y-2">
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/community/post/${p.id}`}
            className="block rounded-lg border border-gray-200 p-3 hover:border-cyan-300 hover:bg-cyan-50/40 transition-colors"
          >
            <div className="flex items-start gap-2">
              {p.solved && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                {p.solved && p.solvedSummary && (
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{p.solvedSummary}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {p.answerCount} {p.answerCount === 1 ? 'answer' : 'answers'} · {p.score} points
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
