import { createClient } from './server'
import type { Database, Profile, Resource, Rating, UserBarrier, SavedResource, Location, ContactInfo, BarrierScores } from '@/types/database'

// ==================== Profile Queries ====================

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

export async function createProfile(profile: {
  id: string
  email?: string
  full_name?: string
  role?: Profile['role']
  location?: Location
}): Promise<Profile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single()

  if (error) {
    console.error('Error creating profile:', error)
    return null
  }

  return data
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating profile:', error)
    return null
  }

  return data
}

// ==================== User Barriers Queries ====================

export async function getUserBarriers(userId: string): Promise<UserBarrier[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_barriers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user barriers:', error)
    return []
  }

  return data || []
}

export async function addUserBarrier(barrier: {
  user_id: string
  barrier_category: string
  barrier_type: string
  severity?: number
  notes?: string
}): Promise<UserBarrier | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_barriers')
    .insert(barrier)
    .select()
    .single()

  if (error) {
    console.error('Error adding user barrier:', error)
    return null
  }

  // Regenerate user embedding in background after barrier update
  // Uncomment to enable automatic embedding regeneration:
  // import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'
  // generateUserEmbeddingJob(barrier.user_id).catch(console.error)

  return data
}

export async function deleteUserBarrier(barrierId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_barriers')
    .delete()
    .eq('id', barrierId)

  if (error) {
    console.error('Error deleting user barrier:', error)
    return false
  }

  return true
}

// ==================== Resource Queries ====================

export async function getResources(filters?: {
  status?: Resource['status']
  category?: string
  limit?: number
  offset?: number
}): Promise<Resource[]> {
  const supabase = createClient()
  let query = supabase
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching resources:', error)
    return []
  }

  return data || []
}

export async function getResourceById(resourceId: string): Promise<Resource | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', resourceId)
    .single()

  if (error) {
    console.error('Error fetching resource:', error)
    return null
  }

  return data
}

export async function createResource(resource: {
  name: string
  description?: string
  category: string
  location?: Location
  contact_info?: ContactInfo
  price?: number | null
  image_url?: string
  submitted_by: string
  status?: 'pending' | 'approved' | 'rejected'
}): Promise<Resource | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('resources')
    .insert(resource)
    .select()
    .single()

  if (error) {
    console.error('Error creating resource:', error)
    return null
  }

  // Add to moderation queue
  if (data) {
    await supabase.from('moderation_queue').insert({
      item_type: 'resource',
      item_id: data.id,
      status: 'pending',
    })

    // Generate embedding in background (non-blocking)
    // Uncomment to enable automatic embedding generation:
    // import { generateResourceEmbeddingJob } from '@/lib/embeddings/background-jobs'
    // generateResourceEmbeddingJob(data.id).catch(console.error)
  }

  return data
}

export async function updateResource(resourceId: string, updates: Partial<Resource>): Promise<Resource | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('resources')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', resourceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating resource:', error)
    return null
  }

  return data
}

/**
 * Get resource with aggregated rating data and statistics
 */
export interface ResourceDetail extends Resource {
  averageRating: number
  ratingCount: number
  ratingDistribution: { [key: number]: number } // { 5: 10, 4: 5, ... }
  barrierScores: { [barrier: string]: { average: number; count: number } }
  userRating?: Rating | null // Current user's rating if logged in
  isSaved?: boolean // Whether current user has saved this resource
  recommendedByAutismCommunity?: boolean // If highly rated by users with autism barriers
}

