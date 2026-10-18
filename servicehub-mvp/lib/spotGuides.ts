import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/auth/admin'

/**
 * Spot Guides review what the service-adding loop and the bulk imports add
 * before it is shown (the team's planning note, October 2026, Goal 1). A
 * Spot Guide is a row in spot_guides (STEP 78); admins may too. Asked of the
 * person's own session.
 */
export async function isSpotGuide(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_spot_guide')
  if (!error && data === true) return true
  // Before STEP 78, admins only.
  return isAdminUser(supabase)
}
