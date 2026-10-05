import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ResourceCard from '@/components/resources/ResourceCard'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import RecommendationResult from '@/components/agents/RecommendationResult'
import { orchestrator } from '@/lib/agents/orchestrator'
import { getUserBarriers, getProfile, getResources, getRatingsByResource, getResourceCategories } from '@/lib/supabase/queries'
import type { UserRequest } from '@/lib/agents/orchestrator/types'
import { CONDITION_GROUPS } from '@/lib/search/conditions'
import { LIFE_AREAS } from '@/lib/search/lifeAreas'
import { 
  getPopularResources, 
  getMostUsefulResources, 
  getAvoidancesResources,
  getHighestRatedByCategory,
  getLocationResources,
  getCheapestResources,
  getRecommendedResources
} from '@/lib/resources/recommendations'
import DiscoveryCard from '@/components/agents/DiscoveryCard'
import SetLocationPrompt from '@/components/resources/SetLocationPrompt'
import PersonalizedBanner from '@/components/agents/PersonalizedBanner'
import ForYou from '@/components/home/ForYou'
import type { Location } from '@/types/database'
import Link from 'next/link'
import { 
  Search, 
  TrendingUp, 
  Clock, 
  Sparkles, 
  AlertTriangle, 
  MapPin, 
  DollarSign, 
  Star,
  Brain,
  GraduationCap,
  Stethoscope,
  Trees,
  ShoppingBag,
  Smartphone,
  BookOpen
} from 'lucide-react'

const categories = [
  { id: 'therapist', label: 'Therapists', icon: Brain, color: 'bg-purple-500 hover:bg-purple-600' },
  { id: 'school', label: 'Schools', icon: GraduationCap, color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'doctor', label: 'Doctors', icon: Stethoscope, color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'park', label: 'Parks', icon: Trees, color: 'bg-green-500 hover:bg-green-600' },
  { id: 'store', label: 'Stores', icon: ShoppingBag, color: 'bg-blue-500 hover:bg-blue-600' },
  // These two are SHOP categories, and their ids have to match
  // SHOP_CATEGORIES exactly or the filter matches nothing. They were 'app'
  // and 'book'; the shop vocabulary is 'apps' and 'books', so both chips
  // returned an empty page.
  { id: 'apps', label: 'Apps', icon: Smartphone, color: 'bg-purple-500 hover:bg-purple-600' },
  { id: 'books', label: 'Books', icon: BookOpen, color: 'bg-blue-500 hover:bg-blue-600' },
]

