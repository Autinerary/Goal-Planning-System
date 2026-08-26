import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RaterTrust, TrustTier, VerificationMethod } from '@/lib/trust'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/trust — the signed-in user's rater trust tier plus how each of
 * their norms is verified.
 *
 * No medical data is involved: trust comes from rating behaviour, and
 * verification_method is metadata only ('self' by default).
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const empty = {
    trust: { ratingsCount: 0, helpfulTotal: 0, karma: 0, tier: 'new' as TrustTier },
    norms: [] as { type: string; severity: number; method: VerificationMethod; relationship: string; relationshipDeclared: boolean }[],
  }
  if (!user) return NextResponse.json(empty)

  const [{ data: trustRows }, { data: normRows }] = await Promise.all([
    supabase.rpc('rater_trust', { p_user_id: user.id }),
    supabase
      .from('user_barriers')
      .select('barrier_type, severity, verification_method, relationship, relationship_declared')
      .eq('user_id', user.id),
  ])

  const row: any = Array.isArray(trustRows) ? trustRows[0] : trustRows
  const trust: RaterTrust = {
    ratingsCount: Number(row?.ratings_count) || 0,
    helpfulTotal: Number(row?.helpful_total) || 0,
    karma: Number(row?.karma) || 0,
    tier: (row?.tier as TrustTier) || 'new',
  }

  const norms = (normRows || [])
    .map((b: any) => ({
      type: String(b.barrier_type || '').trim().toLowerCase(),
      severity:
        typeof b.severity === 'number' ? Math.max(1, Math.min(5, Math.round(b.severity))) : 3,
      method: (b.verification_method as VerificationMethod) || 'self',
      relationship: String(b.relationship || 'lived'),
      // FALSE means we never asked — the UI prompts instead of assuming.
      relationshipDeclared: !!b.relationship_declared,
    }))
    .filter((n) => n.type)

  return NextResponse.json({ trust, norms })
}
