'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface VoteButtonProps {
  score: number
  viewerVote: -1 | 0 | 1
  targetType: 'post' | 'answer'
  targetId: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

/**
 * StackOverflow-style up/down vote control. Optimistic — flips the score
 * immediately, reconciles with the server response, and rolls back on
 * error.
 */
export default function VoteButton({
  score,
  viewerVote,
  targetType,
  targetId,
  size = 'md',
  disabled,
}: VoteButtonProps) {
  const [localScore, setLocalScore] = useState(score)
  const [localVote, setLocalVote] = useState<-1 | 0 | 1>(viewerVote)
  const [busy, setBusy] = useState(false)

  const cast = async (next: -1 | 1) => {
    if (busy || disabled) return
    // Toggle off when clicking the same arrow twice.
    const desired: -1 | 0 | 1 = localVote === next ? 0 : next
    const delta = desired - localVote
    setLocalVote(desired)
    setLocalScore((s) => s + delta)
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
      if (!res.ok) throw new Error('vote failed')
      const j = await res.json()
      if (typeof j.score === 'number') setLocalScore(j.score)
    } catch (err) {
      // Roll back.
      setLocalVote(localVote)
      setLocalScore(score)
    } finally {
      setBusy(false)
    }
  }

  const sz = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const txt = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <div className="flex flex-col items-center select-none" data-testid="vote-button">
      <button
        type="button"
        aria-label="Upvote"
        disabled={busy || disabled}
        onClick={() => cast(1)}
        className={`${sz} flex items-center justify-center rounded-full transition ${
          localVote === 1 ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        aria-label="Downvote"
        disabled={busy || disabled}
        onClick={() => cast(-1)}
        className={`${sz} flex items-center justify-center rounded-full transition ${
          localVote === -1 ? 'text-rose-600 bg-rose-50' : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <ChevronDown className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
    </div>
  )
}
