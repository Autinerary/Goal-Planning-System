import { searchResources, ratingCountsForNorm, type SearchFilters } from '@/lib/supabase/queries'
import { searchProducts } from '@/lib/search/products'
import { findNeed, findNorm, isOtherNorm } from './setup'

/**
 * Places matched to someone's topic and what they hope to find: the "first
 * personalized resource" at the end of setup, and "For you" on the home page
 * (Riipen Labs, Group 8: "what they're asked to share would more clearly and
 * visibly connect to what they receive").
 *
 * Each place says why it is there, in words its data supports: rated for the
 * topic (a rating scored it for that norm), mentions the topic, or simply the
 * kind of place asked for. Near the person first when they have a location.
 */

export type MatchReason = 'rated_for_topic' | 'mentions_topic' | 'need' | 'starter'

export interface MatchedPlace {
  id: string
  kind: 'place' | 'product'
  name: string
  description: string | null
  category: string
  city: string | null
  province: string | null
  /** km from the person, when both have a location. */
  distance?: number
  averageRating: number
  ratingCount: number
  imageUrl: string | null
  reason: MatchReason
  /** The need it answers (lib/onboarding/setup.ts). */
  needId?: string
  /** Ratings that scored it for the topic. */
  topicRatings?: number
}

// When nothing else matches: real support organisations, including autism
// and ADHD ones, the same starting point as Goal Planning's "Not sure yet".
const STARTER: Partial<SearchFilters> = { categories: ['Support Group'] }

const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)

export async function matchedPlaces(opts: {
  topic?: string | null
  needs: string[]
  userLocation?: { lat: number; lng: number; province?: string }
  limit?: number
}): Promise<MatchedPlace[]> {
  const limit = opts.limit ?? 3
  // A topic to match on: a known norm with a key ratings use. "Other
  // (specify)" is saved, but matches nothing.
  const topic = opts.topic && findNorm(opts.topic) && !isOtherNorm(opts.topic) ? opts.topic : null
  const needs = opts.needs.map(findNeed).filter((n): n is NonNullable<typeof n> => Boolean(n))
  const placeSearches = needs.flatMap((n) => (n.shop ? [] : n.searches.map((s) => ({ need: n.id, s }))))

  const out: MatchedPlace[] = []
  const seen = new Set<string>()
  // `upTo`: stop once the list is this long.
  const add = (rows: any[], reason: MatchReason, needId?: string, kind: 'place' | 'product' = 'place', upTo = limit) => {
    for (const r of rows) {
      if (out.length >= Math.min(upTo, limit)) return
      if (!r?.id || seen.has(r.id)) continue
      seen.add(r.id)
      const loc = (r.location || {}) as Record<string, any>
      out.push({
        id: r.id,
        kind,
        name: r.name,
        description: r.description || null,
        category: r.category || '',
        city: typeof loc.city === 'string' && loc.city.trim() ? loc.city.trim() : null,
        province: typeof loc.province === 'string' && loc.province.trim() ? loc.province.trim() : null,
        distance: typeof r.distance === 'number' ? r.distance : undefined,
        averageRating: Number(r.averageRating) || 0,
        ratingCount: Number(r.ratingCount) || 0,
        imageUrl: (kind === 'product' ? r.image_urls?.[0] : r.image_url) || null,
        reason,
        needId,
      })
    }
  }

  // With a location, the default order is near first; without, best rated.
  const find = async (filters: Partial<SearchFilters>) => {
    const { results } = await searchResources(
      { ...filters, userLocation: opts.userLocation, status: 'approved' },
      opts.userLocation ? 'relevance' : 'rating',
      1,
      limit
    )
    return results
  }
  const filtersFor = (s: Record<string, string>): Partial<SearchFilters> => ({
    categories: list(s.categories),
    lifeAreas: list(s.lifeAreas),
  })

  try {
    if (topic) {
      for (const { need, s } of placeSearches) add(await find({ ...filtersFor(s), barriers: [topic] }), 'rated_for_topic', need)
      for (const { need, s } of placeSearches) add(await find({ ...filtersFor(s), conditions: [topic] }), 'mentions_topic', need)
      // The topic is the strongest signal: places for it of any kind (for
      // ADHD, the ADHD organisations) fill up to half the list when a kind
      // of place was also chosen, and all of it otherwise.
      const upTo = needs.length > 0 ? Math.ceil(limit / 2) : limit
      add(await find({ barriers: [topic] }), 'rated_for_topic', undefined, 'place', upTo)
      add(await find({ conditions: [topic] }), 'mentions_topic', undefined, 'place', upTo)
    }
    for (const { need, s } of placeSearches) add(await find(filtersFor(s)), 'need', need)
    for (const n of needs.filter((n) => n.shop)) {
      add(await searchProducts({ categories: n.shop }, limit), 'need', n.id, 'product')
    }
    if (out.length === 0) add(await find(STARTER), 'starter')

    if (topic) {
      const counts = await ratingCountsForNorm(out.filter((p) => p.kind === 'place').map((p) => p.id), topic)
      for (const p of out) {
        const n = counts.get(p.id)
        if (n) p.topicRatings = n
      }
    }
  } catch (error) {
    console.error('[matchedPlaces] failed:', error)
  }
  return out
}
