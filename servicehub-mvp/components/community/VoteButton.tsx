'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'

interface VoteButtonProps {
  score: number
  viewerVote: -1 | 0 | 1
  targetType: 'post' | 'answer'
  targetId: string
  size?: 'sm' | 'md'
  disabled?: boolean
  /** The viewer wrote this post or answer. */
  isOwn?: boolean
}

type Notice = 'sign-in' | 'not-saved' | null

/**
 * StackOverflow-style up/down vote control. Optimistic — flips the score
 * immediately, reconciles with the server response, and rolls back on
 * error, saying so when it does.
 */
export default function VoteButton({
  score,
  viewerVote,
  targetType,
  targetId,
  size = 'md',
  disabled,
  isOwn,
}: VoteButtonProps) {
  const { user, loading: authLoading } = useAuth()
  const [localScore, setLocalScore] = useState(score)
  const [localVote, setLocalVote] = useState<-1 | 0 | 1>(viewerVote)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  // community_cast_vote drops a vote on your own writing without an error,
  // so the arrow stayed lit while the number snapped back. Switched off here
  // instead, with the reason on hover and for screen readers (Riipen Labs,
  // Group 34 found the community features lacked transparency).
  const blocked = disabled || isOwn
  const ownReason = isOwn ? `You can't vote on your own ${targetType}` : undefined

  const cast = async (next: -1 | 1) => {
    if (busy || blocked) return
    // Signed out: say so, instead of flipping the arrow and quietly rolling
    // it back when the server answers 401.
    if (!authLoading && !user) {
      setNotice('sign-in')
      return
    }
    const prevVote = localVote
    const prevScore = localScore
    // Toggle off when clicking the same arrow twice.
    const desired: -1 | 0 | 1 = localVote === next ? 0 : next
    const delta = desired - localVote
    setLocalVote(desired)
    setLocalScore((s) => s + delta)
    setNotice(null)
    setBusy(true)
    try {
      const path =
        targetType === 'post'
          ? `/api/community/posts/${targetId}/vote`
          : `/api/community/answers/${targetId}/vote`
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: desired }),
      })
      if (res.status === 401) {
        // Signed out after all: the session ran out, or was still loading.
        setLocalVote(prevVote)
        setLocalScore(prevScore)
        setNotice('sign-in')
        return
      }
      if (!res.ok) throw new Error('vote failed')
      const j = await res.json()
      if (typeof j.score === 'number') setLocalScore(j.score)
    } catch {
      // Roll back to where this click started.
      setLocalVote(prevVote)
      setLocalScore(prevScore)
      setNotice('not-saved')
    } finally {
      setBusy(false)
    }
  }

  const sz = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const txt = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <div className="relative flex flex-col items-center select-none" data-testid="vote-button">
      <button
        type="button"
        aria-label={ownReason ? `Upvote. ${ownReason}` : 'Upvote'}
        title={ownReason}
        disabled={busy || blocked}
        onClick={() => cast(1)}
        className={`${sz} flex items-center justify-center rounded-full transition ${
          localVote === 1
            ? 'text-emerald-600 bg-emerald-50'
            : blocked
              ? 'text-gray-400'
              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
        } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <ChevronUp className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
      <span className={`font-semibold tabular-nums ${txt} ${
        localScore > 0 ? 'text-emerald-700' : localScore < 0 ? 'text-rose-700' : 'text-gray-700'
      }`}>
        {localScore}
      </span>
      <button
        type="button"
        aria-label={ownReason ? `Downvote. ${ownReason}` : 'Downvote'}
        title={ownReason}
        disabled={busy || blocked}
        onClick={() => cast(-1)}
        className={`${sz} flex items-center justify-center rounded-full transition ${
          localVote === -1
            ? 'text-rose-600 bg-rose-50'
            : blocked
              ? 'text-gray-400'
              : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
        } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <ChevronDown className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
      {/* Always mounted, so a screen reader announces the message as soon as
          it appears. It floats beside the arrows rather than pushing the post
          or answer sideways, and stays until dismissed. */}
      <div role="status" className="absolute left-full top-0 z-10 ml-2">
        {notice && (
          <div className="flex w-max max-w-[11rem] items-start gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm">
            <span>
              {notice === 'sign-in' ? (
                <>
                  <Link href="/login" className="font-medium text-blue-700 underline">
                    Sign in
                  </Link>{' '}
                  to vote
                </>
              ) : (
                'Your vote was not saved. Please try again.'
              )}
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
