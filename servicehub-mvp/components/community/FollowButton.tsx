'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'

interface FollowButtonProps {
  userId: string
  initialFollowing: boolean
  disabled?: boolean
}

export default function FollowButton({ userId, initialFollowing, disabled }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (busy || disabled) return
    setBusy(true)
    const next = !following
    setFollowing(next)
    try {
      const res = await fetch(`/api/community/profiles/${userId}/follow`, {
        method: next ? 'POST' : 'DELETE',
      })
      if (!res.ok) throw new Error('toggle failed')
    } catch {
      // Roll back.
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || disabled}
      aria-pressed={following}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
        following
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } disabled:opacity-50`}
    >
      {following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      <span>{following ? 'Following' : 'Follow'}</span>
    </button>
  )
}
