import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalRow, RatingAgg } from '@/lib/moreTools'

/**
 * ResourceHub's listings and ratings, read at most every ten minutes and
 * shared (server only): the same pool the plan's own picks come from (the
 * services checked on their own sites, and everything people have rated).
 * "Recommend more" (app/api/me/path/tools) and the services near the person
 * for a step (app/api/me/path/services) draw from it. Each row carries what
 * Send my request needs (its contact details, where it is).
 */
let cache: { at: number; pool: LocalRow[]; ratings: Map<string, RatingAgg> } | null = null

export async function hubPool(admin: SupabaseClient): Promise<{ pool: LocalRow[]; ratings: Map<string, RatingAgg> }> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache
  const ratings = new Map<string, RatingAgg>()
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin.from('ratings').select('resource_id, overall_score, barrier_scores').range(from, from + 999)
    if (error) break
    for (const r of data || []) {
      if (!r.resource_id) continue
      const agg = ratings.get(r.resource_id) || { sum: 0, count: 0, norms: {} }
      if (typeof r.overall_score === 'number') {
        agg.sum += r.overall_score
        agg.count += 1
      }
      for (const key of Object.keys((r.barrier_scores as Record<string, unknown>) || {})) agg.norms[key] = (agg.norms[key] || 0) + 1
      ratings.set(r.resource_id, agg)
    }
    if ((data || []).length < 1000) break
  }
  const cols = 'id, name, description, category, tags, cost_type, price, contact_info, is_first_party, location, geo_lat, geo_lng, status, source_url, source_type'
  const { data: checked } = await admin.from('resources').select(cols).eq('status', 'approved').eq('source_type', 'operator').limit(3000)
  const have = new Set((checked || []).map((r: any) => r.id))
  const ratedIds = Array.from(ratings.keys()).filter((id) => !have.has(id))
  const rated: any[] = []
  for (let i = 0; i < ratedIds.length; i += 100) {
    const { data } = await admin.from('resources').select(cols).eq('status', 'approved').in('id', ratedIds.slice(i, i + 100))
    rated.push(...(data || []))
  }
  const pool: LocalRow[] = [...(checked || []), ...rated].map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    tags: Array.isArray(r.tags) ? r.tags : [],
    cost_type: r.cost_type ?? null,
    price: r.price ?? null,
    website: r.contact_info?.website || null,
    is_first_party: r.is_first_party ?? null,
    contact_info: r.contact_info ?? null,
    location: r.location ?? null,
    geo_lat: r.geo_lat ?? null,
    geo_lng: r.geo_lng ?? null,
    status: r.status ?? null,
    source_url: r.source_url ?? null,
    source_type: r.source_type ?? null,
  }))
  cache = { at: Date.now(), pool, ratings }
  return cache
}
