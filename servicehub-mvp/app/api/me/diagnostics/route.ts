import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/me/diagnostics — the signed-in user's own diagnostic features +
 * severities ({ type, severity 1-5 }), read RLS-safely from their user_barriers.
 * Used to show raters how their rating will be categorized (norm · level).
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ diagnostics: [] })

  const { data } = await supabase
    .from('user_barriers')
    .select('barrier_type, severity')
    .eq('user_id', user.id)

  const diagnostics = (data || [])
    .map((b: any) => ({
      type: String(b.barrier_type || '').trim().toLowerCase(),
      severity: typeof b.severity === 'number' ? Math.max(1, Math.min(5, Math.round(b.severity))) : 3,
    }))
    .filter((d) => d.type)

  return NextResponse.json({ diagnostics })
}
