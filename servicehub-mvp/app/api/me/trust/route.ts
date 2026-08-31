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
    userId: null as string | null,
    trust: { ratingsCount: 0, helpfulTotal: 0, karma: 0, tier: 'new' as TrustTier },
    norms: [] as { type: string; severity: number; method: VerificationMethod; relationship: string; relationshipDeclared: boolean; peerVouches: number }[],
  }
  if (!user) return NextResponse.json(empty)

  const [{ data: trustRows }, { data: normRows }, { data: vouchRows }] = await Promise.all([
    supabase.rpc('rater_trust', { p_user_id: user.id }),
    supabase
      .from('user_barriers')
      .select('barrier_type, severity, verification_method, relationship, relationship_declared')
      .eq('user_id', user.id),
    // How many peers have vouched for each norm, so the UI can show progress
    // towards the badge rather than a threshold the user cannot see.
    supabase.from('peer_vouches').select('barrier_type').eq('vouchee_id', user.id),
  ])

  const vouchCounts = new Map<string, number>()
  for (const v of (vouchRows || []) as any[]) {
    const k = String(v.barrier_type || '').trim().toLowerCase()
    vouchCounts.set(k, (vouchCounts.get(k) || 0) + 1)
  }

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
      peerVouches: 0,
    }))
    .filter((n) => n.type)
    .map((n) => ({ ...n, peerVouches: vouchCounts.get(n.type) || 0 }))

  return NextResponse.json({ userId: user.id, trust, norms })
}
