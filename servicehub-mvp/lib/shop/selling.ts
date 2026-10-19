import { createAdminClient } from '@/lib/supabase/admin'
import type { Product } from '@/types/shop'

/**
 * Buying through ResourceHub (the products round's planning note, Goal 9:
 * "Online Purchase System"). Off until the team turns it on
 * (NEXT_PUBLIC_SHOP_CHECKOUT=on, with Stripe Connect set up). A product can
 * be bought here only when a vendor sells it through ResourceHub
 * (vendor_user_id), their Stripe account can take payments, it has a price,
 * and it is in stock. Everything else lists where to get it.
 */
export const CHECKOUT_ON = process.env.NEXT_PUBLIC_SHOP_CHECKOUT === 'on'

export async function canBuyHere(product: Pick<Product, 'vendor_user_id' | 'price' | 'stock' | 'status'>): Promise<boolean> {
  if (!CHECKOUT_ON || !product.vendor_user_id || product.price == null || product.price <= 0 || product.status !== 'active') return false
  if (product.stock != null && product.stock <= 0) return false
  const { data } = await createAdminClient().from('vendor_payment_accounts').select('charges_enabled').eq('user_id', product.vendor_user_id).maybeSingle()
  return Boolean(data?.charges_enabled)
}
