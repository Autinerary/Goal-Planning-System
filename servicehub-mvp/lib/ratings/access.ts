import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who may rate a service (the team's planning note, October 2026, Goal 5:
 * "Rate at any time, but only if one of 3"): it is in their team (a meeting
 * arranged, signed on, or completed), they recommended it, or they used it
 * before joining and sent proof, which an admin has seen. A rating given
 * before the rule can still be edited. Comments are open to anyone signed in.
 * The rule is the database's (can_rate(), STEP 79); this asks it.
 */
export interface RatingAccess {
  signed_in: boolean
  team: boolean
  wishlist: boolean
  recommended: boolean
  used_before: boolean
  rated: boolean
  claim: { code: string; status: 'pending' | 'approved' | 'rejected'; created_at: string } | null
  can_rate: boolean
  /** Before STEP 79: anyone signed in, as it was. */
  legacy?: boolean
}

export const PROOF_EMAIL = 'heydevs@autinerary.ca'

export const RATING_RULE =
  'You can rate a service once it is in your team, if you recommended it, or if you used it before you joined and sent us proof.'

const NONE: RatingAccess = { signed_in: false, team: false, wishlist: false, recommended: false, used_before: false, rated: false, claim: null, can_rate: false }

export async function ratingAccess(supabase: SupabaseClient, resourceId: string): Promise<RatingAccess> {
  const { data, error } = await supabase.rpc('rating_access', { p_resource: resourceId })
  if (error) {
    // Not there before STEP 79: rating stays as it was.
    if (error.code === 'PGRST202' || /rating_access/.test(error.message || '')) return { ...NONE, signed_in: true, can_rate: true, legacy: true }
    throw error
  }
  return { ...NONE, ...(data as Partial<RatingAccess>) }
}

/** The email with the proof, from the person's own email app. */
export function proofMailto(name: string, code: string): string {
  const subject = `Proof of use: ${name} (${code})`
  const body =
    `Hello,\n\nI used ${name} before I joined Autinerary, and I would like to rate it. ` +
    `Attached is my proof: for example a receipt, an invoice, an appointment confirmation, or a letter or report from them. ` +
    `(I have covered anything I do not want to share.)\n\nMy code: ${code}\n\nThank you,`
  return `mailto:${PROOF_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
