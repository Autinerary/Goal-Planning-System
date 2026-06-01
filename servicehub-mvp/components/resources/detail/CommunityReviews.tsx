'use client'

import { useState, useEffect } from 'react'
import { Star, ThumbsUp, User, Clock, ChevronDown } from 'lucide-react'
import type { Rating } from '@/types/database'
import type { Profile } from '@/types/database'
import AddRatingButton from './AddRatingButton'
import EmptyState from '@/components/feedback/EmptyState'
import { showToast } from '@/lib/toast'

interface CommunityReviewsProps {
  resourceId: string
  userId?: string
}

type SortOption = 'helpful' | 'newest' | 'highest'

interface ReviewWithUser extends Rating {
  user?: Profile
}

export default function CommunityReviews({ resourceId, userId }: CommunityReviewsProps) {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [userHasRated, setUserHasRated] = useState(false)
  const pageSize = 10

  useEffect(() => {
    fetchReviews()
  }, [resourceId, sort, page])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/resources/${resourceId}/reviews?sort=${sort}&page=${page}&pageSize=${pageSize}`
      )
      const data = await response.json()
      setReviews(data.reviews || [])
      setTotal(data.total || 0)
      setUserHasRated(data.userHasRated || false)
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkHelpful = async (ratingId: string) => {
    try {
      const response = await fetch(`/api/ratings/${ratingId}/helpful`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        showToast.success('Thank you for marking this review as helpful!')
        // Update local state
        setReviews(
          reviews.map((review) =>
            review.id === ratingId
              ? { ...review, helpful_count: (review.helpful_count || 0) + 1 }
              : review
          )
        )
      } else {
        showToast.error('Failed to mark review as helpful')
      }
    } catch (error) {
      console.error('Error marking review helpful:', error)
      showToast.error('Failed to mark review as helpful')
    }
  }

  const handleRatingAdded = () => {
    setUserHasRated(true)
    fetchReviews() // Refresh reviews
  }

  const getRoleLabel = (role: string | undefined) => {
    if (!role) return 'Community Member'
    const labels: { [key: string]: string } = {
      self_advocate: 'Self-Advocate',
      parent: 'Parent/Family',
      caregiver: 'Caregiver',
      user: 'Community Member',
    }
    return labels[role] || role
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Community Reviews</h2>
        <div className="flex items-center gap-4">
          {userId && !userHasRated && (
            <AddRatingButton resourceId={resourceId} onRatingAdded={handleRatingAdded} />
          )}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortOption)
                setPage(1)
              }}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              aria-label="Sort reviews"
            >
              <option value="newest">Newest First</option>
              <option value="helpful">Most Helpful</option>
              <option value="highest">Highest Rated</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <>
          <div className="space-y-6">
            {reviews.map((review) => {
              const barrierScores = review.barrier_scores as any
              return (
                <div key={review.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">
                            {review.user?.full_name || 'Anonymous'}
                          </div>
                          {review.user?.role && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              {getRoleLabel(review.user.role)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <time dateTime={review.created_at}>
                            {new Date(review.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </time>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.overall_score
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                      <span className="ml-1 text-sm font-medium text-gray-900">
                        {review.overall_score}
                      </span>
                    </div>
                  </div>

                  {barrierScores && Object.keys(barrierScores).length > 0 && (
                    <div className="mb-3 pl-13">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(barrierScores).map(([barrier, score]) => (
                          <div
                            key={barrier}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                          >
                            {barrier.replace(/_/g, ' ')}: {score as number}/5
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {review.comment && (
                    <p className="mb-3 pl-13 text-gray-700 whitespace-pre-wrap">{review.comment}</p>
                  )}

                  <div className="flex items-center gap-4 pl-13">
                    <button
                      onClick={() => handleMarkHelpful(review.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                      Helpful ({review.helpful_count || 0})
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, total)} of {total} reviews
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * pageSize >= total}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <EmptyState
            type="ratings"
            onAction={userId ? undefined : () => {}}
            actionLabel={userId ? undefined : 'Sign in to rate'}
          />
          {userId && (
            <div className="mt-4">
              <AddRatingButton resourceId={resourceId} onRatingAdded={handleRatingAdded} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}