'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import StarRating from '@/components/ratings/StarRating'
import BarrierRatingInput from '@/components/ratings/BarrierRatingInput'
import ImageUpload from '@/components/ratings/ImageUpload'
import { ToastContainer } from '@/components/ui/Toast'
import type { Toast } from '@/components/ui/Toast'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import type { Resource, UserBarrier, Rating } from '@/types/database'
import type { BarrierScores } from '@/types/database'

const MAX_COMMENT_LENGTH = 500

export default function RateResourcePage() {
  const params = useParams()
  const router = useRouter()
  const resourceId = params.id as string

  const [resource, setResource] = useState<Resource | null>(null)
  const [userBarriers, setUserBarriers] = useState<UserBarrier[]>([])
  const [existingRating, setExistingRating] = useState<Rating | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [overallRating, setOverallRating] = useState(0)
  const [barrierRatings, setBarrierRatings] = useState<{
    [key: string]: { enabled: boolean; rating: number }
  }>({})
  const [comment, setComment] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // Fetch all data from API
        const response = await fetch(`/api/resources/${resourceId}/rate`)
        if (!response.ok) {
          if (response.status === 404) {
            addToast('Resource not found', 'error')
            router.push('/search')
            return
          }
          throw new Error('Failed to fetch resource data')
        }

        const data = await response.json()
        setResource(data.resource)
        setUserBarriers(data.barriers || [])

        // Load existing rating if it exists
        if (data.existingRating) {
          const rating = data.existingRating
          setExistingRating(rating)
          setOverallRating(rating.overall_score)
          setComment(rating.comment || '')

          // Load barrier ratings if they exist
          if (rating.barrier_scores && data.barriers) {
            const scores = rating.barrier_scores as BarrierScores
            const barrierRatingsMap: {
              [key: string]: { enabled: boolean; rating: number }
            } = {}

            data.barriers.forEach((barrier: UserBarrier) => {
              const barrierKey = `${barrier.barrier_category}:${barrier.barrier_type}`
              const score = scores[barrier.barrier_type] || scores[barrier.barrier_category]
              if (score) {
                barrierRatingsMap[barrierKey] = { enabled: true, rating: score }
              }
            })

            setBarrierRatings(barrierRatingsMap)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        addToast('Failed to load resource data', 'error')
      } finally {
        setLoading(false)
      }
    }

    if (resourceId) {
      fetchData()
    }
  }, [resourceId, router])

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, message, type, duration: 5000 }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleBarrierRatingChange = (barrierKey: string, enabled: boolean, rating: number) => {
    setBarrierRatings((prev) => ({
      ...prev,
      [barrierKey]: { enabled, rating },
    }))
  }

  const sanitizeInput = (text: string): string => {
    // Basic sanitization - remove potentially harmful characters
    return text.replace(/<[^>]*>/g, '').trim()
  }

  const uploadImages = async (resourceId: string, userId: string): Promise<string[]> => {
    if (images.length === 0) return []

    const uploadedUrls: string[] = []

    try {
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const formData = new FormData()
        formData.append('file', image)
        formData.append('resourceId', resourceId)
        formData.append('index', i.toString())

        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `Failed to upload image ${i + 1}`)
        }

        const data = await response.json()
        uploadedUrls.push(data.url)
      }
    } catch (error: any) {
      // Clean up uploaded images if any failed
      // Note: In production, you might want to implement cleanup for uploaded images
      throw error
    }

    return uploadedUrls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (overallRating === 0) {
      addToast('Please select an overall rating', 'error')
      return
    }

    const sanitizedComment = sanitizeInput(comment)
    if (sanitizedComment.length > MAX_COMMENT_LENGTH) {
      addToast(`Comment must be ${MAX_COMMENT_LENGTH} characters or less`, 'error')
      return
    }

    setSubmitting(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        addToast('You must be logged in to submit a rating', 'error')
        router.push('/login')
        return
      }

      // Build barrier scores from enabled barriers
      const barrierScores: BarrierScores = {}
      Object.entries(barrierRatings).forEach(([barrierKey, data]) => {
        if (data.enabled && data.rating > 0) {
          const [, barrierType] = barrierKey.split(':')
          barrierScores[barrierType] = data.rating
        }
      })

      // Upload images if any
      let imageUrls: string[] = []
      if (images.length > 0) {
        try {
          imageUrls = await uploadImages(resourceId, user.id)
        } catch (error: any) {
          addToast(error.message || 'Failed to upload images', 'error')
          setSubmitting(false)
          return
        }
      }

      // Submit rating
      const response = await fetch(`/api/resources/${resourceId}/ratings`, {
        method: existingRating ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overall_score: overallRating,
          barrier_scores: Object.keys(barrierScores).length > 0 ? barrierScores : undefined,
          comment: sanitizedComment || undefined,
          image_urls: imageUrls.length > 0 ? imageUrls : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit rating')
      }

      addToast(
        existingRating ? 'Rating updated successfully!' : 'Rating submitted successfully!',
        'success'
      )

      // Redirect after short delay
      setTimeout(() => {
        router.push(`/resources/${resourceId}`)
      }, 1000)
    } catch (error: any) {
      console.error('Error submitting rating:', error)
      addToast(error.message || 'Failed to submit rating. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-600">Loading...</div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!resource) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Search', href: '/search' },
              { label: resource.category, href: `/search?categories=${resource.category}` },
              { label: resource.name, href: `/resources/${resource.id}` },
              { label: existingRating ? 'Edit Rating' : 'Rate Resource', href: '#' },
            ]}
          />

          <div className="mt-6 mb-6">
            <Link
              href={`/resources/${resource.id}`}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to {resource.name}
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {existingRating ? 'Edit Your Rating' : 'Rate This Resource'}
              </h1>
              <p className="text-gray-600">{resource.name}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Overall Rating */}
              <div>
                <StarRating
                  value={overallRating}
                  onChange={setOverallRating}
                  required
                  label="Overall Rating"
                  size="lg"
                />
              </div>

              {/* Barrier Ratings */}
              {userBarriers.length > 0 && (
                <div>
                  <BarrierRatingInput
                    barriers={userBarriers}
                    values={barrierRatings}
                    onChange={handleBarrierRatingChange}
                  />
                </div>
              )}

              {/* Comment */}
              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-900 mb-2">
                  Your Review <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={6}
                  maxLength={MAX_COMMENT_LENGTH}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Share your experience with this resource..."
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {comment.length}/{MAX_COMMENT_LENGTH} characters
                  </span>
                  {comment.length >= MAX_COMMENT_LENGTH && (
                    <span className="text-red-600">Maximum length reached</span>
                  )}
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <ImageUpload images={images} onChange={setImages} maxImages={2} maxSizeKB={500} />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                <Link
                  href={`/resources/${resource.id}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || overallRating === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {submitting
                    ? 'Submitting...'
                    : existingRating
                    ? 'Update Rating'
                    : 'Submit Rating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}