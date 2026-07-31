import { createClient } from '@/lib/supabase/server'
import type { Product, ProductReview } from '@/types/shop'

/** Attach rating_avg / rating_count to a set of products (one round-trip). */
async function withRatings(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products
  const supabase = createClient()
  const ids = products.map((p) => p.id)
  const { data } = await supabase
    .from('product_reviews')
    .select('product_id, rating')
    .in('product_id', ids)

  const agg = new Map<string, { sum: number; count: number }>()
  for (const r of data || []) {
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

export interface ProductFilters {
  category?: string
  query?: string
}

/** Active products for the Shop, newest first. Real data only — empty is empty. */
export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const supabase = createClient()
  let q = supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (filters.category) q = q.eq('category', filters.category)
  if (filters.query && filters.query.trim()) {
    const term = filters.query.trim()
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error listing products:', error.message)
    return []
  }
  return withRatings((data as Product[]) || [])
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

export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  return (data as ProductReview[]) || []
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
