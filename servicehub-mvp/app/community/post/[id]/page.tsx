'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Lock,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import type { CommunityPostDetail, CommunityAnswerNode } from '@/types/community'
import VoteButton from '@/components/community/VoteButton'
import Markdown from '@/components/community/Markdown'
import SolvedBanner from '@/components/community/SolvedBanner'
import BadgeList from '@/components/community/BadgeList'
import ThreadedAnswer from '@/components/community/ThreadedAnswer'
import AnswerComposer from '@/components/community/AnswerComposer'
import AcceptSolutionModal from '@/components/community/AcceptSolutionModal'
import ReportButton from '@/components/community/ReportButton'

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [post, setPost] = useState<CommunityPostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptTarget, setAcceptTarget] = useState<CommunityAnswerNode | null>(null)
  const [lockBusy, setLockBusy] = useState(false)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/community/posts/${params.id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Load failed (${res.status})`)
      }
      const data = await res.json()
      setPost(data.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    reload()
  }, [reload])

  const onAccept = async (key_insight: string, tldr: string) => {
    if (!acceptTarget || !post) return
    const res = await fetch(`/api/community/posts/${post.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer_id: acceptTarget.id, key_insight, tldr }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      throw new Error(j?.error || `Accept failed (${res.status})`)
    }
    setAcceptTarget(null)
    await reload()
  }

  const toggleLock = async () => {
    if (!post || lockBusy) return
    setLockBusy(true)
    try {
      await fetch(`/api/community/posts/${post.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: !post.is_locked }),
      })
      await reload()
    } finally {
      setLockBusy(false)
    }
  }

  const deletePost = async () => {
    if (!post) return
    if (!confirm('Delete this post? This cannot be undone.')) return
    const res = await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/community')
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-gray-500 text-sm">Loading post…</div>
    )
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-rose-600 text-sm">{error}</div>
    )
  }
  if (!post) return null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tidbits
      </Link>

      {post.is_solved && post.solved_key_insight && post.solved_tldr && (
        <SolvedBanner keyInsight={post.solved_key_insight} tldr={post.solved_tldr} />
      )}

      <article className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {post.is_solved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-600 text-white">
              <CheckCircle2 className="w-3 h-3" />
              Solved
            </span>
          )}
          {post.is_locked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-gray-200 text-gray-700">
              <Lock className="w-3 h-3" />
              Locked
            </span>
          )}
          {post.barrier_tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              #{t}
            </span>
          ))}
          {post.category_tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {t}
            </span>
          ))}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <Link
            href={`/community/profile/${post.author.user_id}`}
            className="font-medium text-blue-700 hover:underline"
          >
            {post.author.pseudonym}
          </Link>
          <span>{post.author.karma} karma</span>
          <BadgeList badges={post.author.top_badges} max={3} />
          <span className="ml-auto text-xs text-gray-400">
            asked {new Date(post.created_at).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-4 items-start pt-2">
          <VoteButton
            score={post.score}
            viewerVote={post.viewer_vote}
            targetType="post"
            targetId={post.id}
            disabled={post.is_locked}
          />
          <div className="flex-1 min-w-0">
            <Markdown source={post.body_markdown} />
            {post.image_urls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.image_urls.map((u) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={u}
                    src={u}
                    alt="attachment"
                    className="max-h-72 rounded-lg border border-gray-200"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 text-xs">
          <ReportButton targetType="post" targetId={post.id} />
          {post.viewer_can_edit && (
            <button
              type="button"
              onClick={deletePost}
              className="text-gray-500 hover:text-rose-600"
            >
              Delete
            </button>
          )}
          {post.viewer_can_moderate && (
            <button
              type="button"
              onClick={toggleLock}
              disabled={lockBusy}
              className="text-gray-500 hover:text-amber-600 inline-flex items-center gap-1"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {post.is_locked ? 'Unlock' : 'Lock'}
            </button>
          )}
          <span className="ml-auto text-gray-400">
            {post.view_count} {post.view_count === 1 ? 'view' : 'views'}
          </span>
        </div>
      </article>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {post.answer_count} {post.answer_count === 1 ? 'answer' : 'answers'}
        </h2>
        {post.answers.length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">
            Be the first to share what worked for you.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {post.answers.map((a) => (
              <ThreadedAnswer
                key={a.id}
                answer={a}
                postId={post.id}
                viewerCanAccept={post.viewer_can_accept && !post.is_locked}
                onAccept={(ans) => setAcceptTarget(ans)}
                onReply={reload}
              />
            ))}
          </div>
        )}
      </section>

      {!post.is_locked && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Your answer</h2>
          <AnswerComposer postId={post.id} onSubmitted={reload} />
        </section>
      )}

      <AcceptSolutionModal
        open={!!acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onSubmit={onAccept}
        answerExcerpt={acceptTarget?.body_markdown.slice(0, 200)}
      />
    </div>
  )
}
