import { createClient } from '@/lib/supabase/server'
import { sharedCache, cacheKey } from '@/lib/cache/shared'
import { searchWords, inNameDescriptionOrCategory } from '@/lib/search/words'
import { expandShopFilter } from '@/lib/shop/categories'

/**
 * Products in general search (Odosa: "the store was added separately; the items
 * in the store should also be able to be seen in the general results page").
 *
 * Products are shaped to look like resources so they can share the result card,
 * with `kind: 'product'` so the card links to /shop/<id> instead of
 * /resources/<id>.
 *
 * Norm/condition/life-area filters are service-specific — the catalog has no
 * such tagging — so callers skip products when those are active rather than
 * returning matches that ignore the filter.
 */
export interface ProductSearchFilters {
  query?: string
  categories?: string[]
  minPrice?: number
  maxPrice?: number
}

// Products are public and the same for everyone, so a search's matches are
// shared for a minute (lib/cache/shared.ts).
const productCache = sharedCache<any[]>({ ttlMs: 60_000, maxEntries: 100 })

export async function searchProducts(filters: ProductSearchFilters = {}, limit = 24) {
  const rows = await productCache(cacheKey([filters, limit]), (dontKeep) => findProducts(filters, limit, dontKeep))
  // Copies: the cached rows are shared between requests.
  return rows.map((row) => ({ ...row }))
}

const PRODUCT_COLUMNS = 'id, name, description, category, price, currency, image_urls, created_at'
// STEP 82's columns, when it is in.
const PRODUCT_COLUMNS_82 = `${PRODUCT_COLUMNS}, tags, brand, qualities, price_note`

async function findProducts(filters: ProductSearchFilters, limit: number, dontKeep: () => void) {
  // A group (Books) or a category (Memoirs) stands for every category in it,
  // the older ones too; a search filtered only by kinds of service has no
  // products.
  if (filters.categories && filters.categories.length > 0) {
    const shop = expandShopFilter(filters.categories)
    if (!shop.length) return []
    filters = { ...filters, categories: shop }
  }
  // STEP 82's columns, then STEP 79's tags, then the oldest.
  const newest = await queryProducts(filters, limit, PRODUCT_COLUMNS_82)
  if (!newest.error) return rowsOf(newest, dontKeep)
  const first = await queryProducts(filters, limit, `${PRODUCT_COLUMNS}, tags`)
  return first.error && /tags/.test(first.error.message || '')
    ? rowsOf(await queryProducts(filters, limit, PRODUCT_COLUMNS), dontKeep)
    : rowsOf(first, dontKeep)
}

async function queryProducts(filters: ProductSearchFilters, limit: number, columns: string) {
  const supabase = createClient()
  let q = supabase
    .from('products')
    .select(columns)
    .eq('status', 'active')

  // Every word somewhere in the name, description or category, as in venue
  // search (lib/search/words.ts).
  for (const word of searchWords(filters.query)) {
    q = q.or(inNameDescriptionOrCategory([word]))
  }
  if (filters.categories && filters.categories.length > 0) {
    q = q.in('category', filters.categories)
  }
  if (typeof filters.minPrice === 'number') q = q.gte('price', filters.minPrice)
  if (typeof filters.maxPrice === 'number') q = q.lte('price', filters.maxPrice)

  return q.order('created_at', { ascending: false }).limit(limit)
}

async function rowsOf({ data, error }: { data: any[] | null; error: { message?: string } | null }, dontKeep: () => void) {
  const supabase = createClient()
  if (error) {
    // The products table may not exist yet (migration not run). Never let that
    // break resource search.
    console.warn('[search] products unavailable:', error.message)
    dontKeep()
    return []
  }

  const rows = data || []
  if (rows.length === 0) return []

  // Average rating per product, so cards show stars like services do.
  const ids = rows.map((r: any) => r.id)
  const { data: reviews } = await supabase
    .from('product_reviews')
    .select('product_id, rating')
    .in('product_id', ids)

  const agg = new Map<string, { sum: number; count: number }>()
  for (const rv of reviews || []) {
    const cur = agg.get(rv.product_id) || { sum: 0, count: 0 }
    cur.sum += rv.rating
    cur.count += 1
    agg.set(rv.product_id, cur)
  }

  return rows.map((p: any) => {
    const a = agg.get(p.id)
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      // Share the resource card's image field.
      image_url: Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls[0] : null,
      location: null,
      contact_info: null,
      status: 'approved',
      created_at: p.created_at,
      updated_at: p.created_at,
      averageRating: a && a.count ? a.sum / a.count : 0,
      ratingCount: a?.count ?? 0,
      tags: Array.isArray(p.tags) ? p.tags : [],
      // Marks this as a Shop item so the card links to /shop/<id>.
      kind: 'product' as const,
    }
  })
}
