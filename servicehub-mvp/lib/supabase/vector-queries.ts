import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './server'
import type { Database, ResourceEmbedding, UserEmbedding } from '@/types/database'
import {
  generateEmbedding,
  generateBarrierEmbedding,
  generateResourceEmbedding,
  generateResourceDescriptionEmbedding,
  cosineSimilarity,
} from '@/lib/embeddings/generator'

/**
 * Embedding writes must bypass RLS — `resource_embeddings` has no INSERT policy
 * and `user_embeddings` writes are restricted to `auth.uid() = user_id`, which
 * blocks system / cron / admin writes. Callers must pass a service-role client
 * for any write path that runs outside the owning user's session.
 */
type SupabaseLike = SupabaseClient<any, any, any>

// ==================== User Embedding Queries ====================

/**
 * Store or update user embedding for similarity matching.
 * Pass an admin (service-role) client when writing from a context that is not
 * the owning user's session — otherwise RLS will silently drop the write.
 */
export async function upsertUserEmbedding(
  userId: string,
  embedding: number[],
  barrierEmbedding?: number[],
  client?: SupabaseLike
): Promise<UserEmbedding | null> {
  const supabase = client ?? createClient()
  const { data, error } = await supabase
    .from('user_embeddings')
    .upsert({
      user_id: userId,
      embedding,
      barrier_embedding: barrierEmbedding || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting user embedding:', error)
    return null
  }

  return data
}

/**
 * Get user embedding by user ID
 */
export async function getUserEmbedding(userId: string): Promise<UserEmbedding | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_embeddings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching user embedding:', error)
    return null
  }

  return data
}

/**
 * Find similar users based on embedding similarity
 * Uses cosine similarity to find users with similar barrier profiles
 * Uses pgvector RPC function for efficient similarity search
 */