async function RecommendedSection() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Show section even without user - will show general recommendations
  if (!user) {
    // Show general popular resources instead of personalized recommendations
    try {
      const popularResources = await getPopularResources(8)
      if (popularResources && popularResources.length > 0) {
        // Popular, not matched to anyone: no match score or confidence.
        return (
          <section className="mb-12" aria-labelledby="recommended-heading">
            <RecommendationResult
              resources={popularResources}
              subtitle="Popular in the community. Sign in to see places matched to you."
              explanations={['Showing popular community resources. Sign in for personalized recommendations.']}
              confidence={0}
              showConfidence={false}
              showExplanations={false}
              synthesisExplanation="These are popular resources from our community. Sign in to get personalized recommendations based on your norms."
              showSynthesis={true}
            />
          </section>
        )
      }
    } catch (error) {
      console.error('Error loading popular resources:', error)
    }
    return null
  }

  try {
    // Get user barriers
    const userBarriers = await getUserBarriers(user.id)
    if (userBarriers.length === 0) {
      // Show section even if no barriers, with a message
      return (
        <section className="mb-12" aria-labelledby="recommended-heading">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-blue-600" aria-hidden="true" />
              <h2 id="recommended-heading" className="text-2xl font-bold text-gray-900">
                Recommended by AI Agent
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              Add a topic to <Link href="/profile" className="underline">your profile</Link> to see places
              rated by people who share it.
            </p>
          </div>
        </section>
      )
    }

    // Convert to agent input format
    const barriers = userBarriers.map((b) => ({
      category: b.barrier_category,
      type: b.barrier_type,
      severity: b.severity || undefined,
      notes: b.notes || undefined,
    }))

    // Get user location from profile
    const profile = await getProfile(user.id)
    const location = (profile?.location as Location) || undefined

    // Use orchestrator to coordinate agents
    const userRequest: UserRequest = {
      userId: user.id,
      requestType: 'recommendations',
      context: {
        location,
      },
      barriers,
    }

    let orchestrationResult
    let recommendationOutput: any = null
    let synthesis: any = null

    try {
      orchestrationResult = await orchestrator.handleRequest(userRequest)
      recommendationOutput = orchestrationResult.agentOutputs.RecommendationAgent as any
      synthesis = orchestrationResult.metadata?.synthesis
    } catch (orchestratorError) {
      console.error('Orchestrator error, using fallback:', orchestratorError)
      // Continue to fallback logic below
    }

    // Fallback: If agent returns no recommendations, use simple recommendation algorithm
    let finalResources: any[] = []
    let finalExplanations: string[] = []
    let finalConfidence = 0
    let finalSynthesisExplanation: string | undefined = undefined
    let finalAgentContributions: any[] | undefined = undefined
    let finalMemory: { runCount: number; lastTopResources: string[] } | null = null

    // Helper to format barrier types for display
    const formatBarrierType = (type: string) => {
      return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    const barrierTypesFormatted = barriers.map(b => formatBarrierType(b.type))
    const barrierTypesList = barrierTypesFormatted.length > 0 
      ? barrierTypesFormatted.slice(0, 3).join(', ') + (barrierTypesFormatted.length > 3 ? ', and more' : '')
      : 'your profile'

    // Only the agent's own list carries a match score, a confidence and the
    // agents' notes. The fallbacks below used to invent all three, and gave
    // places with no reviews random star ratings and review counts. They now
    // say only what is true (Riipen Labs, Group 8: "personalization claims
    // match what the product can actually deliver").
    let fromAgent = false
    if (recommendationOutput?.resources && recommendationOutput.resources.length > 0) {
      fromAgent = true
      // Use agent results - ensure scores are percentages (0-100)
      finalResources = recommendationOutput.resources.map((resource: any) => ({
        ...resource,
        score: typeof resource.score === 'number' && resource.score <= 100 
          ? resource.score 
          : Math.min(100, Math.max(70, (resource.score || resource.averageRating || 4) * 20)), // Convert 0-5 scale to 70-100%
      }))
      finalExplanations = recommendationOutput.explanations || []
      finalConfidence = synthesis?.confidence || recommendationOutput.confidence || 0
      finalSynthesisExplanation = synthesis?.explanation || orchestrationResult?.explanation
      finalAgentContributions = synthesis?.agentContributions
      finalMemory = recommendationOutput.memory || null
    } else {
      // Fallback: places rated by people who share these norms, then what is
      // popular, then any places.
      console.log('Agent returned no recommendations, using fallback algorithm...')
      try {
        const fallbackResources = await getRecommendedResources(user.id, 8)

        if (fallbackResources && fallbackResources.length > 0) {
          finalResources = fallbackResources
          finalExplanations = finalResources.map((resource: any) => {
            const parts: string[] = [
              `Based on those who matched your Diagnostics profile (${barrierTypesList})`,
            ]
            if (resource.similarUsers > 0) {
              parts.push(
                `rated highly by ${resource.similarUsers} similar ${resource.similarUsers === 1 ? 'person' : 'people'}`
              )
            }
            if (resource.averageRating >= 4) {
              parts.push(`${resource.averageRating.toFixed(1)}★ average`)
            }
            return parts.join(' • ')
          })
          finalSynthesisExplanation = `These were rated highly by people with similar norms (${barrierTypesList}).`
        } else {
          const popularResources = await getPopularResources(8)
          if (popularResources && popularResources.length > 0) {
            finalResources = popularResources
            finalExplanations = finalResources.map((resource: any) =>
              resource.averageRating >= 4
                ? `Popular in the community • ${resource.averageRating.toFixed(1)}★`
                : 'Popular in the community'
            )
            finalSynthesisExplanation = `Nothing has been rated for your norms (${barrierTypesList}) yet, so these are popular in the community. Rating a place you know helps people like you.`
          } else {
            const anyResources = await getResources({ status: 'approved', limit: 8 })
            finalResources = anyResources || []
            finalExplanations = finalResources.map(() => 'From ResourceHub')
            finalSynthesisExplanation = `Nothing has been rated for your norms (${barrierTypesList}) yet. These are places in ResourceHub to start with.`
          }
        }
      } catch (fallbackError) {
        console.error('Fallback recommendation error:', fallbackError)
      }
    }

    // Always show the section, even if no recommendations yet
    // RecommendationResult component handles empty state
    return (
      <section className="mb-12" aria-labelledby="recommended-heading">
        {/* No coordinates means "near you" cannot work. 0,0 counts as none:
            ResourceHub onboarding writes it when geocoding fails. */}
        {!(location?.lat && location?.lng) && <SetLocationPrompt />}
        <RecommendationResult
          resources={finalResources}
          explanations={finalExplanations}
          confidence={finalConfidence}
          showConfidence={fromAgent}
          showExplanations={true}
          synthesisExplanation={finalSynthesisExplanation || orchestrationResult?.explanation}
          agentContributions={fromAgent ? finalAgentContributions || synthesis?.agentContributions : undefined}
          showSynthesis={true}
          memory={finalMemory}
        />
      </section>
    )
  } catch (error) {
    console.error('Error generating agent recommendations:', error)
    // Show error state instead of returning null
    return (
      <section className="mb-12" aria-labelledby="recommended-heading">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-red-600" aria-hidden="true" />
            <h2 id="recommended-heading" className="text-2xl font-bold text-gray-900">
              Recommended by AI Agent
            </h2>
          </div>
          <p className="text-sm text-red-600">
            Unable to load recommendations at this time. Please try again later.
          </p>
          <p className="text-xs text-red-500 mt-2">
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </section>
    )
  }
}