export async function getResourceDetail(resourceId: string, userId?: string): Promise<ResourceDetail | null> {
  const supabase = createClient()

  // Get resource
  const { data: resource, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', resourceId)
    .single()

  if (error || !resource) {
    return null
  }

  // Get all ratings for this resource
  const { data: ratings } = await supabase
    .from('ratings')
    .select('*')
    .eq('resource_id', resourceId)

  const ratingCount = ratings?.length || 0
  const averageRating =
    ratingCount > 0
      ? ratings!.reduce((sum, r) => sum + r.overall_score, 0) / ratingCount
      : 0

  // Calculate rating distribution
  const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  if (ratings) {
    for (const rating of ratings) {
      ratingDistribution[rating.overall_score] =
        (ratingDistribution[rating.overall_score] || 0) + 1
    }
  }

  // Calculate barrier scores
  const barrierScores: { [barrier: string]: { sum: number; count: number } } = {}
  if (ratings) {
    for (const rating of ratings) {
      if (rating.barrier_scores) {
        const scores = rating.barrier_scores as BarrierScores
        for (const [barrier, score] of Object.entries(scores)) {
          if (typeof score === 'number') {
            if (!barrierScores[barrier]) {
              barrierScores[barrier] = { sum: 0, count: 0 }
            }
            barrierScores[barrier].sum += score
            barrierScores[barrier].count += 1
          }
        }
      }
    }
  }

  // Convert barrier scores to averages
  const barrierAverages: { [barrier: string]: { average: number; count: number } } = {}
  for (const [barrier, data] of Object.entries(barrierScores)) {
    barrierAverages[barrier] = {
      average: data.count > 0 ? data.sum / data.count : 0,
      count: data.count,
    }
  }

  // Get user's rating if logged in
  let userRating: Rating | null = null
  if (userId) {
    userRating = await getRatingByUserAndResource(resourceId, userId)
  }

  // Check if resource is saved
  let isSaved = false
  if (userId) {
    const { data: saved, error } = await supabase
      .from('saved_resources')
      .select('id')
      .eq('user_id', userId)
      .eq('resource_id', resourceId)
      .maybeSingle()
    isSaved = !error && !!saved
  }

  // Check if recommended by autism community (high ratings from users with autism barriers)
  let recommendedByAutismCommunity = false
  if (ratings && ratings.length > 0) {
    // Get user IDs who rated this resource
    const ratingUserIds = ratings.map((r) => r.user_id)
    
    // Get users with autism barriers who rated this resource
    const { data: autismUsers } = await supabase
      .from('user_barriers')
      .select('user_id')
      .eq('barrier_type', 'autism')
      .in('user_id', ratingUserIds)
    
    if (autismUsers && autismUsers.length > 0) {
      const autismUserIds = [...new Set(autismUsers.map((u) => u.user_id))]
      // Get ratings from autism users
      const autismRatings = ratings.filter((r) => autismUserIds.includes(r.user_id))
      
      if (autismRatings.length >= 3) {
        // Calculate average rating from autism users
        const autismAverage =
          autismRatings.reduce((sum, r) => sum + r.overall_score, 0) / autismRatings.length
        // Recommended if average >= 4.0 and at least 3 ratings
        recommendedByAutismCommunity = autismAverage >= 4.0
      }
    }
  }

  return {
    ...resource,
    averageRating,
    ratingCount,
    ratingDistribution,
    barrierScores: barrierAverages,
    userRating: userRating || undefined,
    isSaved,
    recommendedByAutismCommunity,
  }
}

/**
 * Get similar resources (same category or nearby location)
 */
export async function getSimilarResources(
  resourceId: string,
  category?: string,
  location?: Location,
  limit: number = 6
): Promise<Resource[]> {
  const supabase = createClient()

  let query = supabase
    .from('resources')
    .select('*')
    .eq('status', 'approved')
    .neq('id', resourceId)
    .limit(limit)

  // Prefer same category
  if (category) {
    query = query.eq('category', category)
  }

  const { data: resources } = await query

  if (!resources || resources.length === 0) {
    // Fallback: get any approved resources
    const { data: fallback } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .neq('id', resourceId)
      .limit(limit)

    return fallback || []
  }

  return resources
}

// ==================== Rating Queries ====================

export async function getRatingsByResource(resourceId: string): Promise<Rating[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching ratings:', error)
    return []
  }

  return data || []
}

export async function getRatingByUserAndResource(resourceId: string, userId: string): Promise<Rating | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('resource_id', resourceId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Error fetching rating:', error)
    return null
  }

  return data
}