export async function findSimilarUsers(
  userId: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<Array<{ user_id: string; similarity: number }>> {
  const userEmbedding = await getUserEmbedding(userId)

  if (!userEmbedding || !userEmbedding.barrier_embedding) {
    return []
  }

  const supabase = createClient()
  // Use Supabase RPC function for vector similarity search
  const { data, error } = await supabase.rpc('find_similar_users', {
    query_embedding: userEmbedding.barrier_embedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    // Fallback to manual query if RPC doesn't exist yet
    console.warn('RPC function not found, using manual query:', error)
    return findSimilarUsersManual(userEmbedding.barrier_embedding, limit, threshold)
  }

  return data || []
}

/**
 * Manual implementation of similar users search
 * This queries all user embeddings and calculates cosine similarity
 */
async function findSimilarUsersManual(
  queryEmbedding: number[],
  limit: number,
  threshold: number
): Promise<Array<{ user_id: string; similarity: number }>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_embeddings')
    .select('user_id, barrier_embedding')

  if (error || !data) {
    console.error('Error fetching user embeddings:', error)
    return []
  }

  // Calculate cosine similarity for each embedding
  const similarities = data
    .filter((item) => item.barrier_embedding && item.barrier_embedding.length === queryEmbedding.length)
    .map((item) => {
      const similarity = cosineSimilarity(queryEmbedding, item.barrier_embedding as number[])
      return {
        user_id: item.user_id,
        similarity,
      }
    })
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return similarities
}

// ==================== Resource Embedding Queries ====================

/**
 * Store or update resource embedding for semantic search.
 * `resource_embeddings` has no INSERT/UPDATE policy in RLS, so every write must
 * go through a service-role client. Pass `client` from `createAdminClient()`.
 */
export async function upsertResourceEmbedding(
  resourceId: string,
  embedding: number[],
  descriptionEmbedding?: number[],
  client?: SupabaseLike
): Promise<ResourceEmbedding | null> {
  const supabase = client ?? createClient()
  const { data, error } = await supabase
    .from('resource_embeddings')
    .upsert({
      resource_id: resourceId,
      embedding,
      description_embedding: descriptionEmbedding || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting resource embedding:', error)
    return null
  }

  return data
}

/**
 * Get resource embedding by resource ID
 */
export async function getResourceEmbedding(resourceId: string): Promise<ResourceEmbedding | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('resource_embeddings')
    .select('*')
    .eq('resource_id', resourceId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching resource embedding:', error)
    return null
  }

  return data
}

/**
 * Semantic search for resources using vector similarity
 * Finds resources similar to the query embedding
 * Uses pgvector RPC function for efficient similarity search
 */
export async function semanticSearchResources(
  queryEmbedding: number[],
  options?: {
    limit?: number
    threshold?: number
    category?: string
    useDescriptionEmbedding?: boolean
  }
): Promise<Array<{ resource_id: string; similarity: number; name?: string; category?: string; description?: string }>> {
  const limit = options?.limit || 10
  const threshold = options?.threshold || 0.5
  const useDescriptionEmbedding = options?.useDescriptionEmbedding || false

  const supabase = createClient()

  // Use appropriate RPC function based on embedding type
  const rpcFunction = useDescriptionEmbedding
    ? 'search_resources_description_semantic'
    : 'search_resources_semantic'

  const { data, error } = await supabase.rpc(rpcFunction, {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    // Fallback to manual query if RPC doesn't exist yet
    console.warn('RPC function not found, using manual query:', error)
    return semanticSearchResourcesManual(queryEmbedding, limit, threshold, options)
  }

  return data || []
}

/**
 * Semantic search for resources using a text query
 * Generates embedding from query text and searches for similar resources
 */
export async function semanticResourceSearch(
  query: string,
  limit: number = 20,
  threshold: number = 0.5,
  category?: string
): Promise<Array<{ resource_id: string; similarity: number; id?: string; name?: string; category?: string; description?: string }>> {
  // Generate embedding for search query
  const queryEmbedding = await generateEmbedding(query)

  // Search using vector similarity
  const results = await semanticSearchResources(queryEmbedding, {
    limit,
    threshold,
    category,
  })

  // Normalize format - add id alias for convenience
  return results.map((r: any) => ({
    ...r,
    id: r.resource_id, // Add id alias
  }))
}

/**
 * Find similar resources to a given resource
 * Uses pgvector RPC function for efficient similarity search
 */
export async function findSimilarResources(
  resourceId: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<Array<{ resource_id: string; similarity: number; id?: string; name?: string; category?: string; description?: string }>> {
  const resourceEmbedding = await getResourceEmbedding(resourceId)

  if (!resourceEmbedding || !resourceEmbedding.embedding) {
    return []
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('find_similar_resources', {
    query_embedding: resourceEmbedding.embedding,
    match_threshold: threshold,
    match_count: limit + 1, // +1 to exclude source resource
  })

  if (error) {
    console.error('Error finding similar resources:', error)
    return []
  }

  // Filter out the source resource and normalize format
  return (data || [])
    .filter((r: any) => r.resource_id !== resourceId)
    .map((r: any) => ({
      ...r,
      id: r.resource_id, // Add id alias for convenience
    }))
    .slice(0, limit)
}

/**
 * Manual implementation of semantic resource search
 */
async function semanticSearchResourcesManual(
  queryEmbedding: number[],
  limit: number,
  threshold: number,
  options?: {
    category?: string
    useDescriptionEmbedding?: boolean
  }
): Promise<Array<{ resource_id: string; similarity: number }>> {
  const supabase = createClient()
  
  // Use separate query paths to avoid type inference issues
  let data: any[] | null = null
  let error: any = null

  if (options?.category) {
    // Join with resources table to filter by category
    const result = await supabase
      .from('resource_embeddings')
      .select(`
        resource_id,
        embedding,
        description_embedding,
        resources!inner(category)
      `)
      .eq('resources.category', options.category)
    data = result.data
    error = result.error
  } else {
    // Simple query without join
    const result = await supabase
      .from('resource_embeddings')
      .select('resource_id, embedding, description_embedding')
    data = result.data
    error = result.error
  }

  if (error || !data) {
    console.error('Error fetching resource embeddings:', error)
    return []
  }

  // Calculate cosine similarity
  const similarities = data
    .map((item) => {
      const embedding = options?.useDescriptionEmbedding ? item.description_embedding : item.embedding
      if (!embedding || embedding.length !== queryEmbedding.length) {
        return null
      }
      const similarity = cosineSimilarity(queryEmbedding, embedding as number[])
      return {
        resource_id: item.resource_id,
        similarity,
      }
    })
    .filter((item): item is { resource_id: string; similarity: number } => item !== null && item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return similarities
}

/**
 * Find resources similar to a user's barrier profile
 * Uses user's barrier embedding to find relevant resources
 * Uses pgvector RPC function for efficient similarity search
 */
export async function findResourcesForUser(
  userId: string,
  limit: number = 10,
  threshold: number = 0.6
): Promise<Array<{ resource_id: string; similarity: number; name?: string; category?: string; description?: string }>> {
  const supabase = createClient()

  // Use RPC function that directly queries with user_id
  const { data, error } = await supabase.rpc('find_resources_for_user', {
    user_id_param: userId,
    match_count: limit,
    match_threshold: threshold,
  })

  if (error) {
    // Fallback to manual approach
    console.warn('RPC function not found, using manual query:', error)
    const userEmbedding = await getUserEmbedding(userId)

    if (!userEmbedding || !userEmbedding.barrier_embedding) {
      return []
    }

    return semanticSearchResources(userEmbedding.barrier_embedding, {
      limit,
      threshold,
    })
  }

  return data || []
}

/**
 * Hybrid search: combines semantic search with keyword search
 * Returns resources that match both semantic similarity and keywords
 */
export async function hybridSearch(
  queryEmbedding: number[],
  keywords: string[],
  options?: {
    limit?: number
    semanticWeight?: number
    keywordWeight?: number
  }
): Promise<Array<{ resource_id: string; score: number }>> {
  const semanticWeight = options?.semanticWeight || 0.7
  const keywordWeight = options?.keywordWeight || 0.3
  const limit = options?.limit || 10

  const supabase = createClient()
  // Get semantic results
  const semanticResults = await semanticSearchResources(queryEmbedding, { limit: limit * 2 })

  // Get keyword results (simple text search)
  const keywordResults = await supabase
    .from('resources')
    .select('id')
    .or(keywords.map((kw) => `name.ilike.%${kw}%,description.ilike.%${kw}%`).join(','))
    .limit(limit * 2)

  // Combine and score results
  const combined = new Map<string, { semanticScore: number; keywordScore: number }>()

  semanticResults.forEach((result) => {
    combined.set(result.resource_id, {
      semanticScore: result.similarity,
      keywordScore: 0,
    })
  })

  if (keywordResults.data) {
    keywordResults.data.forEach((resource) => {
      const existing = combined.get(resource.id) || { semanticScore: 0, keywordScore: 0 }
      existing.keywordScore = 1 // Simple binary match
      combined.set(resource.id, existing)
    })
  }

  // Calculate weighted scores
  const scored = Array.from(combined.entries())
    .map(([resource_id, scores]) => ({
      resource_id,
      score: scores.semanticScore * semanticWeight + scores.keywordScore * keywordWeight,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}

// ==================== Utility Functions ====================

// Re-export embedding generation functions for convenience
export {
  generateEmbedding,
  generateBarrierEmbedding,
  generateResourceEmbedding,
  generateResourceDescriptionEmbedding,
  cosineSimilarity,
} from '@/lib/embeddings/generator'
