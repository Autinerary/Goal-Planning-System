import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResourceDetail, getSimilarResources } from '@/lib/supabase/queries'
import { findSimilarResources } from '@/lib/supabase/vector-queries'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ResourceHeader from '@/components/resources/detail/ResourceHeader'
import ResourceContent from '@/components/resources/detail/ResourceContent'
import RatingsBreakdown from '@/components/resources/detail/RatingsBreakdown'
import CommunityReviews from '@/components/resources/detail/CommunityReviews'
import SimilarResources from '@/components/resources/detail/SimilarResources'
import ResourcePatterns from '@/components/resources/detail/ResourcePatterns'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
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
    notFound()
  }

  const location = resource.location as Location | null

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

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <ResourceContent resource={resource} />

            <RatingsBreakdown
              averageRating={resource.averageRating}
              ratingCount={resource.ratingCount}
              ratingDistribution={resource.ratingDistribution}
              barrierScores={resource.barrierScores}
            />

            <CommunityReviews resourceId={resourceId} userId={user?.id} />

            <ResourcePatterns resourceId={resourceId} category={resource.category} />

            {similarResources.length > 0 && (
              <SimilarResources resources={similarResources} />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Similar resources on mobile moved to main content */}
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