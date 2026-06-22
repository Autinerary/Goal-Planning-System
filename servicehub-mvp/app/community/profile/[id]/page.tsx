'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, CheckCircle2 } from 'lucide-react'
import type { CommunityProfilePublic } from '@/types/community'
import BadgeList from '@/components/community/BadgeList'
import FollowButton from '@/components/community/FollowButton'

export default function ProfilePage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<CommunityProfilePublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/community/profiles/${params.id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Load failed (${res.status})`)
      }
      const data = await res.json()
      setProfile(data.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    load()
    // Also fetch viewer to decide whether to show the follow button.
    fetch('/api/community/profiles/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setViewerId(j?.user_id ?? null))
      .catch(() => setViewerId(null))
  }, [load])

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10 text-gray-500">Loading…</div>
  if (error)
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-rose-600 text-sm">
        {error}{' '}
        <Link href="/community" className="underline">
          Back to community
        </Link>
      </div>
    )
  if (!profile) return null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tidbits
      </Link>

      <header className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-wrap items-start gap-4">
        {profile.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={profile.avatar_url}
            alt={profile.pseudonym}
            className="w-16 h-16 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center text-xl font-bold text-blue-700">
            {profile.pseudonym.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{profile.pseudonym}</h1>
          <p className="text-sm text-gray-600">
            {profile.karma} karma · {profile.follower_count} followers ·{' '}
            {profile.following_count} following
          </p>
          {profile.bio && <p className="text-sm text-gray-700 mt-2">{profile.bio}</p>}
          <div className="mt-2">
            <BadgeList badges={profile.badges} max={6} />
          </div>
        </div>
        {viewerId && viewerId !== profile.user_id && (
          <FollowButton
            userId={profile.user_id}
            initialFollowing={profile.is_followed_by_viewer}
          />
        )}
      </header>

      {profile.posts === null && profile.answers === null && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          This user has chosen to keep their activity private.
        </div>
      )}

      {profile.posts && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Posts
          </h2>
          {profile.posts.length === 0 ? (
            <p className="text-sm text-gray-500">No posts yet.</p>
          ) : (
            <ul className="space-y-2">
              {profile.posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/community/post/${p.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-blue-300"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {p.is_solved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                          <CheckCircle2 className="w-3 h-3" />
                          Solved
                        </span>
                      )}
                      <h3 className="font-medium text-gray-900 truncate">{p.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{p.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {profile.answers && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Answers
          </h2>
          {profile.answers.length === 0 ? (
            <p className="text-sm text-gray-500">No answers yet.</p>
          ) : (
            <ul className="space-y-2">
              {profile.answers.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/community/post/${a.post_id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-blue-300"
                  >
                    <p className="text-sm text-gray-700 line-clamp-2">{a.body_markdown}</p>
                    <div className="text-xs text-gray-500 mt-1">
                      {a.is_accepted && (
                        <span className="text-emerald-700 font-semibold mr-2">Accepted</span>
                      )}
                      score {a.score}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
