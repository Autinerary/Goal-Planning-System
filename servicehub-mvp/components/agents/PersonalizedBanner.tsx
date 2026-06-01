'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'

interface BarrierItem {
  id: string
  category: string
  categoryLabel: string
}

interface Profile {
  barriers: BarrierItem[]
  goals: string[]
  lifeStage?: string
  role?: string
}

export default function PersonalizedBanner() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('autinerary_profile')
    if (raw) {
      try {
        setProfile(JSON.parse(raw))
      } catch {
        // ignore
      }
    }
  }, [])

  if (!profile || dismissed || !profile.barriers?.length) return null

  // Build a human-readable list of barrier categories
  const categories = [...new Set(profile.barriers.map((b) => b.categoryLabel))].slice(0, 3)
  const searchQuery = profile.barriers.map((b) => b.id).join(',')

  return (
    <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 mb-6 flex items-start gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-purple-900">
          Personalised for your journey
        </p>
        <p className="text-sm text-purple-700 mt-0.5">
          Showing resources relevant to{' '}
          <span className="font-medium">{categories.join(', ')}</span>
          {profile.goals?.length > 0 && (
            <> · Goal: <span className="font-medium">{profile.goals[0]}</span></>
          )}
        </p>
        <Link
          href={`/search?barriers=${searchQuery}`}
          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-purple-600 hover:text-purple-800 underline"
        >
          Search all matching resources →
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-purple-400 hover:text-purple-700 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
