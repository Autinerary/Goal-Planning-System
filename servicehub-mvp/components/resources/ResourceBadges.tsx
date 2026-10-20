import { Gem, Sparkles, TrendingUp } from 'lucide-react'
import { SPECIAL_TAGS, TRENDING_TIERS } from '@/lib/filters/taxonomy'

export interface ResourceBadgeFlags {
  trending?: boolean
  /** bronze (today), silver (this week), gold (this month), platinum (this year). */
  trendingTier?: string | null
  highlyRequested?: boolean
  rare?: boolean
  /** "Autinerary's Own". */
  firstParty?: boolean
  /** The listing's "Surprising Finds" tag. */
  surprisingFind?: boolean
}

const special = (id: string) => SPECIAL_TAGS.find((t) => t.id === id)!

/**
 * Autinerary's Own, Surprising Finds, Trending (by tier), Highly Requested
 * and Rare badges.
 *
 * Trending, Highly Requested and Rare are computed server-side by
 * get_resource_badges() from real saves and real category counts — never
 * shown for a resource that hasn't actually met the threshold. A resource
 * with no signal renders nothing here, which is the honest state, not a
 * placeholder badge. Trending shows its tier in its metal, shining (the
 * team's notes, October 2026: "make it shiny!"; globals.css `shine`).
 */
export default function ResourceBadges({ trending, trendingTier, highlyRequested, rare, firstParty, surprisingFind }: ResourceBadgeFlags) {
  const tier = TRENDING_TIERS.find((t) => t.id === trendingTier)
  if (!trending && !tier && !highlyRequested && !rare && !firstParty && !surprisingFind) return null
  const pill = 'inline-flex items-center gap-1 text-[0.625rem] font-bold px-2 py-0.5 rounded-full'
  return (
    <div className="flex flex-wrap gap-1.5">
      {firstParty && <span className={`${pill} ${special('first_party').className}`}>{special('first_party').label}</span>}
      {surprisingFind && (
        <span className={`${pill} ${special('surprising_find').className}`}>
          <Sparkles className="w-3 h-3" aria-hidden="true" /> {special('surprising_find').label}
        </span>
      )}
      {tier ? (
        <span className={`${pill} shine ${tier.className}`}>
          <TrendingUp className="w-3 h-3" aria-hidden="true" /> {tier.label}
        </span>
      ) : (
        trending && (
          <span className={`${pill} bg-orange-50 text-orange-800 border border-orange-200`}>
            <TrendingUp className="w-3 h-3" aria-hidden="true" /> Trending
          </span>
        )
      )}
      {highlyRequested && (
        <span className={`${pill} bg-sky-50 text-sky-800 border border-sky-200`}>
          <TrendingUp className="w-3 h-3" aria-hidden="true" /> Highly requested
        </span>
      )}
      {rare && (
        <span className={`${pill} bg-purple-50 text-purple-800 border border-purple-200`}>
          <Gem className="w-3 h-3" aria-hidden="true" /> Rare find
        </span>
      )}
    </div>
  )
}
