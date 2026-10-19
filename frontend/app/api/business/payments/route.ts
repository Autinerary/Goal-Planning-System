import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripeClient } from '@/lib/stripe'
import { SHOP_CHECKOUT_ON } from '@/lib/shopSelling'

export const dynamic = 'force-dynamic'

/**
 * GET  /api/business/payments  whether the vendor's Stripe account can take payments (read fresh from Stripe)
 * POST /api/business/payments  Stripe's page to set it up (Connect Express, Canada)
 *
 * The products round, Goals 9 and 10: vendors are paid directly, through
 * their own Stripe account; ResourceHub takes its fee from each sale.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const admin = createAdminClient()
  const { data: row } = await admin.from('vendor_payment_accounts').select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted').eq('user_id', user.id).maybeSingle()
  const stripe = stripeClient()
  if (!SHOP_CHECKOUT_ON || !stripe) return NextResponse.json({ on: false, account: row || null })
  if (row) {
    try {
      const a = await stripe.accounts.retrieve(row.stripe_account_id)
      const fresh = { charges_enabled: Boolean(a.charges_enabled), payouts_enabled: Boolean(a.payouts_enabled), details_submitted: Boolean(a.details_submitted) }
      await admin.from('vendor_payment_accounts').update({ ...fresh, updated_at: new Date().toISOString() }).eq('user_id', user.id)
      return NextResponse.json({ on: true, account: { ...row, ...fresh } })
    } catch {}
  }
  return NextResponse.json({ on: true, account: row || null })
}

export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  if (!SHOP_CHECKOUT_ON || !stripe) return NextResponse.json({ error: 'Selling through ResourceHub isn’t on yet.' }, { status: 503 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: account } = await supabase.from('resource_accounts').select('kind, organization, website').eq('user_id', user.id).maybeSingle()
  if (account?.kind !== 'product_vendor') return NextResponse.json({ error: 'Only product vendors sell through ResourceHub.' }, { status: 400 })
  const admin = createAdminClient()
  let { data: row } = await admin.from('vendor_payment_accounts').select('stripe_account_id').eq('user_id', user.id).maybeSingle()
  if (!row) {
    const made = await stripe.accounts.create({
      type: 'express',
      country: 'CA',
      email: user.email || undefined,
      business_profile: { name: account.organization, ...(account.website ? { url: account.website } : {}) },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { user_id: user.id },
    })
    await admin.from('vendor_payment_accounts').insert({ user_id: user.id, stripe_account_id: made.id })
    row = { stripe_account_id: made.id }
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const link = await stripe.accountLinks.create({ account: row.stripe_account_id, type: 'account_onboarding', refresh_url: `${appUrl}/business?payments=again`, return_url: `${appUrl}/business?payments=done` })
  return NextResponse.json({ url: link.url })
}
