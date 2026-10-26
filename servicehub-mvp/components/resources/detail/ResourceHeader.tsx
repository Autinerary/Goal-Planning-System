'use client'

import { useEffect, useRef, useState } from 'react'
import { Star, Bookmark, Share2, MapPin, Plus, UserPlus } from 'lucide-react'
import type { ResourceDetail } from '@/lib/supabase/queries'
import { showToast } from '@/lib/toast'
import AddRatingModal from './AddRatingModal'
import NominateButton from '@/components/communityChoice/NominateButton'
import { appSignInHref } from '@/lib/appSignIn'
import Link from 'next/link'
import TeamAction from '@/components/team/TeamAction'
import type { TeamState } from '@/lib/team'
import { SIGNUP_ON, canLookUp, canRequest, requestKey, serviceForUrl, signupHref } from '@/lib/signup'

interface ResourceHeaderProps {
  resource: ResourceDetail
  userId?: string
}

export default function ResourceHeader({ resource, userId }: ResourceHeaderProps) {
  const [isSaved, setIsSaved] = useState(resource.isSaved || false)
  const [isSaving, setIsSaving] = useState(false)
  const [showShareTooltip, setShowShareTooltip] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  // Where it is on the person's team (lib/team.ts). On the team, "Saved"
  // stops being a switch: pressing it used to delete the row, team and all.
  const [teamState, setTeamState] = useState<TeamState>(resource.teamState || 'none')
  const onTeam = teamState === 'meeting' || teamState === 'signed'
  // The service its website belongs to, if the app's one-click sign-up can do it (lib/signup.ts).
  const site = (resource as { contact_info?: { website?: string | null } | null; source_url?: string | null })
  const signupService = serviceForUrl(site.contact_info?.website || site.source_url)
  // A local service with no online sign-up: the app sends their request instead.
  const requestService = !signupService && canRequest(resource as Parameters<typeof canRequest>[0]) ? requestKey(resource.id) : null
  // No email or website yet: the app looks on the web for theirs, then sends the request.
  const lookUpService = !signupService && !requestService && canLookUp(resource as Parameters<typeof canLookUp>[0]) ? requestKey(resource.id) : null
  // Back from signing in to add it to the team.
  const [addAfterSignIn] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('then') === `team:${resource.id}`
  )

  const location = resource.location as any
  const city = location?.city || 'Location not specified'
  const province = location?.province || ''

  // Signed out, Save and Rate go through the one Autinerary sign-in and come
  // back here to finish what was started (Riipen Labs, Group 24: "Enables
  // 1-click resource saving with unified authentication"). Someone already
  // signed in to the app is back at once, and the save happens by itself.
  const signInThen = (then: 'save' | 'rate') => {
    window.location.href = appSignInHref(`${window.location.pathname}?then=${then}`)
  }
  const resumed = useRef(false)
  useEffect(() => {
    if (!userId || resumed.current) return
    const params = new URLSearchParams(window.location.search)
    const then = params.get('then')
    if (then !== 'save' && then !== 'rate') return
    resumed.current = true
    params.delete('then')
    const rest = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
    if (then === 'save' && !isSaved) void handleSave()
    if (then === 'rate') setShowRatingModal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleSave = async () => {
    if (!userId) {
      signInThen('save')
      return
    }

    setIsSaving(true)
    const willSave = !isSaved
    try {
      const response = await fetch(`/api/resources/${resource.id}/save`, {
        method: willSave ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        setIsSaved(willSave)
        showToast.success(willSave ? 'Saved to your resources' : 'Removed from saved')
      } else {
        const data = await response.json().catch(() => ({}))
        const message = data?.error || 'Could not save this resource. Please try again.'
        console.error('Save failed:', response.status, data)
        showToast.error(message)
      }
    } catch (error) {
      console.error('Error saving resource:', error)
      showToast.error('Network error. Please check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRateClick = () => {
    if (!userId) {
      signInThen('rate')
      return
    }
    setShowRatingModal(true)
  }

  const handleRatingAdded = () => {
    setShowRatingModal(false)
    showToast.success('Thanks! Your rating has been added.')
    // Reload so RatingsBreakdown + CommunityReviews refresh.
    window.location.reload()
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShowShareTooltip(true)
      setTimeout(() => setShowShareTooltip(false), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      // Fallback: select text
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setShowShareTooltip(true)
      setTimeout(() => setShowShareTooltip(false), 2000)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Category Badge */}
      <div className="mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          {resource.category}
        </span>
      </div>

      {/* Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{resource.name}</h1>

          {/* Location */}
          <div className="flex items-center text-gray-600">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
            <span>
              {city}
              {province && `, ${province}`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRateClick}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={userId ? 'Rate this resource' : 'Sign in to rate this resource'}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Rate this resource
          </button>

          <div className="relative">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Share resource"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            {showShareTooltip && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap">
                Link copied!
              </div>
            )}
          </div>

          {onTeam ? (
            <Link
              href="/my-resources"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Bookmark className="w-4 h-4 fill-current" aria-hidden="true" />
              On your team
            </Link>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSaved
                  ? 'text-white bg-blue-600 hover:bg-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={isSaved ? 'Remove from saved' : 'Save resource'}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              {isSaving ? 'Saving…' : isSaved ? 'Saved' : 'Save'}
            </button>
          )}

          {/* One-click sign-up (lib/signup.ts): the app fills in this service's
              own sign-up form for the person. */}
          {SIGNUP_ON && (signupService || requestService || lookUpService) && (
            <a
              href={signupHref((signupService || requestService || lookUpService)!, resource.id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              data-signup-link
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {signupService ? 'Sign me up' : requestService ? 'Send my request' : 'Ask to start with them'}
            </a>
          )}
        </div>
      </div>

      {/* Add to the team from here too, in one click (lib/team.ts). */}
      <div className="-mx-6 mb-4 max-w-xl">
        <TeamAction
          resource={resource}
          initial={teamState}
          signedIn={Boolean(userId)}
          autoAdd={addAfterSignIn}
          onChange={(state) => {
            setTeamState(state)
            if (state !== 'none') setIsSaved(true)
            else setIsSaved(false)
          }}
        />
      </div>

      {/* Community's Choice (Goal 5): its badge if it won, and nominating it. */}
      <div className="mb-4">
        <NominateButton itemId={resource.id} itemName={resource.name} signedIn={Boolean(userId)} />
      </div>

      {/* Rating and Badges */}
      <div className="flex items-center gap-4 flex-wrap">
        {resource.ratingCount > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Star className="w-5 h-5 text-yellow-400 fill-current" aria-hidden="true" />
              <span className="ml-1 text-lg font-semibold text-gray-900">
                {resource.averageRating.toFixed(1)}
              </span>
            </div>
            <span className="text-sm text-gray-600">
              {resource.ratingCount} {resource.ratingCount === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        )}
        
        {/* Recommended by Autism Community Badge */}
        {resource.recommendedByAutismCommunity && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
            <svg
              className="w-4 h-4 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium text-green-800">
              Recommended by Autism Community
            </span>
          </div>
        )}
      </div>

      {showRatingModal && (
        <AddRatingModal
          resourceId={resource.id}
          resourceName={resource.name}
          onClose={() => setShowRatingModal(false)}
          onRatingAdded={handleRatingAdded}
        />
      )}
    </div>
  )
}