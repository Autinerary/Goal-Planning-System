/**
 * Background job helpers for generating embeddings
 * These functions can be called after user/resource updates.
 *
 * All embedding writes use the service-role admin client because the
 * `resource_embeddings` table has no INSERT/UPDATE policy and
 * `user_embeddings` writes are restricted to the owning user's session, which
 * is unreliable in fire-and-forget post-response callbacks. Caller
 * authorization is enforced upstream in the route handler.
 */

import {
  generateBarrierEmbedding,
  generateResourceEmbedding,
  generateResourceDescriptionEmbedding,
} from './generator'
import {
  upsertUserEmbedding,
  upsertResourceEmbedding,
} from '@/lib/supabase/vector-queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import { getResourceById } from '@/lib/supabase/queries'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Generate and store user embedding after onboarding or barrier updates
 * Call this after:
 * - User completes onboarding
 * - User adds/updates barriers
 * - User profile changes
 * 
 * This runs asynchronously and doesn't block the main request
 */
export async function generateUserEmbeddingJob(userId: string): Promise<void> {
  try {
    const admin = createAdminClient()

    // Get user barriers
    const barriers = await getUserBarriers(userId, admin)

    // Generate barrier embedding
    const barrierEmbedding = await generateBarrierEmbedding(barriers)

    // Store embedding (user embedding can be null for now)
    await upsertUserEmbedding(userId, [], barrierEmbedding, admin)

    console.log(`Generated embedding for user ${userId}`)
  } catch (error) {
    console.error(`Error generating user embedding for ${userId}:`, error)
    // Don't throw - this is a background job, failures shouldn't break the main flow
  }
}

/**
 * Generate and store resource embedding after resource creation/update
 * Call this after:
 * - Resource is created
 * - Resource is updated (description, name, category)
 * - Resource is approved (if you want to regenerate)
 * 
 * This runs asynchronously and doesn't block the main request
 */
export async function generateResourceEmbeddingJob(
  resourceId: string
): Promise<void> {
  try {
    // Get resource
    const resource = await getResourceById(resourceId)

    if (!resource) {
      console.warn(`Resource ${resourceId} not found for embedding generation`)
      return
    }

    // Generate embeddings
    const embedding = await generateResourceEmbedding(resource)
    const descriptionEmbedding = resource.description
      ? await generateResourceDescriptionEmbedding(resource.description)
      : null

    // Store embeddings (admin client required — resource_embeddings has no INSERT policy)
    await upsertResourceEmbedding(
      resourceId,
      embedding,
      descriptionEmbedding || undefined,
      createAdminClient()
    )

    console.log(`Generated embeddings for resource ${resourceId}`)
  } catch (error) {
    console.error(`Error generating resource embedding for ${resourceId}:`, error)
    // Don't throw - this is a background job, failures shouldn't break the main flow
  }
}

/**
 * Regenerate embeddings for all users (useful for maintenance)
 * Note: This can be resource-intensive, run during off-peak hours
 */
export async function regenerateAllUserEmbeddings(): Promise<{
  success: number
  failed: number
}> {
  const supabase = createAdminClient()

  let success = 0
  let failed = 0

  try {
    // Get all users with barriers
    const { data: users } = await supabase
      .from('user_barriers')
      .select('user_id')
      .order('user_id')

    if (!users) {
      return { success: 0, failed: 0 }
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(users.map((u) => u.user_id))]

    // Generate embeddings for each user
    for (const userId of uniqueUserIds) {
      try {
        await generateUserEmbeddingJob(userId)
        success++
      } catch (error) {
        console.error(`Failed to generate embedding for user ${userId}:`, error)
        failed++
      }
    }

    return { success, failed }
  } catch (error) {
    console.error('Error regenerating user embeddings:', error)
    return { success, failed }
  }
}

/**
 * Regenerate embeddings for all approved resources (useful for maintenance)
 * Note: This can be resource-intensive, run during off-peak hours
 */
export async function regenerateAllResourceEmbeddings(): Promise<{
  success: number
  failed: number
}> {
  const supabase = createAdminClient()

  let success = 0
  let failed = 0

  try {
    // Get all approved resources
    const { data: resources } = await supabase
      .from('resources')
      .select('id')
      .eq('status', 'approved')

    if (!resources) {
      return { success: 0, failed: 0 }
    }

    // Generate embeddings for each resource
    for (const resource of resources) {
      try {
        await generateResourceEmbeddingJob(resource.id)
        success++
      } catch (error) {
        console.error(
          `Failed to generate embedding for resource ${resource.id}:`,
          error
        )
        failed++
      }
    }

    return { success, failed }
  } catch (error) {
    console.error('Error regenerating resource embeddings:', error)
    return { success, failed }
  }
}
