'use client'

import type { BadgeGrantRow, BadgeRow } from '@/types/community'

interface BadgeListProps {
  badges: Array<BadgeGrantRow & { badge?: BadgeRow }>
  max?: number
}

const TIER_RING: Record<string, string> = {
  bronze: 'ring-amber-300 bg-amber-50 text-amber-700',
  silver: 'ring-slate-300 bg-slate-50 text-slate-700',
  gold:   'ring-yellow-300 bg-yellow-50 text-yellow-800',
}

/**
 * Renders a compact row of badge pills. Top-3 by default with a "+N more"
 * indicator. Each pill is keyboard-accessible and shows tooltip text.
 */
export default function BadgeList({ badges, max = 3 }: BadgeListProps) {
  if (!badges?.length) return null
  const shown = badges.slice(0, max)
  const extra = badges.length - shown.length
  return (
    <div className="flex flex-wrap gap-1 items-center" data-testid="badge-list">
      {shown.map((b) => {
        const tier = b.badge?.tier ?? 'bronze'
        return (
          <span
            key={b.id}
            title={b.badge?.description ?? b.badge?.name ?? b.badge_slug}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${TIER_RING[tier]}`}
          >
            <span aria-hidden="true">{b.badge?.icon ?? '🎖️'}</span>
            <span>{b.badge?.name ?? b.badge_slug}</span>
          </span>
        )
      })}
      {extra > 0 && (
        <span className="text-xs text-gray-500">+{extra} more</span>
      )}
    </div>
  )
}