async function HighestRatingsSection() {
  const popular = await getPopularResources(12)

  return (
    <section className="mb-12" aria-labelledby="highest-ratings-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Star className="w-6 h-6 text-yellow-600 mr-2" aria-hidden="true" />
          <h2 id="highest-ratings-heading" className="text-2xl font-bold text-gray-900">
            Highest Ratings
          </h2>
        </div>
        <Link
          href="/search?sort=popular"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {popular.map((resource: any) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            averageRating={resource.averageRating || 0}
            ratingCount={resource.ratingCount || 0}
            showBadges={true}
          />
        ))}
      </div>
    </section>
  )
}

async function HighestRatingsByCategorySection() {
  const allCategories = await getResourceCategories()
  const topCategories = allCategories.slice(0, 3) // Show top 3 categories

  if (topCategories.length === 0) {
    return null
  }

  return (
    <section className="mb-12" aria-labelledby="highest-by-category-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Star className="w-6 h-6 text-yellow-600 mr-2" aria-hidden="true" />
          <h2 id="highest-by-category-heading" className="text-2xl font-bold text-gray-900">
            Highest Ratings by Category
          </h2>
        </div>
      </div>

      <div className="space-y-8">
        {topCategories.map((category) => (
          <HighestRatingsByCategoryItem key={category} category={category} limit={6} />
        ))}
      </div>
    </section>
  )
}

async function HighestRatingsByCategoryItem({ category, limit }: { category: string; limit: number }) {
  const resources = await getHighestRatedByCategory(category, limit)

  if (resources.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 capitalize">{category}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((resource: any) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            averageRating={resource.averageRating || 0}
            ratingCount={resource.ratingCount || 0}
          />
        ))}
      </div>
    </div>
  )
}

