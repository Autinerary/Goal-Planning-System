import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { isPlacement, SPONSORED_ON, UUID_RE, viewerKey } from '@/lib/sponsored'

export const dynamic = 'force-dynamic'

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse/i

/**
 * POST /api/sponsored/event { id, kind: 'impression' | 'click', placement }:
 * the same as ResourceHub's (servicehub-mvp/app/api/sponsored/event), for
 * the sponsored service in Paths. Counted once a day per person by STEP 83's
 * promotion_record(), which charges a click its bid.
 */
export async function POST(req: NextRequest) {
  const no = NextResponse.json({ counted: false })
  if (!SPONSORED_ON || BOTS.test(req.headers.get('user-agent') || 'bot')) return no
  const b = await req.json().catch(() => ({}))
  if (!UUID_RE.test(String(b?.id || '')) || !['impression', 'click'].includes(b?.kind) || !isPlacement(b?.placement)) {
    return NextResponse.json({ error: 'Which listing?' }, { status: 400 })
  }
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser()
  const { data, error } = await createAdminClient().rpc('promotion_record', {
    p_promotion: b.id,
    p_kind: b.kind,
    p_viewer_key: viewerKey(user?.id ?? null, req.headers),
    p_placement: b.placement,
  })
  if (error) return no
  return NextResponse.json({ counted: Boolean((data as any)?.counted) })
}
