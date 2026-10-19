/**
 * Selling through ResourceHub (the products round's planning note, Goals 9
 * and 10), on the vendor's side, in the app's Resource Accounts. Off until
 * the team turns it on (NEXT_PUBLIC_SHOP_CHECKOUT=on, in both apps, with
 * Stripe Connect set up). Plain data, safe on both sides.
 */
export const SHOP_CHECKOUT_ON = process.env.NEXT_PUBLIC_SHOP_CHECKOUT === 'on'

export const ORDER_STATUS: Record<string, string> = {
  processing: 'Paid: ship it',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled and refunded',
  returned: 'Returned',
}