export async function createOrUpdateRating(rating: {
  resource_id: string
  user_id: string
  overall_score: number
  barrier_scores?: BarrierScores
  comment?: string
}): Promise<Rating | null> {
  const supabase = createClient()
  // Check if rating exists
  const existing = await getRatingByUserAndResource(rating.resource_id, rating.user_id)

  if (existing) {
    // Update existing rating
    const { data, error } = await supabase
      .from('ratings')
      .update(rating)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating rating:', error)
      return null
    }

    // Add to moderation queue if comment was added/updated
    if (rating.comment) {
      await supabase.from('moderation_queue').upsert({
        item_type: 'rating',
        item_id: data.id,
        status: 'pending',
      })
    }

    return data
  } else {
    // Create new rating
    const { data, error } = await supabase
      .from('ratings')
      .insert(rating)
      .select()
      .single()

    if (error) {
      console.error('Error creating rating:', error)
      return null
    }

    // Add to moderation queue
    if (rating.comment) {
      await supabase.from('moderation_queue').insert({
        item_type: 'rating',
        item_id: data.id,
        status: 'pending',
      })
    }

    return data
  }
}

export async function markRatingHelpful(ratingId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.rpc('increment_helpful_count', { rating_id: ratingId })

  if (error) {
    // If RPC doesn't exist, fetch current count and increment
    const { data: currentRating } = await supabase
      .from('ratings')
      .select('helpful_count')
      .eq('id', ratingId)
      .single()
    
    if (currentRating) {
      const { error: updateError } = await supabase
        .from('ratings')
        .update({ helpful_count: (currentRating.helpful_count || 0) + 1 })
        .eq('id', ratingId)

      if (updateError) {
        console.error('Error marking rating helpful:', updateError)
        return false
      }
    }
  }

  return true
}

// ==================== Saved Resources Queries ====================

export async function getSavedResources(userId: string): Promise<SavedResource[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('saved_resources')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching saved resources:', error)
    return []
  }

  return data || []
}

export async function saveResource(
  userId: string,
  resourceId: string,
  notes?: string,
  status: 'wishlist' | 'current' | 'past' = 'wishlist'
): Promise<SavedResource | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('saved_resources')
    .upsert({
      user_id: userId,
      resource_id: resourceId,
      notes,
      status,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving resource:', error)
    return null
  }

  return data
}

export async function updateSavedResourceStatus(
  userId: string,
  resourceId: string,
  status: 'wishlist' | 'current' | 'past'
): Promise<SavedResource | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('saved_resources')
    .update({ status })
    .eq('user_id', userId)
    .eq('resource_id', resourceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating saved resource status:', error)
    return null
  }

  return data
}

export async function unsaveResource(userId: string, resourceId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('saved_resources')
    .delete()
    .eq('user_id', userId)
    .eq('resource_id', resourceId)

  if (error) {
    console.error('Error unsaving resource:', error)
    return false
  }

  return true
}

// ==================== Moderation Queue Queries ====================

export async function getModerationQueue(status?: 'pending' | 'approved' | 'rejected'): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('moderation_queue')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching moderation queue:', error)
    return []
  }

  return data || []
}

