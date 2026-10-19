'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Resource } from '@/types/database'
import BarrierBadge from './BarrierBadge'
import { MapPin, Star, Users } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import { tagLabel } from '@/lib/filters/tags'
import CommunityChoiceBadge from '@/components/communityChoice/CommunityChoiceBadge'

/** "Under 1 km", "4.2 km", "31 km", "3,675 km". */
export function formatDistance(km: number): string {
  if (km < 1) return 'Under 1 km'
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString('en-CA')} km`
}

interface ResourceCardProps {
  resource: Resource
  averageRating?: number
  ratingCount?: number
  distance?: number
  barriers?: string[]
  showBadges?: boolean
  variant?: 'grid' | 'list'
  /**
   * Actions under the card, outside its link ("Add to my team"; a button
   * cannot sit inside a link). The card and its actions share one frame.
   */
  footer?: ReactNode
  /** The person's own tags: 'team' (in their support team), 'owned', 'read'. */
  mine?: string[]
  /** Whether the person's place is known, for "location not shared". */
  locationShared?: boolean
}

// The tags worth showing on a card, in this order (lib/filters/tags.ts).
const CARD_TAGS = ['free_first_visit', 'requires_diagnosis', 'provides_diagnosis', 'funding', 'new_to_country', 'new_to_city', 'respite_care', 'siblings', 'charity', 'community_group', 'job_opportunities']
const MINE_LABELS: Record<string, string> = { team: 'In your support team', owned: 'Already owned', read: 'Already read' }

/** "Free", "Paid · $12.50", "Paid" (the planning note, October 2026: free or paid on every service). */
export function costLabel(r: { cost_type?: string | null; price?: number | null; currency?: string | null }): string | null {
  if (r.cost_type === 'free') return 'Free'
  if (r.cost_type !== 'paid') return null
  if (typeof r.price === 'number' && r.price > 0) {
    try {
      return `Paid · ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: r.currency || 'CAD' }).format(r.price)}`
    } catch {
      return `Paid · ${r.price}`
    }
  }
  return 'Paid'
}

function Chips({ resource, mine }: { resource: Resource; mine: string[] }) {
  const r = resource as any
  const cost = costLabel(r)
  const tags: string[] = (Array.isArray(r.tags) ? r.tags : []).filter((t: string) => CARD_TAGS.includes(t))
  tags.sort((a, b) => CARD_TAGS.indexOf(a) - CARD_TAGS.indexOf(b))
  // A month's winner of the community's vote (Goal 5), first.
  const choiceYear = Array.isArray(r.tags) && r.tags.includes('community_choice_year')
  const choice = Array.isArray(r.tags) && (r.tags.includes('community_choice') || choiceYear)
  if (!cost && tags.length === 0 && mine.length === 0 && !choice) return null
  return (
    <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Tags">
      {choice && (
        <li className="inline-flex">
          <CommunityChoiceBadge month={choiceYear ? 'of the year' : undefined} />
        </li>
      )}
      {mine.map((m) => (
        <li key={m} className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
          {MINE_LABELS[m] || m}
        </li>
      ))}
      {cost && (
        <li className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-800">{cost}</li>
      )}
      {tags.slice(0, 3).map((t) => (
        <li key={t} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
          {tagLabel(t)}
        </li>
      ))}
    </ul>
  )
}

export default function ResourceCard({
  resource,
  averageRating = 0,
  ratingCount = 0,
  distance,
  barriers = [],
  showBadges = false,
  variant = 'grid',
  footer,
  mine = [],
  locationShared,
}: ResourceCardProps) {
  // With actions, the frame moves from the link to a box around both.
  const FRAME = 'bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow'
  const framed = (link: ReactNode) =>
    footer ? (
      <div className={`${FRAME} overflow-hidden flex flex-col`}>
        {link}
        {footer}
      </div>
    ) : (
      link
    )
  const location = resource.location as any
  // Distance from you (the planning note, October 2026): the distance, or
  // "Online · 0 km", or that the person has not shared where they are.
  const online = (resource as any).delivery === 'online'
  // With a distance, a missing city needs no apology.
  const city = online ? 'Online · 0 km' : location?.city || (distance === undefined ? 'Location not specified' : '')
  const notShared = !online && distance === undefined && locationShared === false && Boolean(location?.lat)
  // A real photo when there is one (Odosa). Most places have none, and the
  // initials that stood in for them told people nothing, so the category's
  // icon does instead (Riipen Labs, Group 8).
  const photo: string = ((resource as any).image_url || (resource as any).image_urls?.[0] || '').trim()
  // Shop items appear in general search too; they live under /shop (Odosa).
  const isProduct = (resource as any).kind === 'product'
  const href = isProduct ? `/shop/${resource.id}` : `/resources/${resource.id}`
  const price = (resource as any).price

  // Each card is named by what it shows. An aria-label of "View <name>"
  // replaced the rest (place, rating) for screen readers and failed WCAG
  // 2.5.3, label in name (scripts/qa/check-accessibility.mjs). The photo's
  // alt is empty because the name is written right beside it.
  if (variant === 'list') {
    return framed(
      <Link
        href={href}
        className={`block ${footer ? '' : FRAME} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
      >
        <div className="p-6 flex flex-col sm:flex-row gap-6">
          {/* Thumbnail */}
          <div className="sm:w-40 sm:h-40 w-full aspect-[16/9] sm:aspect-auto flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <CategoryIcon category={resource.category} size="lg" />
            )}
          </div>

          {/* Left side - Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {resource.name}
                </h3>
                <div className="mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {resource.category}
                  </span>
                </div>
                <Chips resource={resource} mine={mine} />
              </div>
            </div>

            {resource.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              {(averageRating > 0 || ratingCount > 0) && (
                <>
                  {averageRating > 0 && (
                    <div className="flex items-center" aria-label={`Average rating: ${averageRating.toFixed(1)} stars`}>
                      <Star className="w-4 h-4 text-yellow-400 fill-current" aria-hidden="true" />
                      <span className="ml-1 text-sm font-medium text-gray-900">
                        {averageRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {ratingCount > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-1" aria-hidden="true" />
                      <span>{ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}</span>
                    </div>
                  )}
                </>
              )}

              {!isProduct && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{city}</span>
                  {distance !== undefined && !online && (
                    <span className={`${city ? 'ml-2 ' : ''}text-gray-500 whitespace-nowrap`}>{formatDistance(distance)} away</span>
                  )}
                  {notShared && <span className="ml-2 text-gray-500 whitespace-nowrap">· location not shared</span>}
                </div>
              )}
            </div>

            {/* Barrier Badges */}
            {showBadges && barriers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4" role="list" aria-label="Norms this resource helps with">
                {barriers.slice(0, 5).map((barrier, index) => (
                  <BarrierBadge key={index} barrier={barrier} variant="small" />
                ))}
                {barriers.length > 5 && (
                  <span className="text-xs text-gray-500">+{barriers.length - 5} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return framed(
    <Link
      href={href}
      className={`block ${footer ? 'flex-1' : FRAME} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 overflow-hidden group`}
    >
      {/* Image banner */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <CategoryIcon category={resource.category} size="lg" />
        )}
      </div>

      <div className="p-6">
        {/* Category Badge */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {resource.category}
          </span>
          {isProduct && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              Shop
            </span>
          )}
          {isProduct && typeof price === 'number' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {price === 0 ? 'Free' : `$${price}`}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {resource.name}
        </h3>

        <Chips resource={resource} mine={mine} />

        {/* Description */}
        {resource.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
        )}

        {/* Rating and Reviews */}
        {(averageRating > 0 || ratingCount > 0) && (
          <div className="flex items-center space-x-4 mb-4">
            {averageRating > 0 && (
              <div className="flex items-center" aria-label={`Average rating: ${averageRating.toFixed(1)} stars`}>
                <Star className="w-4 h-4 text-yellow-400 fill-current" aria-hidden="true" />
                <span className="ml-1 text-sm font-medium text-gray-900">
                  {averageRating.toFixed(1)}
                </span>
              </div>
            )}
            {ratingCount > 0 && (
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-1" aria-hidden="true" />
                <span>{ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}</span>
              </div>
            )}
          </div>
        )}

        {/* Location — products have no address, so don't claim one. */}
        {!isProduct && (
          <div className="flex items-center text-sm text-gray-600 mb-4">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{city}</span>
            {distance !== undefined && !online && (
              <span className={`${city ? 'ml-2 ' : ''}text-gray-500 whitespace-nowrap`}>{formatDistance(distance)} away</span>
            )}
            {notShared && <span className="ml-2 text-gray-500 whitespace-nowrap">· location not shared</span>}
          </div>
        )}

        {/* Barrier Badges */}
        {showBadges && barriers.length > 0 && (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Norms this resource helps with">
            {barriers.slice(0, 3).map((barrier, index) => (
              <BarrierBadge key={index} barrier={barrier} variant="small" />
            ))}
            {barriers.length > 3 && (
              <span className="text-xs text-gray-500">+{barriers.length - 3} more</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
