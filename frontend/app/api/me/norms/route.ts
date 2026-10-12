import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/norms: the norms on the signed-in user's profile
 * (public.user_barriers), whether they came from setup, ResourceHub or an
 * organisation. "Prefer not to share" is left out: it stands for no answer.
 *
 * Setup no longer asks about norms (Riipen Labs, Groups 25 to 30), so it
 * sends these with the request for a new plan, and the "Complete your
 * profile" card counts them as answered. Read with the person's own session:
 * row-level security returns only their rows. Adding and removing norms is
 * ResourceHub's (servicehub-mvp/app/api/me/norms).
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.from('user_barriers').select('barrier_type').eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not read your norms' }, { status: 500 })
  const seen = new Set<string>()
  const norms: string[] = []
  for (const row of (data || []) as { barrier_type: string | null }[]) {
    const name = String(row.barrier_type || '').trim()
    const key = name.toLowerCase()
    if (!name || key === 'prefer not to share' || seen.has(key)) continue
    seen.add(key)
    norms.push(name)
  }
  return NextResponse.json({ norms })
}