export async function updateModerationStatus(
  queueId: string,
  status: 'approved' | 'rejected',
  reason?: string,
  reviewedBy?: string
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('moderation_queue')
    .update({
      status,
      reason,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', queueId)

  if (error) {
    console.error('Error updating moderation status:', error)
    return false
  }

  // Also update the original item status
  const queueItem = await supabase
    .from('moderation_queue')
    .select('item_type, item_id')
    .eq('id', queueId)
    .single()

  if (queueItem.data) {
    if (queueItem.data.item_type === 'resource') {
      await supabase
        .from('resources')
        .update({ status })
        .eq('id', queueItem.data.item_id)
    } else if (queueItem.data.item_type === 'rating') {
      // Ratings don't have status, but you could add moderation flags if needed
    }
  }

  return true
}

// ==================== Search & Filter Queries ====================

export interface SearchFilters {
  query?: string // Text search
  categories?: string[] // Category multi-select
  barriers?: string[] // Barrier types (e.g., 'autism', 'adhd')
  /**
   * Static-taxonomy condition tokens (e.g. 'autism:level_2', 'cluster_b').
   * Each token is decomposed into match keys that are tested against resource
   * tags + the keys of any rating's barrier_scores object.
   */
  conditions?: string[]
  minRating?: number // Minimum star rating (1-5)
  /**
   * One or more "X+ stars" buckets. If multiple are set (e.g. [4, 5]) the
   * lowest is used as the minimum threshold.
   */
  ratingStars?: number[]
  minPrice?: number // Lower bound on resource price (inclusive)
  maxPrice?: number // Upper bound on resource price (inclusive)
  maxDistance?: number // Maximum distance in km
  userLocation?: { lat: number; lng: number } // User's location for distance calculation
  status?: Resource['status'] // Resource status (default: 'approved')
}

export type SortOption = 'relevance' | 'rating' | 'distance' | 'reviews' | 'newest' | 'cost'

export interface SortRule {
  key: SortOption
  direction: 'asc' | 'desc'
}

export interface SearchResult extends Resource {
  averageRating: number
  ratingCount: number
  distance?: number // Distance in km from user
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get aggregated rating statistics for resources
 */
async function getResourceRatings(resourceIds: string[]): Promise<Map<string, { averageRating: number; ratingCount: number }>> {
  if (resourceIds.length === 0) return new Map()

  const supabase = createClient()
  const { data: ratings } = await supabase
    .from('ratings')
    .select('resource_id, overall_score')
    .in('resource_id', resourceIds)

  if (!ratings) return new Map()

  const ratingMap = new Map<string, { averageRating: number; ratingCount: number }>()

  // Group ratings by resource
  const resourceRatings = new Map<string, number[]>()
  for (const rating of ratings) {
    if (!resourceRatings.has(rating.resource_id)) {
      resourceRatings.set(rating.resource_id, [])
    }
    resourceRatings.get(rating.resource_id)!.push(rating.overall_score)
  }

  // Calculate averages
  for (const [resourceId, scores] of resourceRatings.entries()) {
    const averageRating = scores.reduce((a, b) => a + b, 0) / scores.length
    ratingMap.set(resourceId, {
      averageRating,
      ratingCount: scores.length,
    })
  }

  return ratingMap
}

/**
 * Comprehensive search function with filters, sorting, and pagination.
 *
 * `sort` accepts either a single SortOption (legacy) or an ordered array of
 * SortRule objects. With an array, rules are applied as a primary/secondary/
 * tertiary sort — the first non-equal comparison wins.
 */
export async function searchResources(
  filters: SearchFilters = {},
  sort: SortOption | SortRule[] = 'relevance',
  page: number = 1,
  pageSize: number = 20
): Promise<{ results: SearchResult[]; total: number; page: number; pageSize: number }> {
  const supabase = createClient()
  const offset = (page - 1) * pageSize

  // Start with base query - only approved resources by default
  let query = supabase
    .from('resources')
    .select('*', { count: 'exact' })
    .eq('status', filters.status || 'approved')

  // Text search - search in name, description, and category
  if (filters.query && filters.query.trim()) {
    const searchTerm = filters.query.trim()
    query = query.or(
      `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`
    )
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.in('category', filters.categories)
  }

  // Get all matching resources first
  const { data: resourcesData, error, count } = await query

  if (error) {
    console.error('Error searching resources:', error)
    return { results: [], total: 0, page, pageSize }
  }

  if (!resourcesData || resourcesData.length === 0) {
    return { results: [], total: 0, page, pageSize }
  }

  let resources = resourcesData
  let resourceIds = resources.map((r) => r.id)

  // Get rating statistics
  const ratingMap = await getResourceRatings(resourceIds)

  // Filter by barrier types (if specified)
  if (filters.barriers && filters.barriers.length > 0) {
    // Get resources that have ratings with the specified barrier scores
    const { data: barrierRatings } = await supabase
      .from('ratings')
      .select('resource_id, barrier_scores')
      .in('resource_id', resourceIds)
      .not('barrier_scores', 'is', null)

    // Filter resources that have at least one rating with the specified barriers
    const resourcesWithBarriers = new Set<string>()
    barrierRatings?.forEach((rating) => {
      if (rating.barrier_scores) {
        const scores = rating.barrier_scores as { [key: string]: number }
        // Check if any of the selected barriers exist in this rating's barrier_scores
        const hasBarrier = filters.barriers!.some((barrier) => barrier in scores)
        if (hasBarrier) {
          resourcesWithBarriers.add(rating.resource_id)
        }
      }
    })

    // Only keep resources that have ratings with the specified barriers
    resources = resources.filter((r) => resourcesWithBarriers.has(r.id))
    resourceIds = resources.map((r) => r.id)
  }

  // Filter by Conditions (static taxonomy tokens: 'autism', 'autism:level_2', …)
  if (filters.conditions && filters.conditions.length > 0) {
    // Build the flat set of match keys for all selected condition tokens.
    const matchKeys = new Set<string>()
    for (const token of filters.conditions) {
      const colon = token.indexOf(':')
      const id = colon === -1 ? token : token.slice(0, colon)
      const sub = colon === -1 ? undefined : token.slice(colon + 1)
      matchKeys.add(id.toLowerCase())
      if (sub) {
        matchKeys.add(sub.toLowerCase())
        matchKeys.add(`${id}_${sub}`.toLowerCase())
      }
    }

    // A resource matches if (a) one of its rating's barrier_scores keys hits
    // the match set, OR (b) its name/description text contains a match key.
    const { data: barrierRatings } = await supabase
      .from('ratings')
      .select('resource_id, barrier_scores')
      .in('resource_id', resourceIds)
      .not('barrier_scores', 'is', null)

    const matchedByRatings = new Set<string>()
    barrierRatings?.forEach((rating) => {
      if (!rating.barrier_scores) return
      const scores = rating.barrier_scores as { [key: string]: number }
      const lowerKeys = Object.keys(scores).map((k) => k.toLowerCase())
      if (lowerKeys.some((k) => matchKeys.has(k))) {
        matchedByRatings.add(rating.resource_id)
      }
    })

    resources = resources.filter((r) => {
      if (matchedByRatings.has(r.id)) return true
      const haystack = `${r.name || ''} ${r.description || ''} ${r.category || ''}`.toLowerCase()
      for (const key of matchKeys) {
        if (haystack.includes(key.replace(/_/g, ' '))) return true
        if (haystack.includes(key)) return true
      }
      return false
    })
    resourceIds = resources.map((r) => r.id)
  }

  // Resolve effective minimum rating: explicit minRating wins, else the
  // lowest selected rating-star bucket.
  const effectiveMinRating =
    filters.minRating ??
    (filters.ratingStars && filters.ratingStars.length > 0
      ? Math.min(...filters.ratingStars)
      : undefined)

  // Filter by minimum rating
  let filteredResources = resources.filter((resource) => {
    const ratings = ratingMap.get(resource.id)
    if (!ratings) {
      return !effectiveMinRating || effectiveMinRating <= 1 // Include unrated if min is 1 or less
    }
    return !effectiveMinRating || ratings.averageRating >= effectiveMinRating
  })

  // Filter by price range. NULL price (free / unspecified) is always shown
  // when no minPrice is set; if minPrice > 0, NULL prices are excluded.
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    filteredResources = filteredResources.filter((resource) => {
      const price = (resource as any).price as number | null | undefined
      if (price === null || price === undefined) {
        // Unpriced resource: only include when there's no min restriction (or min is 0)
        return !filters.minPrice || filters.minPrice <= 0
      }
      if (filters.minPrice !== undefined && price < filters.minPrice) return false
      if (filters.maxPrice !== undefined && price > filters.maxPrice) return false
      return true
    })
  }

  // Calculate distances if user location provided
  if (filters.userLocation) {
    filteredResources = filteredResources
      .map((resource) => {
        const location = resource.location as Location | null
        if (location?.lat && location?.lng) {
          const distance = calculateDistance(
            filters.userLocation!.lat,
            filters.userLocation!.lng,
            location.lat,
            location.lng
          )
          return { ...resource, distance }
        }
        return { ...resource, distance: undefined }
      })
      .filter((resource) => {
        // Filter by max distance if specified
        if (filters.maxDistance && resource.distance !== undefined) {
          return resource.distance <= filters.maxDistance
        }
        return true
      })
  }

  // Add rating data to resources
  let results: SearchResult[] = filteredResources.map((resource) => {
    const ratings = ratingMap.get(resource.id)
    return {
      ...resource,
      averageRating: ratings?.averageRating || 0,
      ratingCount: ratings?.ratingCount || 0,
      distance: (resource as any).distance,
    }
  })

  // Sort results — supports either a single SortOption (legacy) or an ordered
  // list of SortRule. Multi-rule sort applies rules as a stable comparator:
  // first rule wins; ties fall through to the next rule.
  const sortRules: SortRule[] = Array.isArray(sort)
    ? sort
    : [{ key: sort, direction: sort === 'cost' ? 'asc' : 'desc' }]

  const compareByRule = (a: SearchResult, b: SearchResult, rule: SortRule): number => {
    const factor = rule.direction === 'asc' ? 1 : -1
    switch (rule.key) {
      case 'cost': {
        const aPrice = (a as any).price as number | null | undefined
        const bPrice = (b as any).price as number | null | undefined
        // Push null prices to the end regardless of direction.
        if (aPrice === null || aPrice === undefined) return 1
        if (bPrice === null || bPrice === undefined) return -1
        return (aPrice - bPrice) * factor
      }
      case 'rating': {
        if (a.averageRating === b.averageRating) {
          // Tie-break by review volume (always more = better).
          return b.ratingCount - a.ratingCount
        }
        return (a.averageRating - b.averageRating) * factor
      }
      case 'reviews': {
        return (a.ratingCount - b.ratingCount) * factor
      }
      case 'distance': {
        const distA = a.distance ?? Infinity
        const distB = b.distance ?? Infinity
        // Ascending = closest first.
        return (distA - distB) * (rule.direction === 'desc' ? -1 : 1)
      }
      case 'newest': {
        return (
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
          (rule.direction === 'asc' ? 1 : -1)
        )
      }
      case 'relevance':
      default: {
        // Relevance scoring: name match > description match > rating > reviews.
        let aScore = 0
        let bScore = 0
        if (filters.query) {
          const q = filters.query.toLowerCase()
          aScore += a.name.toLowerCase().includes(q) ? 10 : 0
          bScore += b.name.toLowerCase().includes(q) ? 10 : 0
          aScore += a.description?.toLowerCase().includes(q) ? 5 : 0
          bScore += b.description?.toLowerCase().includes(q) ? 5 : 0
        }
        aScore += a.averageRating
        bScore += b.averageRating
        if (aScore !== bScore) return (aScore - bScore) * (rule.direction === 'asc' ? 1 : -1)
        return b.ratingCount - a.ratingCount
      }
    }
  }

  results.sort((a, b) => {
    for (const rule of sortRules) {
      const cmp = compareByRule(a, b, rule)
      if (cmp !== 0) return cmp
    }
    return 0
  })

  // Apply pagination
  const total = results.length
  const paginatedResults = results.slice(offset, offset + pageSize)

  return {
    results: paginatedResults,
    total,
    page,
    pageSize,
  }
}

/**
 * Get all unique categories from approved resources
 */
export async function getResourceCategories(): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('category')
    .eq('status', 'approved')

  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  if (!data) return []

  // Get unique categories
  const categories = [...new Set(data.map((r) => r.category))]
  return categories.sort()
}

/**
 * Get search suggestions based on common queries
 */
export async function getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
  if (!query || query.length < 2) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('name, category')
    .eq('status', 'approved')
    .or(`name.ilike.%${query}%,category.ilike.%${query}%`)
    .limit(limit * 2) // Get more to filter unique

  if (error) {
    console.error('Error fetching search suggestions:', error)
    return []
  }

  if (!data) return []

  // Extract unique suggestions from name and category
  const suggestions = new Set<string>()
  for (const resource of data) {
    if (resource.name.toLowerCase().includes(query.toLowerCase())) {
      suggestions.add(resource.name)
    }
    if (resource.category.toLowerCase().includes(query.toLowerCase())) {
      suggestions.add(resource.category)
    }
    if (suggestions.size >= limit) break
  }

  return Array.from(suggestions).slice(0, limit)
}
