import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripeClient } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/portal { flow?: 'cancel' }: Stripe's page to switch plan,
 * update the card, see receipts, or (with flow 'cancel') go straight to
 * cancelling (Quebec, s. 187.28: an easy cancel button online).
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  if (!stripe) return NextResponse.json({ error: 'Paying isn’t set up yet.' }, { status: 503 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { data } = await createAdminClient().from('subscriptions').select('stripe_customer_id, stripe_subscription_id, status').eq('user_id', user.id).maybeSingle()
  if (!data?.stripe_customer_id) return NextResponse.json({ error: 'You don’t have a plan yet.' }, { status: 404 })
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const cancel = body?.flow === 'cancel' && data.stripe_subscription_id && data.status !== 'canceled'
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${appUrl}/billing`,
    locale: 'auto',
    ...(cancel
      ? {
          flow_data: {
            type: 'subscription_cancel' as const,
            subscription_cancel: { subscription: data.stripe_subscription_id as string },
            after_completion: { type: 'redirect' as const, redirect: { return_url: `${appUrl}/billing?cancelled=1` } },
          },
        }
      : {}),
  })
  return NextResponse.json({ url: session.url })
}
