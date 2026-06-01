import { createClient } from '@/lib/supabase/server'
import { findSimilarUsers } from '@/lib/supabase/vector-queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import { generateBarrierEmbedding } from '@/lib/embeddings/generator'
import type { SimilarUser, Barrier } from './types'

/**
 * Find similar users based on barrier profiles
 * Uses vector embeddings for accurate similarity matching
 * This replaces manual barrier comparison with semantic similarity!
 * Much more accurate - captures nuances like "sensory + cognitive" vs. "sensory + mobility"
 */
export async function findSimilarUsersByBarriers(
  userId: string,
  barriers: Barrier[],
  limit: number = 50,
  threshold: number = 0.7
): Promise<SimilarUser[]> {
  try {
    const supabase = createClient()

    // Option 1: Use existing user embedding (if userId provided)
    if (userId) {
      const similarUsers = await findSimilarUsers(userId, limit, threshold)

      // Enrich with barrier data
      const enrichedUsers = await Promise.all(
        similarUsers.map(async (user) => {
          const userBarriers = await getUserBarriers(user.user_id)
          return {
            ...user,
            barriers: userBarriers,
          }
        })
      )

      return enrichedUsers
    }

    // Option 2: Generate embedding on-the-fly for anonymous users or custom barriers
    if (barriers && barriers.length > 0) {
      const barrierEmbedding = await generateBarrierEmbedding(barriers)

      // Search directly with embedding using vector database
      const { data, error } = await supabase.rpc('find_similar_users', {
        query_embedding: barrierEmbedding,
        match_threshold: threshold,
        match_count: limit,
      })

      if (error) {
        console.error('Error finding similar users with embedding:', error)
        return []
      }

      // Enrich with barrier data
      const enrichedUsers = await Promise.all(
        (data || []).map(async (user: any) => {
          const userBarriers = await getUserBarriers(user.user_id)
          return {
            user_id: user.user_id,
            similarity: user.similarity,
            barriers: userBarriers,
          }
        })
      )

      return enrichedUsers
    }

    return []
  } catch (error) {
    console.error('Error finding similar users:', error)
    return []
  }
}

/**
 * Calculate barrier overlap score between two users
 * Returns a score between 0 and 1
 */
export function calculateBarrierOverlap(
  barriers1: Barrier[],
  barriers2: Barrier[]
): number {
  if (barriers1.length === 0 || barriers2.length === 0) {
    return 0
  }

  // Create sets of barrier keys
  const set1 = new Set(barriers1.map((b) => `${b.category}:${b.type}`))
  const set2 = new Set(barriers2.map((b) => `${b.category}:${b.type}`))

  // Calculate intersection
  let intersection = 0
  set1.forEach((barrier) => {
    if (set2.has(barrier)) {
      intersection++
    }
  })

  // Calculate union
  const union = new Set([...set1, ...set2]).size

  // Jaccard similarity
  return union > 0 ? intersection / union : 0
}