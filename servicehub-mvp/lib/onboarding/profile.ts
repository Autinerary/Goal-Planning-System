import type { SupabaseClient, User } from '@supabase/supabase-js'
import { cleanNeeds, findNorm, NOT_A_NORM } from './setup'

/**
 * What ResourceHub knows about the signed-in person, for setup, the profile
 * page and the prompts that ask for more later (Riipen Labs, Group 8).
 *
 * Role and location live on profiles, norms in user_barriers. What someone
 * hopes to find ("needs") and their answer to "sharpen your matches?" are
 * small preferences, kept in their account's metadata
 * (user_metadata.resourcehub_needs, user_metadata.resourcehub_sharpen) so no
 * new table is needed.
 */

export interface MyNorm {
  type: string
  label: string
  /** NORM_GROUPS key ('neurodivergence', 'identity', ...), or the stored category. */
  group: string
  /** Confirmed by a professional or an organisation. */
  confirmed: boolean
  /** How much it affects daily life, 1 to 5, if they said (optional, on the profile). */
  severity: number | null
}

export interface MyProfile {
  role: string | null
  needs: string[]
  location: { city: string; province: string; country: string } | null
  /** Coordinates, needed for "near you". 0,0 counts as none. */
  hasCoords: boolean
  norms: MyNorm[]
  createdAt: string | null
  /** 'no' to never ask "sharpen your matches?" again, or the day to ask again. */
  sharpen: string | null
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const prettyNorm = (type: string) =>
  findNorm(type)?.label || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')

export async function readMyProfile(supabase: SupabaseClient, user: User): Promise<MyProfile> {
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('role, location').eq('id', user.id).maybeSingle(),
    supabase
      .from('user_barriers')
      .select('barrier_type, barrier_category, verification_method, verified_at, severity')
      .eq('user_id', user.id),
  ])

  const loc = (profile?.location || null) as Record<string, unknown> | null
  const city = text(loc?.city)
  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const seen = new Set<string>()
  const norms: MyNorm[] = []
  for (const r of (rows || []) as Record<string, any>[]) {
    const type = text(r.barrier_type)
    if (!type || NOT_A_NORM.test(type) || seen.has(type)) continue
    seen.add(type)
    norms.push({
      type,
      label: prettyNorm(type),
      group: findNorm(type)?.group || text(r.barrier_category) || 'general',
      confirmed: Boolean(r.verified_at) || (Boolean(r.verification_method) && r.verification_method !== 'self'),
      severity: Number.isInteger(r.severity) && r.severity >= 1 && r.severity <= 5 ? r.severity : null,
    })
  }

  return {
    role: profile?.role && profile.role !== 'user' ? profile.role : null,
    needs: cleanNeeds(meta.resourcehub_needs),
    location: city ? { city, province: text(loc?.province), country: text(loc?.country) } : null,
    hasCoords: Boolean(loc && Number(loc.lat) && Number(loc.lng)),
    norms,
    createdAt: user.created_at || null,
    sharpen: typeof meta.resourcehub_sharpen === 'string' ? meta.resourcehub_sharpen : null,
  }
}

/** Setup is done once someone has chosen a role, or has any norm from an
 *  older setup. Topics can be skipped, so norms alone cannot say. */
export async function needsSetup(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('user_barriers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  const hasRole = Boolean(profile?.role && profile.role !== 'user')
  return !hasRole && !count
}
