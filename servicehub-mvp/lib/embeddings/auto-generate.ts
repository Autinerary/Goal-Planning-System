import { createClient } from '@/lib/supabase/server'
import { generateBarrierEmbedding, generateResourceEmbedding, generateResourceDescriptionEmbedding } from '@/lib/embeddings/generator'
import { upsertUserEmbedding, upsertResourceEmbedding } from '@/lib/supabase/vector-queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import type { UserBarrier, Resource } from '@/types/database'

/**
 * Auto-generate embeddings when data changes
 * This ensures the vector database stays up-to-date
 */

/**
 * Generate embedding when user barriers are updated
 * Called after:
 * - User completes onboarding
 * - User updates barrier profile
 */
export async function onUserBarriersUpdated(userId: string, barriers: UserBarrier[]): Promise<boolean> {
  try {
    if (!barriers || barriers.length === 0) {
      console.warn(`No barriers provided for user ${userId}`)
      return false
    }

    // Generate barrier embedding from barriers
    const barrierEmbedding = await generateBarrierEmbedding(barriers)

    if (!barrierEmbedding || barrierEmbedding.length === 0) {
      console.error(`Failed to generate embedding for user ${userId}`)
      return false
    }

    // Store in vector database (main embedding is empty, barrier_embedding contains the barrier profile)
    await upsertUserEmbedding(userId, [], barrierEmbedding)

    return true
  } catch (error) {
    console.error(`Error generating user embedding for ${userId}:`, error)
    return false
  }
}

/**
 * Generate embedding when user barriers are loaded from database
 * Convenience function that fetches barriers and generates embedding
 */
export async function onUserBarriersLoadedFromDB(userId: string): Promise<boolean> {
  try {
    const userBarriers = await getUserBarriers(userId)

    if (!userBarriers || userBarriers.length === 0) {
      console.warn(`No barriers found for user ${userId}`)
      return false
    }

    // UserBarrier is already in the correct format for generateBarrierEmbedding
    return await onUserBarriersUpdated(userId, userBarriers)
  } catch (error) {
    console.error(`Error loading user barriers for ${userId}:`, error)
    return false
  }
}

/**
 * Generate embedding when resource is created
 * Called after:
 * - Admin approves new resource
 * - Resource is updated significantly
 */
export async function onResourceCreated(resource: Resource): Promise<boolean> {
  try {
    if (!resource || !resource.id) {
      console.warn('No resource provided for embedding generation')
      return false
    }

    // Generate embeddings for resource
    const mainEmbedding = await generateResourceEmbedding(resource)
    const descriptionEmbedding = resource.description
      ? await generateResourceDescriptionEmbedding(resource.description)
      : undefined

    if (!mainEmbedding || mainEmbedding.length === 0) {
      console.error(`Failed to generate embedding for resource ${resource.id}`)
      return false
    }

    // Store in vector database
    await upsertResourceEmbedding(resource.id, mainEmbedding, descriptionEmbedding)

    return true
  } catch (error) {
    console.error(`Error generating resource embedding for ${resource.id}:`, error)
    return false
  }
}

/**
 * Generate embedding when resource description is updated
 * Updates both main embedding and description embedding
 */
export async function onResourceDescriptionUpdated(
  resourceId: string,
  resource: Resource
): Promise<boolean> {
  try {
    if (!resourceId || !resource) {
      return false
    }

    // Generate both embeddings
    const mainEmbedding = await generateResourceEmbedding(resource)
    const descriptionEmbedding = resource.description
      ? await generateResourceDescriptionEmbedding(resource.description)
      : undefined

    if (!mainEmbedding || mainEmbedding.length === 0) {
      return false
    }

    // Update in vector database
    await upsertResourceEmbedding(resourceId, mainEmbedding, descriptionEmbedding)

    return true
  } catch (error) {
    console.error(`Error updating resource embedding for ${resourceId}:`, error)
    return false
  }
}

/**
 * Check if user has embedding, generate if missing
 */
export async function ensureUserEmbedding(userId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('user_embeddings')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      return true // Already has embedding
    }

    // Generate embedding
    return await onUserBarriersLoadedFromDB(userId)
  } catch (error) {
    console.error(`Error ensuring user embedding for ${userId}:`, error)
    return false
  }
}

/**
 * Check if resource has embedding, generate if missing
 */
export async function ensureResourceEmbedding(resourceId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('resource_embeddings')
      .select('id')
      .eq('resource_id', resourceId)
      .single()

    if (existing) {
      return true // Already has embedding
    }

    // Get resource and generate embedding
    const { data: resource } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .single()

    if (!resource) {
      return false
    }

    return await onResourceCreated(resource)
  } catch (error) {
    console.error(`Error ensuring resource embedding for ${resourceId}:`, error)
    return false
  }
}