async function AvoidancesSection() {
  const avoidances = await getAvoidancesResources(12)

  if (avoidances.length === 0) {
    return null
  }

  return (
    <section className="mb-12" aria-labelledby="avoidances-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mr-2" aria-hidden="true" />
          <h2 id="avoidances-heading" className="text-2xl font-bold text-gray-900">
            Resources to Avoid
          </h2>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-red-800">
          <strong>Note:</strong> These resources have consistently low ratings (1-2 stars) from multiple users. Review the reasons below before engaging.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {avoidances.map((resource: any) => (
          <div key={resource.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <ResourceCard
              resource={resource}
              averageRating={resource.averageRating || 0}
              ratingCount={resource.ratingCount || 0}
              variant="list"
            />
            {resource.avoidReasons && resource.avoidReasons.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Reasons to Avoid:</h4>
                <ul className="space-y-1">
                  {resource.avoidReasons.slice(0, 3).map((reason: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start">
                      <span className="text-red-500 mr-2">•</span>
                      <span className="line-clamp-2">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

async function CheapestSection() {
  const cheapest = await getCheapestResources(12)

  if (cheapest.length === 0) {
    return null
  }

  return (
    <section className="mb-12" aria-labelledby="cheapest-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <DollarSign className="w-6 h-6 text-green-600 mr-2" aria-hidden="true" />
          <h2 id="cheapest-heading" className="text-2xl font-bold text-gray-900">
            Cheapest Resources
          </h2>
        </div>
        <Link
          href="/search?sort=price"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cheapest.map((resource: any) => {
          const price = resource.price ?? null
          return (
            <div key={resource.id} className="relative">
              <ResourceCard
                resource={resource}
                averageRating={resource.averageRating || 0}
                ratingCount={resource.ratingCount || 0}
              />
              {price !== null && price !== undefined && typeof price === 'number' && (
                <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  ${price.toFixed(2)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

async function LocationCollectionsSection() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Location-based resources require user profile, so skip if no user
  if (!user) {
    return null
  }

  const profile = await getProfile(user.id)
  const userLocation = (profile?.location as Location) || undefined

  // Coordinates are what make "near" work; the prompt to set a location is
  // above, in Recommended.
  if (!userLocation?.lat || !userLocation?.lng) {
    return null
  }

  const locationResources = await getLocationResources(userLocation, 6)

  if (locationResources.length === 0) {
    return null
  }
  const placeName = [userLocation.city, userLocation.province].filter(Boolean).join(', ')

  return (
    <section className="mb-12" aria-labelledby="location-collections-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <MapPin className="w-6 h-6 text-blue-600 mr-2" aria-hidden="true" />
          <h2 id="location-collections-heading" className="text-2xl font-bold text-gray-900">
            {placeName ? `Near ${placeName}` : 'In Your Location'}
          </h2>
        </div>
        <Link
          href="/search"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
        >
          See everything near you
        </Link>
      </div>

      <div className="space-y-8">
        {locationResources.map(({ category, resources }) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 capitalize">{category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource: any) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  averageRating={resource.averageRating || 0}
                  ratingCount={resource.ratingCount || 0}
                  distance={resource.distance}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

async function QualityListsSection() {
  const mostUseful = await getMostUsefulResources(12)

  if (mostUseful.length === 0) {
    return null
  }

  return (
    <section className="mb-12" aria-labelledby="quality-lists-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <TrendingUp className="w-6 h-6 text-purple-600 mr-2" aria-hidden="true" />
          <h2 id="quality-lists-heading" className="text-2xl font-bold text-gray-900">
            Quality Lists
          </h2>
        </div>
        <Link
          href="/search?sort=helpful"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mostUseful.map((resource: any) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            averageRating={resource.averageRating}
            ratingCount={resource.ratingCount}
            variant="grid"
          />
        ))}
      </div>
    </section>
  )
}

async function RecentlyAddedSection() {
  const recentlyAdded = await getResources({ status: 'approved', limit: 9 })

  // Get ratings for each resource
  const resourcesWithRatings = await Promise.all(
    recentlyAdded.map(async (resource) => {
      const ratings = await getRatingsByResource(resource.id)
      const averageRating =
        ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.overall_score, 0) / ratings.length
          : 0
      return {
        ...resource,
        averageRating,
        ratingCount: ratings.length,
      }
    })
  )

  return (
    <section className="mb-12" aria-labelledby="recently-added-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Clock className="w-6 h-6 text-green-600 mr-2" aria-hidden="true" />
          <h2 id="recently-added-heading" className="text-2xl font-bold text-gray-900">
            Recently Added
          </h2>
        </div>
        <Link
          href="/search?sort=newest"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {resourcesWithRatings.map((resource: any) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            averageRating={resource.averageRating}
            ratingCount={resource.ratingCount}
            variant="grid"
          />
        ))}
      </div>
    </section>
  )
}

async function ClustersProfilesSection() {
  try {
    const supabase = createClient()

    // Try to get cached patterns first
    const { data: cachedPatterns } = await supabase
      .from('pattern_discoveries')
      .select('*')
      .order('discovered_at', { ascending: false })
      .limit(6)

    if (!cachedPatterns || cachedPatterns.length === 0) {
      return null
    }

    return (
      <section className="mb-12" aria-labelledby="clusters-heading">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Sparkles className="w-6 h-6 text-purple-600 mr-2" aria-hidden="true" />
            <h2 id="clusters-heading" className="text-2xl font-bold text-gray-900">
              Clusters & Profiles
            </h2>
          </div>
          <Link
            href="/search"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
          >
            Explore patterns
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cachedPatterns.map((pattern) => (
            <DiscoveryCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      </section>
    )
  } catch (error) {
    console.error('Error loading patterns:', error)
    return null
  }
}

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Note: Onboarding check is handled by middleware.ts
  // No need to check here to avoid redundant database queries

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1" role="main">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
                Welcome{user ? `, ${userName}` : ''}
              </h1>
              <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
                Find resources rated <span className="font-semibold">BY people like you</span>,{' '}
                <span className="font-semibold">FOR people like you</span>
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <form action="/search" method="get" className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <input
                  type="search"
                  name="q"
                  placeholder="Search for resources..."
                  className="flex-1 px-4 py-3 rounded-lg sm:rounded-r-none text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Search resources"
                />
                <button
                  type="submit"
                  className="bg-blue-700 hover:bg-blue-800 px-6 py-3 rounded-lg sm:rounded-l-none font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </form>
            </div>

            {/* Quick Category Filters */}
            <div className="max-w-4xl mx-auto">
              <p className="text-center text-white mb-5 text-sm font-medium uppercase tracking-wide">
                Browse by Category
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {categories.map((category) => {
                  const IconComponent = category.icon
                  return (
                    <Link
                      key={category.id}
                      href={`/search?categories=${encodeURIComponent(category.id)}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50"
                    >
                      <IconComponent className="w-4 h-4" aria-hidden="true" />
                      {category.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Browse by Norms — derived from the real conditions taxonomy so
                every chip links to a filter that actually exists (Odosa). */}
            <div className="max-w-4xl mx-auto mt-8">
              <p className="text-center text-white mb-5 text-sm font-medium uppercase tracking-wide">
                Browse by Norms
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {CONDITION_GROUPS.flatMap((g: any) => [
                  ...(g.conditions || []),
                  ...((g.groups || []).flatMap((sg: any) => sg.conditions || [])),
                ])
                  .slice(0, 10)
                  .map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/search?conditions=${encodeURIComponent(c.id)}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50"
                    >
                      {c.label}
                    </Link>
                  ))}
              </div>
            </div>

            {/* Browse by Life Categories — the folded-in Resource Roadmap
                domains, linking to the lifeAreas search filter (Odosa). */}
            <div className="max-w-4xl mx-auto mt-8">
              <p className="text-center text-white mb-5 text-sm font-medium uppercase tracking-wide">
                Browse by Life Categories
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {LIFE_AREAS.map((area) => (
                  <Link
                    key={area.id}
                    href={`/search?lifeAreas=${encodeURIComponent(area.id)}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50"
                  >
                    {area.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Content Sections - Organized per Architecture */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PersonalizedBanner />
          {/* Matched to the person's topic and what they hope to find, and
              "Welcome back" when it is time to ask for more (Group 8). */}
          <ForYou />
          {/* 1. Recommended for You - AI/Agent-based (works without login) */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="recommended-heading">
                <div className="flex items-center mb-6">
                  <h2 id="recommended-heading" className="text-2xl font-bold text-gray-900">
                    Recommended by AI Agent
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <RecommendedSection />
          </Suspense>

          {/* 2. Highest Ratings */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="highest-ratings-heading">
                <div className="flex items-center mb-6">
                  <Star className="w-6 h-6 text-yellow-600 mr-2" aria-hidden="true" />
                  <h2 id="highest-ratings-heading" className="text-2xl font-bold text-gray-900">
                    Highest Ratings
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <HighestRatingsSection />
          </Suspense>

          {/* 3. Highest Ratings by Category */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="highest-by-category-heading">
                <div className="flex items-center mb-6">
                  <Star className="w-6 h-6 text-yellow-600 mr-2" aria-hidden="true" />
                  <h2 id="highest-by-category-heading" className="text-2xl font-bold text-gray-900">
                    Highest Ratings by Category
                  </h2>
                </div>
                <div className="space-y-8">
                  {[...Array(3)].map((_, i) => (
                    <div key={i}>
                      <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, j) => (
                          <ResourceCardSkeleton key={j} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            }
          >
            <HighestRatingsByCategorySection />
          </Suspense>

          {/* 4. Avoidances */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="avoidances-heading">
                <div className="flex items-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-2" aria-hidden="true" />
                  <h2 id="avoidances-heading" className="text-2xl font-bold text-gray-900">
                    Resources to Avoid
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <AvoidancesSection />
          </Suspense>

          {/* 5. Cheapest */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="cheapest-heading">
                <div className="flex items-center mb-6">
                  <DollarSign className="w-6 h-6 text-green-600 mr-2" aria-hidden="true" />
                  <h2 id="cheapest-heading" className="text-2xl font-bold text-gray-900">
                    Cheapest Resources
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <CheapestSection />
          </Suspense>

          {/* 6. In Your Location */}
          {user && (
            <Suspense
              fallback={
                <section className="mb-12" aria-labelledby="location-collections-heading">
                  <div className="flex items-center mb-6">
                    <MapPin className="w-6 h-6 text-blue-600 mr-2" aria-hidden="true" />
                    <h2 id="location-collections-heading" className="text-2xl font-bold text-gray-900">
                      In Your Location
                    </h2>
                  </div>
                  <div className="space-y-8">
                    {[...Array(2)].map((_, i) => (
                      <div key={i}>
                        <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {[...Array(3)].map((_, j) => (
                            <ResourceCardSkeleton key={j} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              }
            >
              <LocationCollectionsSection />
            </Suspense>
          )}

          {/* 7. Quality Lists */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="quality-lists-heading">
                <div className="flex items-center mb-6">
                  <TrendingUp className="w-6 h-6 text-purple-600 mr-2" aria-hidden="true" />
                  <h2 id="quality-lists-heading" className="text-2xl font-bold text-gray-900">
                    Quality Lists
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <QualityListsSection />
          </Suspense>

          {/* 8. Clusters/Profiles */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="clusters-heading">
                <div className="flex items-center mb-6">
                  <Sparkles className="w-6 h-6 text-purple-600 mr-2" aria-hidden="true" />
                  <h2 id="clusters-heading" className="text-2xl font-bold text-gray-900">
                    Clusters & Profiles
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              </section>
            }
          >
            <ClustersProfilesSection />
          </Suspense>

          {/* 9. Recently Added */}
          <Suspense
            fallback={
              <section className="mb-12" aria-labelledby="recently-added-heading">
                <div className="flex items-center mb-6">
                  <Clock className="w-6 h-6 text-green-600 mr-2" aria-hidden="true" />
                  <h2 id="recently-added-heading" className="text-2xl font-bold text-gray-900">
                    Recently Added
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <RecentlyAddedSection />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  )
}
