'use client'

import Link from 'next/link'
import type { Resource } from '@/types/database'
import BarrierBadge from './BarrierBadge'
import { MapPin, Star, Users } from 'lucide-react'

interface ResourceCardProps {
  resource: Resource
  averageRating?: number
  ratingCount?: number
  distance?: number
  barriers?: string[]
  showBadges?: boolean
  variant?: 'grid' | 'list'
}

export default function ResourceCard({
  resource,
  averageRating = 0,
  ratingCount = 0,
  distance,
  barriers = [],
  showBadges = false,
  variant = 'grid',
}: ResourceCardProps) {
  const location = resource.location as any
  const city = location?.city || 'Location not specified'

  if (variant === 'list') {
    return (
      <Link
        href={`/resources/${resource.id}`}
        className="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        aria-label={`View ${resource.name}`}
      >
        <div className="p-6 flex flex-col sm:flex-row gap-6">
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

              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{city}</span>
                {distance !== undefined && (
                  <span className="ml-2 text-gray-500">{distance.toFixed(1)} km away</span>
                )}
              </div>
            </div>

            {/* Barrier Badges */}
            {showBadges && barriers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4" role="list" aria-label="Barriers this resource helps with">
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

  return (
    <Link
      href={`/resources/${resource.id}`}
      className="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      aria-label={`View ${resource.name}`}
    >
      <div className="p-6">
        {/* Category Badge */}
        <div className="mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {resource.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {resource.name}
        </h3>

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

        {/* Location */}
        <div className="flex items-center text-sm text-gray-600 mb-4">
          <MapPin className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{city}</span>
          {distance !== undefined && (
            <span className="ml-2 text-gray-500">{distance.toFixed(1)} km away</span>
          )}
        </div>

        {/* Barrier Badges */}
        {showBadges && barriers.length > 0 && (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Barriers this resource helps with">
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
