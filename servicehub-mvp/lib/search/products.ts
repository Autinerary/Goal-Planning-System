import { createClient } from '@/lib/supabase/server'

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

export async function searchProducts(filters: ProductSearchFilters = {}, limit = 24) {
  const supabase = createClient()
  let q = supabase
    .from('products')
    .select('id, name, description, category, price, currency, image_urls, created_at')
    .eq('status', 'active')

  if (filters.query && filters.query.trim()) {
    const term = filters.query.trim()
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
  }
  if (filters.categories && filters.categories.length > 0) {
    q = q.in('category', filters.categories)
  }
  if (typeof filters.minPrice === 'number') q = q.gte('price', filters.minPrice)
  if (typeof filters.maxPrice === 'number') q = q.lte('price', filters.maxPrice)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) {
    // The products table may not exist yet (migration not run). Never let that
    // break resource search.
    console.warn('[search] products unavailable:', error.message)
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
      // Marks this as a Shop item so the card links to /shop/<id>.
      kind: 'product' as const,
    }
  })
}
