// Server only (never import from client components): one-click sign-up's
// checks and records (lib/signups.ts; service_signups, STEP 90), shared by
// app/api/me/signups and its server robot.

import type { NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isAdult } from '@/lib/age'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recipeForUrl } from '@/lib/signupKit'
import { partnersFrom, type Partner } from '@/lib/signupPartners'
import { cleanDetails, signupRefusal, type Runner, type SignupDetails, type SignupStatus } from '@/lib/signups'
import { NO_EXTRAS, cleanExtras, type RequestExtras } from '@/lib/requests'

/** The signed-in person: the web app's session cookie, or the phone app's Bearer token. */
export async function userFrom(req: NextRequest): Promise<User | null> {
  const auth = req.headers.get('authorization') || ''
  if (/^Bearer\s+\S+$/i.test(auth)) {
    const { data } = await createAdminClient().auth.getUser(auth.replace(/^Bearer\s+/i, ''))
    return data?.user || null
  }
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser()
  return user
}

/** The partner services set up in SIGNUP_PARTNERS (lib/signupPartners.ts). */
export const partners = (): Record<string, Partner> => partnersFrom(process.env.SIGNUP_PARTNERS)

/** The service a web address is: one of the kit's, or a partner's. */
export function serviceForUrl(url: string | null | undefined): string | null {
  const recipe = recipeForUrl(url)
  if (recipe) return recipe.key
  if (!url) return null
  let host = ''
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  return Object.values(partners()).find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.key || null
}

export const missingTable = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /service_signups/.test(e.message || ''))

/** Who this person is for sign-ups: why they can't (if so), the details they checked once, their email. */
export async function accountFor(admin: SupabaseClient, user: User): Promise<{ refusal: string | null; details: SignupDetails | null; extras: RequestExtras; email: string | null; suggested: string }> {
  const { data: profile } = await admin
    .from('profiles')
    .select('date_of_birth, managed_by_guardian, full_name, display_name, preferences')
    .eq('id', user.id)
    .maybeSingle()
  const managed = Boolean(user.app_metadata?.managed_by_guardian || user.user_metadata?.managed_by_guardian || profile?.managed_by_guardian)
  // Self sign-up is 18+; an account with no date of birth on file passed that gate.
  const dob = profile?.date_of_birth as string | null | undefined
  const refusal = signupRefusal({ adult: dob ? isAdult(dob) : true, managed, hasEmail: Boolean(user.email) })
  const signup = (profile?.preferences as { signup?: { extras?: unknown } } | null)?.signup
  const saved = cleanDetails(signup)
  const extras = cleanExtras(signup?.extras)
  return {
    refusal,
    details: saved.ok ? saved.details : null,
    extras: extras.ok ? extras.extras : NO_EXTRAS,
    email: user.email || null,
    suggested: String(profile?.full_name || profile?.display_name || user.user_metadata?.full_name || ''),
  }
}

/** Save the details they checked (profiles.preferences.signup), with when they said yes. */
export async function saveDetails(admin: SupabaseClient, userId: string, details: SignupDetails, extras: RequestExtras = NO_EXTRAS): Promise<string | null> {
  const { data } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  const current = (data?.preferences as Record<string, unknown>) || {}
  const { error } = await admin
    .from('profiles')
    .update({ preferences: { ...current, signup: { ...details, extras, consentedAt: new Date().toISOString() } } })
    .eq('id', userId)
  return error ? error.message : null
}

/** One person's sign-up for one service, as it now stands. Never a password. */
export async function recordSignup(
  admin: SupabaseClient,
  row: { userId: string; service: string; resourceId?: string | null; runner: Runner; status: SignupStatus; detail?: string | null },
): Promise<{ error: string | null }> {
  const { error } = await admin.from('service_signups').upsert(
    {
      user_id: row.userId,
      service: row.service,
      resource_id: row.resourceId || null,
      runner: row.runner,
      status: row.status,
      detail: row.detail ? String(row.detail).slice(0, 300) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,service' },
  )
  return { error: error ? error.message : null }
}
