import { createClient } from '@/lib/supabase/server'
import { searchProducts } from './products'

/**
 * Search across every kind of thing ResourceHub holds (Odosa).
 *
 * Three sources that were previously only reachable from three separate tabs:
 *   service — public.resources        (a place or person you go to)
 *   product — public.products         (something you buy)
 *   post    — public.community_posts  (something someone wrote)
 *
 * They stay DISTINCT rather than being flattened into one list of "results".
 * A therapist, a weighted blanket and a question about masking are not
 * interchangeable, and a single ranked list would imply they were. Each result
 * carries `kind`, and the page groups by it.
 */

export type ResultKind = 'service' | 'product' | 'post'

export interface UniversalResult {
  kind: ResultKind
  id: string
  title: string
  description: string
  href: string
  category?: string
  /** Services and products only. */
  rating?: number | null
  ratingCount?: number
  price?: number | null
  location?: string | null
  /** Posts only. */
  answerCount?: number
  isSolved?: boolean
}

export interface UniversalResults {
  services: UniversalResult[]
  products: UniversalResult[]
  posts: UniversalResult[]
  total: number
}

const EMPTY: UniversalResults = { services: [], products: [], posts: [], total: 0 }

export async function universalSearch(
  query: string,
  perKind = 12
): Promise<UniversalResults> {
  const term = (query || '').trim()
  if (!term) return EMPTY

  const supabase = createClient()
  const like = `%${term}%`

  // All three in parallel — one slow source should not hold up the others.
  // Each is caught individually so a single failure degrades that section
  // rather than emptying the whole page.
  // Each source is wrapped so a single failure degrades that one section
  // instead of emptying the page. Supabase's builder is a PromiseLike, not a
  // Promise, so it has no .catch() — the try/catch has to be explicit.
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn()
    } catch (e) {
      console.error('[universalSearch] source failed:', e)
      return fallback
    }
  }

  const [services, products, posts] = await Promise.all([
    safe(async () => {
      const { data } = await supabase
        .from('resources')
        .select('id, name, description, category, location')
        .eq('status', 'approved')
        .or(`name.ilike.${like},description.ilike.${like}`)
        .limit(perKind)
      return data || []
    }, [] as any[]),

    safe(async () => (await searchProducts({ query: term })).slice(0, perKind), [] as any[]),

    safe(async () => {
      const { data } = await supabase
        .from('community_posts')
        .select('id, title, body_markdown, answer_count, accepted_answer_id, barrier_tags')
        .eq('is_deleted', false)
        .or(`title.ilike.${like},body_markdown.ilike.${like}`)
        .order('last_activity_at', { ascending: false })
        .limit(perKind)
      return data || []
    }, [] as any[]),
  ])

  // Ratings for the services in one round-trip rather than one query each.
  let ratingByResource = new Map<string, { avg: number; count: number }>()
  if (services.length > 0) {
    try {
      const { data } = await supabase
        .from('ratings')
        .select('resource_id, overall_score')
        .in('resource_id', services.map((s: any) => s.id))
      const agg = new Map<string, { sum: number; count: number }>()
      for (const r of data || []) {
        const cur = agg.get(r.resource_id) || { sum: 0, count: 0 }
        cur.sum += Number(r.overall_score) || 0
        cur.count += 1
        agg.set(r.resource_id, cur)
      }
      ratingByResource = new Map(
        Array.from(agg.entries()).map(([k, v]) => [k, { avg: v.sum / v.count, count: v.count }])
      )
    } catch {
      /* ratings are decoration here — a failure must not hide the services */
    }
  }

  const serviceResults: UniversalResult[] = services.map((s: any) => {
    const r = ratingByResource.get(s.id)
    return {
      kind: 'service',
      id: s.id,
      title: s.name,
      description: s.description || '',
      href: `/resources/${s.id}`,
      category: s.category,
      rating: r ? r.avg : null,
      ratingCount: r?.count ?? 0,
      location: s.location?.city || null,
    }
  })

  const productResults: UniversalResult[] = products.map((p: any) => ({
    kind: 'product',
    id: p.id,
    title: p.name,
    description: p.description || '',
    href: `/shop/${p.id}`,
    category: p.category,
    rating: p.averageRating || null,
    ratingCount: p.ratingCount ?? 0,
    price: p.price ?? null,
  }))

  const postResults: UniversalResult[] = posts.map((p: any) => ({
    kind: 'post',
    id: p.id,
    title: p.title,
    // Markdown stripped just enough to read as a plain excerpt.
    description: String(p.body_markdown || '')
      .replace(/[#*_`>\[\]]/g, '')
      .slice(0, 200),
    href: `/community/post/${p.id}`,
    category: Array.isArray(p.barrier_tags) ? p.barrier_tags[0] : undefined,
    answerCount: p.answer_count ?? 0,
    isSolved: p.accepted_answer_id != null,
  }))

  return {
    services: serviceResults,
    products: productResults,
    posts: postResults,
    total: serviceResults.length + productResults.length + postResults.length,
  }
}
