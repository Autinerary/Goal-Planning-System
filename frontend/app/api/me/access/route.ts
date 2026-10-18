import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { PAYWALL_ON } from '@/lib/billing'
import { paymentsReady } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/access: whether the signed-in person may use the app when the
 * paywall is on, and why (STEP 81's my_access(): the team, free access, a
 * plan, or the free month, which starts the first time this is asked with
 * the paywall on), with their paid plan if they have one, whatever the
 * reason. With the paywall off, everyone has access.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ access: false, reason: 'signed_out', paywall: PAYWALL_ON })
  const [{ data, error }, { data: sub }] = await Promise.all([
    supabase.rpc('my_access', { p_start_trial: PAYWALL_ON }),
    supabase.from('subscriptions').select('plan, status, current_period_end, trial_end, cancel_at_period_end').eq('user_id', user.id).maybeSingle(),
  ])
  if (error) return NextResponse.json({ access: true, reason: 'open', paywall: PAYWALL_ON, paymentsReady: paymentsReady(), subscription: null })
  const access = data as Record<string, unknown>
  const subscription = sub && sub.status !== 'none' ? sub : null
  return NextResponse.json({ ...access, access: PAYWALL_ON ? access.access : true, paywall: PAYWALL_ON, paymentsReady: paymentsReady(), subscription })
}
