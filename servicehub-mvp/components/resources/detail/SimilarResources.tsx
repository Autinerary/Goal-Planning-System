import ResourceCard from '@/components/resources/ResourceCard'
import { getRatingsByResource } from '@/lib/supabase/queries'
import type { Resource } from '@/types/database'

interface SimilarResourcesProps {
  resources: Resource[]
}

export default async function SimilarResources({ resources }: SimilarResourcesProps) {
  // Get ratings for each resource
  const resourcesWithRatings = await Promise.all(
    resources.map(async (resource) => {
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

  if (resourcesWithRatings.length === 0) {
    return null
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Similar Resources</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {resourcesWithRatings.map((resource: any) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            averageRating={resource.averageRating || 0}
            ratingCount={resource.ratingCount || 0}
          />
        ))}
      </div>
    </section>
  )
}