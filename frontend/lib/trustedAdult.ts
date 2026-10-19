import type { SupabaseClient } from '@supabase/supabase-js'
import { PAYMENTS_ON } from './billing'

/**
 * Trusted adults (the team's note, October 2026: "Have trusted legal adult
 * who HAS AN ACCOUNT be able to sign in, review info, and approve account.
 * We need to add this as a paid feature"; STEP 84).
 *
 *   NEXT_PUBLIC_TEEN_REQUESTS=on  someone under 18 can sign up by asking a
 *                                 trusted adult, whose approval unlocks the
 *                                 account. Off until the team has checked
 *                                 the terms and privacy page for under-18s.
 *
 * Adding a child, or approving a teen, is part of a paid plan once paid
 * plans are on (PAYMENTS_ON); until then it is free, like everything.
 */
export const TEEN_REQUESTS_ON = process.env.NEXT_PUBLIC_TEEN_REQUESTS === 'on'

/** Approving or adding someone under 18 needs a plan, free access or the team, once payments are on. */
export async function familyAllowed(supabase: SupabaseClient): Promise<boolean> {
  if (!PAYMENTS_ON) return true
  const { data, error } = await supabase.rpc('my_access', { p_start_trial: false })
  if (error) return false
  const reason = (data as { reason?: string } | null)?.reason
  return reason === 'subscription' || reason === 'grant' || reason === 'team'
}

export const FAMILY_NEEDS_PLAN =
  'Adding or approving an account for someone under 18 is part of a paid plan. You can choose one, or ask about free access, on the pricing page.'
