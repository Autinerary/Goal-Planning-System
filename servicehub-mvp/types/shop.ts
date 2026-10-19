import taxonomy from '@/lib/shop/taxonomy.json'

/**
 * Shop types — a real products catalog + commerce flow (Odosa).
 * Backed by the tables in scripts/2026_shop_products.sql.
 */

/** A named variation axis, e.g. { name: 'Size', options: ['S','M','L'] }. */
export interface ProductVariation {
  name: string
  options: string[]
}

/** Free-form sensory attributes shown on the product detail (from the mockup). */
export interface SensoryDetails {
  texture?: string
  sound?: string
  visual?: string
  material?: string
  [key: string]: string | undefined
}

export type ProductStatus = 'draft' | 'pending' | 'active' | 'archived' | 'rejected'

/** Where to get a product (STEP 82): the maker, a Canadian store, an app store, where to watch. */
export interface BuyLink {
  label: string
  url: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  category: string
  /** null: the price varies (books, films, food sold in many stores); price_note says why. */
  price: number | null
  compare_at_price: number | null
  currency: string
  image_urls: string[]
  variations: ProductVariation[]
  sensory_details: SensoryDetails
  stock: number | null
  seller: string | null
  status: ProductStatus
  submitted_by: string | null
  created_at: string
  updated_at: string
  /** STEP 82: the maker, its qualities (lib/shop/qualities.ts) and their values, where to get it, and where people recommend it. */
  brand?: string | null
  qualities?: string[]
  quality_values?: Record<string, string>
  buy_links?: BuyLink[]
  community_links?: BuyLink[]
  maker_url?: string | null
  price_note?: string | null
  tags?: string[]
  vendor_user_id?: string | null
  last_verified_at?: string | null
  /** Denormalized on read for cards/detail. */
  rating_avg?: number
  rating_count?: number
}

/** Selected variation on a cart line, e.g. { Size: 'M', Color: 'Black' }. */
export type SelectedVariation = Record<string, string>

export interface CartItem {
  id: string
  user_id: string
  product_id: string
  variation: SelectedVariation
  quantity: number
  added_at: string
  product?: Product
}

export type OrderStatus =
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  name: string
  price: number
  image_url: string | null
  variation: SelectedVariation
  quantity: number
}

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  subtotal: number
  taxes: number
  delivery: number
  total: number
  currency: string
  shipping_address: Record<string, any> | null
  payment_method: string | null
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

export interface ProductReview {
  id: string
  product_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
}

/** The 40 categories' ids (lib/shop/taxonomy.json), for checking a submitted product. */
export const PRODUCT_CATEGORIES: string[] = taxonomy.categories.map((c) => c.id)

/** Format a money amount the way the mockups do, e.g. "CA $34.00". null is "Price varies". */
export function formatPrice(amount: number | null | undefined, currency = 'CAD'): string {
  if (amount == null) return 'Price varies'
  if (amount === 0) return 'Free'
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}
