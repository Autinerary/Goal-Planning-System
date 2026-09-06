import { Flame, Gem, TrendingUp } from 'lucide-react'

export interface ResourceBadgeFlags {
  trending?: boolean
  highlyRequested?: boolean
  rare?: boolean
}

/**
 * Trending / Highly Requested / Rare badges.
 *
 * These are computed server-side by get_resource_badges() from real saves
 * and real category counts — never shown for a resource that hasn't actually
 * met the threshold. A resource with no signal renders nothing here, which is
 * the honest state, not a placeholder badge.
 */
export default function ResourceBadges({ trending, highlyRequested, rare }: ResourceBadgeFlags) {
  if (!trending && !highlyRequested && !rare) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {trending && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
          <Flame className="w-3 h-3" /> Trending
        </span>
      )}
      {highlyRequested && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
          <TrendingUp className="w-3 h-3" /> Highly requested
        </span>
      )}
      {rare && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <Gem className="w-3 h-3" /> Rare find
        </span>
      )}
    </div>
  )
}
