import { createClient } from '@/lib/supabase/server'

/**
 * Discounts (the products round's planning note, Goal 10: "a discount
 * system... for product launch, for norm days/periods (ex. Autism Awareness
 * Month), and/or for back-to-school"). A vendor opts a product in to a
 * discount event, or sets its own dates; STEP 82's product_discounts. Shown
 * only when the team turns discounts on (NEXT_PUBLIC_SHOP_DISCOUNTS=on), and
 * only during their dates.
 */
export const DISCOUNTS_ON = process.env.NEXT_PUBLIC_SHOP_DISCOUNTS === 'on'

export interface ActiveDiscount {
  percent: number | null
  salePrice: number | null
  code: string | null
  event: string | null
  ends: string
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })

/** The discounts running today, by product (empty when discounts are off, or before STEP 82). */
export async function activeDiscounts(productIds: string[]): Promise<Map<string, ActiveDiscount>> {
  const out = new Map<string, ActiveDiscount>()
  if (!DISCOUNTS_ON || !productIds.length) return out
  const supabase = createClient()
  const { data, error } = await supabase
    .from('product_discounts')
    .select('product_id, percent, sale_price, code, starts_on, ends_on, opted_in, discount_events(name, starts_on, ends_on)')
    .eq('opted_in', true)
    .in('product_id', productIds.slice(0, 300))
  if (error) return out
  const now = today()
  for (const d of (data || []) as any[]) {
    const starts = d.discount_events?.starts_on || d.starts_on
    const ends = d.discount_events?.ends_on || d.ends_on
    if (!starts || !ends || starts > now || ends < now) continue
    out.set(d.product_id, { percent: d.percent, salePrice: d.sale_price == null ? null : Number(d.sale_price), code: d.code, event: d.discount_events?.name || null, ends })
  }
  return out
}

export function discountedPrice(price: number | null, d: ActiveDiscount | undefined): number | null {
  if (price == null || !d) return null
  if (d.salePrice != null && d.salePrice < price) return d.salePrice
  if (d.percent) return Math.round(price * (100 - d.percent)) / 100
  return null
}

export const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { day: 'numeric', month: 'long' })
