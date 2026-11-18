import { createClient } from '@/lib/supabase/server'
import type { Product, ProductReview } from '@/types/shop'
import { SHOP_CATEGORIES, canonicalCategory, expandShopFilter } from '@/lib/shop/categories'
import { tasteScore } from '@/lib/shop/taste'
import { loadRaterContext, withHiddenRaterFields } from '@/lib/ratings/raterContext'
import { heldForReview } from '@/lib/moderation/queue'

/** Attach rating_avg / rating_count to a set of products (one round-trip). */
async function withRatings(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products
  const supabase = createClient()
  const ids = products.map((p) => p.id)
  const [{ data }, held] = await Promise.all([
    supabase.from('product_reviews').select('id, product_id, rating').in('product_id', ids),
    // A flagged review waits for a moderator before it counts.
    heldForReview('product_review'),
  ])

  const agg = new Map<string, { sum: number; count: number }>()
  for (const r of data || []) {
    if (held.has(r.id)) continue
    const cur = agg.get(r.product_id) || { sum: 0, count: 0 }
    cur.sum += r.rating
    cur.count += 1
    agg.set(r.product_id, cur)
  }
  return products.map((p) => {
    const a = agg.get(p.id)
    return {
      ...p,
      rating_avg: a && a.count ? a.sum / a.count : 0,
      rating_count: a?.count ?? 0,
    }
  })
}

export type ProductSort = 'category' | 'for_you' | 'rating' | 'price_asc' | 'price_desc' | 'newest' | 'name'

export interface ProductFilters {
  /** A group (books) or one of the 40 categories (books-memoir); older ids work too. */
  group?: string
  category?: string
  query?: string
  /** Every one of these qualities (lib/shop/qualities.ts). */
  qualities?: string[]
  sort?: ProductSort
  /** For 'for_you': what the person likes and avoids (lib/shop/taste.ts). */
  likes?: string[]
  avoids?: string[]
}

const CATEGORY_ORDER = new Map(SHOP_CATEGORIES.map((c, i) => [c.id, i]))

/** Active products for the Shop. Real data only: empty is empty. */
export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const supabase = createClient()
  const term = (filters.query || '').trim().replace(/[%,()]/g, ' ').slice(0, 80)
  const build = (step82: boolean) => {
    let q = supabase.from('products').select('*').eq('status', 'active')
    const cats = filters.category ? expandShopFilter([filters.category]) : filters.group ? expandShopFilter([filters.group]) : []
    if (filters.category || filters.group) q = q.in('category', cats.length ? cats : ['-'])
    if (step82 && filters.qualities?.length) q = q.contains('qualities', filters.qualities)
    if (term) q = q.or(step82 ? `name.ilike.%${term}%,description.ilike.%${term}%,brand.ilike.%${term}%` : `name.ilike.%${term}%,description.ilike.%${term}%`)
    return q.order('created_at', { ascending: false }).limit(500)
  }
  let { data, error } = await build(true)
  // Before STEP 82 there is no qualities or brand column. Nothing has
  // qualities yet, so a quality filter matches nothing; a search still
  // looks in names and descriptions.
  if (error && /qualities|brand/.test(error.message || '')) {
    if (filters.qualities?.length) return []
    ;({ data, error } = await build(false))
  }
  if (error) {
    console.error('Error listing products:', error.message)
    return []
  }
  const rows = await withRatings((data as Product[]) || [])
  const price = (p: Product) => (p.price == null ? Number.POSITIVE_INFINITY : Number(p.price))
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name)
  switch (filters.sort || 'category') {
    case 'for_you':
      return rows.sort((a, b) => tasteScore(b.qualities, filters.likes || [], filters.avoids || []) - tasteScore(a.qualities, filters.likes || [], filters.avoids || []) || (b.rating_avg || 0) - (a.rating_avg || 0) || byName(a, b))
    case 'rating':
      return rows.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || (b.rating_count || 0) - (a.rating_count || 0) || byName(a, b))
    case 'price_asc':
      return rows.sort((a, b) => price(a) - price(b) || byName(a, b))
    case 'price_desc':
      return rows.sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || byName(a, b))
    case 'newest':
      return rows
    case 'name':
      return rows.sort(byName)
    default:
      return rows.sort(
        (a, b) =>
          (CATEGORY_ORDER.get(canonicalCategory(a.category)) ?? 999) - (CATEGORY_ORDER.get(canonicalCategory(b.category)) ?? 999) ||
          (b.rating_avg || 0) - (a.rating_avg || 0) ||
          byName(a, b)
      )
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  const [withR] = await withRatings([data as Product])
  return withR
}

// What a product review may show: never `select('*')`, since the rater_*
// snapshot (the reviewer's norms, relationships and groups) is private (bug
// audit, 17 November 2026, item 2).
const PRODUCT_REVIEW_COLUMNS = 'id, product_id, user_id, rating, comment, barrier_scores, helpful_count, created_at'
const PRODUCT_REVIEW_BASE = 'id, product_id, user_id, rating, comment, created_at'

/**
 * A product's reviews, newest first, for the product page (server only).
 * Each carries the reviewer's snapshot for the breakdowns (lib/shop/
 * breakdown.ts, lib/shop/patterns.ts) as hidden properties, read with the
 * admin client: they are not enumerable, so they stay on the server even if
 * the list is passed to a client component. A review flagged by the
 * moderation check is left out until a moderator has looked at it.
 */
export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  const supabase = createClient()
  const read = (columns: string) =>
    supabase.from('product_reviews').select(columns).eq('product_id', productId).order('created_at', { ascending: false })
  let { data, error } = await read(PRODUCT_REVIEW_COLUMNS)
  // Before the products round's columns (barrier_scores, helpful_count).
  if (error && (error.code === '42703' || /barrier_scores|helpful_count/.test(error.message || ''))) ({ data, error } = await read(PRODUCT_REVIEW_BASE))
  if (error) {
    console.error('Error fetching product reviews:', error.message)
    return []
  }
  const rows = (data || []) as unknown as ProductReview[]
  if (rows.length === 0) return rows
  const held = await heldForReview('product_review', rows.map((r) => r.id))
  const visible = rows.filter((r) => !held.has(r.id))
  const context = await loadRaterContext('product_reviews', visible.map((r) => r.id))
  return withHiddenRaterFields(visible, context)
}

/** Distinct categories that actually have active products (for the Shop filter). */
export async function listProductCategories(): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('category')
    .eq('status', 'active')
  const set = new Set<string>()
  for (const r of data || []) if (r.category) set.add(r.category)
  return Array.from(set).sort()
}
