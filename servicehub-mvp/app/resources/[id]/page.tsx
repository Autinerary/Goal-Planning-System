import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ratingAccess } from '@/lib/ratings/access'
import { getResourceDetail, getSimilarResources, countShortWaits } from '@/lib/supabase/queries'
import { findSimilarResources } from '@/lib/supabase/vector-queries'
import { findSimilarUsers } from '@/lib/supabase/vector-queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ResourceHeader from '@/components/resources/detail/ResourceHeader'
import ResourceContent from '@/components/resources/detail/ResourceContent'
import RatingsBreakdown from '@/components/resources/detail/RatingsBreakdown'
import CommunityReviews from '@/components/resources/detail/CommunityReviews'
import SimilarResources from '@/components/resources/detail/SimilarResources'
import ResourcePatterns from '@/components/resources/detail/ResourcePatterns'
import SensoryPanel from '@/components/sensory/SensoryPanel'
import DiagnosticsMatchBanner from '@/components/resources/detail/DiagnosticsMatchBanner'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import HiddenService from '@/components/resources/detail/HiddenService'
import ServiceComments from '@/components/resources/detail/ServiceComments'
import ClaimListing from '@/components/resources/detail/ClaimListing'
import ServiceSidebarNote from '@/components/resources/detail/ServiceSidebar'
import ReportProblem from '@/components/layout/ReportProblem'
import WaitTimes from '@/components/resources/detail/WaitTimes'
import OriginalArticle from '@/components/resources/detail/OriginalArticle'
import CommunityChoiceBadge from '@/components/communityChoice/CommunityChoiceBadge'
import UsersChoiceBadge from '@/components/shop/UsersChoiceBadge'
import { usersChoiceFor } from '@/lib/shop/usersChoice'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import type { Location } from '@/types/database'

interface PageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: PageProps) {
  const resource = await getResourceDetail(params.id)

  if (!resource) {
    return {
      title: 'Resource Not Found',
    }
  }

  const description = resource.description || `Find information about ${resource.name}, a ${resource.category} resource.`
  const image = resource.image_url || '/og-default.png'

  return {
    title: `${resource.name} | ResourceHub`,
    description,
    openGraph: {
      title: resource.name,
      description,
      type: 'website',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary',
      title: resource.name,
      description,
      images: [image],
    },
  }
}

async function ResourceDetailContent({ resourceId }: { resourceId: string }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resource = await getResourceDetail(resourceId, user?.id)

  if (!resource) {
    // Hidden by the rating sweep (Goal 5): shown only to those who may rate
    // it, whose ratings can bring it back.
    if (user?.id && /^[0-9a-f-]{36}$/i.test(resourceId)) {
      const access = await ratingAccess(supabase, resourceId).catch(() => null)
      if (access?.can_rate && !access.legacy) {
        const { data: hidden } = await createAdminClient()
          .from('resources')
          .select('id, name, category, description')
          .eq('id', resourceId)
          .eq('status', 'hidden')
          .maybeSingle()
        if (hidden) return <HiddenService resource={hidden} />
      }
    }
    notFound()
  }

  // Opening an article counts as reading it, for "Already read" (the planning
  // note, October 2026; STEP 78). Best-effort: before STEP 78 the table is
  // missing and nothing is kept.
  if (user?.id && (resource.category === 'commentary' || ['news', 'reddit', 'twitter', 'facebook', 'youtube', 'tiktok', 'instagram'].includes(String((resource as any).source_type)))) {
    await supabase.from('resource_reads').upsert({ user_id: user.id, resource_id: resource.id }, { onConflict: 'user_id,resource_id', ignoreDuplicates: true })
  }

  const location = resource.location as Location | null

  // Diagnostics-profile match: how many users who share this user's barrier
  // (Diagnostics) profile rated THIS resource highly. Powers the "based on
  // those who matched your Diagnostics profile" banner. Best-effort — any
  // failure just hides the banner.
  let diagnosticsMatch: { labels: string[]; count: number; avg: number } | null = null
  if (user?.id) {
    try {
      const [userBarriers, similarUsers] = await Promise.all([
        getUserBarriers(user.id),
        findSimilarUsers(user.id, 50, 0.6),
      ])
      const labels = userBarriers.map((b) =>
        b.barrier_type
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      )
      if (labels.length > 0) {
        const similarIds = similarUsers.map((u) => u.user_id)
        let count = 0
        let avg = 0
        if (similarIds.length > 0) {
          const { data: ratings } = await supabase
            .from('ratings')
            .select('user_id, overall_score')
            .eq('resource_id', resourceId)
            .in('user_id', similarIds)
            .gte('overall_score', 4)
          if (ratings && ratings.length > 0) {
            count = ratings.length
            avg = ratings.reduce((s, r) => s + r.overall_score, 0) / ratings.length
          }
        }
        diagnosticsMatch = { labels, count, avg }
      }
    } catch (error) {
      console.error('Error computing Diagnostics-profile match:', error)
    }
  }

  // Get similar resources using vector similarity (semantic similarity, not just category)
  // This finds resources that are semantically similar, not just same category!
  let similarResources: any[] = []
  try {
    const vectorResults = await findSimilarResources(resourceId, 6, 0.7)

    if (vectorResults && vectorResults.length > 0) {
      // Fetch full resource data for vector results
      const supabase = createClient()
      const resourceIds = vectorResults.map((r: any) => r.resource_id || r.id)
      const { data: vectorResources } = await supabase
        .from('resources')
        .select('*')
        .in('id', resourceIds)
        .eq('status', 'approved')

      // Map similarity scores back to resources
      const similarityMap = new Map(
        vectorResults.map((r: any) => [r.resource_id || r.id, r.similarity || 0])
      )
      similarResources = (vectorResources || []).map((r) => ({
        ...r,
        similarity: similarityMap.get(r.id) || 0,
      }))
    }

    // Fallback to category-based similarity if vector search returns few results
    if (similarResources.length < 3) {
      const categorySimilar = await getSimilarResources(
        resourceId,
        resource.category,
        location || undefined,
        6
      )
      // Merge results, prioritizing vector similarity
      const seenIds = new Set(similarResources.map((r: any) => r.id))
      const uniqueCategorySimilar = categorySimilar.filter((r) => !seenIds.has(r.id))
      similarResources = [...similarResources, ...uniqueCategorySimilar].slice(0, 6)
    }
  } catch (error) {
    console.error('Error finding similar resources:', error)
    // Fallback to category-based similarity
    similarResources = await getSimilarResources(
      resourceId,
      resource.category,
      location || undefined,
      6
    )
  }

  const choice = (await usersChoiceFor(resource.category === 'commentary' ? 'article' : 'service', [resourceId])).get(resourceId) || []

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Search', href: '/search' },
          { label: resource.category, href: `/search?categories=${resource.category}` },
          { label: resource.name, href: `/resources/${resource.id}` },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ResourceHeader resource={resource} userId={user?.id} />
        {/* Users' Choice and Community's Choice of the year (the products round, Goal 8: for every kind of item). */}
        {(choice.length > 0 || ((resource as any).tags || []).includes('community_choice_year')) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {((resource as any).tags || []).includes('community_choice_year') && <CommunityChoiceBadge size="md" month="of the year" />}
            {choice.map((c) => (
              <UsersChoiceBadge key={c.userType} size="md" label={c.label} detail={`${c.average.toFixed(1)} out of 5 from ${c.ratings} ratings`} />
            ))}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {diagnosticsMatch && (
              <DiagnosticsMatchBanner
                profileLabels={diagnosticsMatch.labels}
                similarUserCount={diagnosticsMatch.count}
                averageRating={diagnosticsMatch.avg}
              />
            )}

            <OriginalArticle resource={resource as any} />

            <ResourceContent resource={resource} />

            <RatingsBreakdown
              averageRating={resource.averageRating}
              ratingCount={resource.ratingCount}
              ratingDistribution={resource.ratingDistribution}
              barrierScores={resource.barrierScores}
              diagnosticBreakdown={resource.diagnosticBreakdown}
              orgBreakdown={resource.orgBreakdown}
              relationshipMix={resource.relationshipMix}
              weightedRating={resource.weightedRating}
            />

            {/* Measured conditions, ahead of written reviews: whether you
                can be in the room at all comes before whether the service
                was good. */}
            <SensoryPanel
              resourceId={resourceId}
              resourceName={resource.name}
              signedIn={Boolean(user?.id)}
            />

            <CommunityReviews resourceId={resourceId} userId={user?.id} />

            <ServiceComments resourceId={resourceId} resourceName={resource.name} signedIn={Boolean(user?.id)} />

            <ResourcePatterns resourceId={resourceId} category={resource.category} />

            {similarResources.length > 0 && (
              <SimilarResources resources={similarResources} />
            )}
          </div>

          {/* Sidebar: a note for the person's norms (Goal 11), and the way in
              for whoever runs the service (Resource Accounts). Similar
              resources on mobile moved to main content. */}
          <div className="lg:col-span-1 space-y-4">
            <ServiceSidebarNote />
            <WaitTimes resource={resource as any} shortWaits={await countShortWaits()} />
            <ClaimListing kind="resource" id={resourceId} />
            <ReportProblem about={resource.category === 'commentary' ? 'article' : 'service'} name={resource.name} />
          </div>
        </div>
      </div>
    </>
  )
}

export default async function ResourceDetailPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-12 bg-gray-200 rounded w-full mb-6"></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="h-64 bg-gray-200 rounded"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                  </div>
                  <div className="lg:col-span-1">
                    <div className="h-64 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <ResourceDetailContent resourceId={params.id} />
        </Suspense>
      </main>

      <Footer />
    </div>
  )
}