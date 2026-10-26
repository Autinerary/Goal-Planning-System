import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * The signed-in person's one-click sign-ups (made in the app, STEP 90), for
 * My Resources' "Signed up" tab. Their own rows only (RLS). Empty before
 * STEP 90 is applied.
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('service_signups')
    .select('service, resource_id, status, runner, updated_at, resource:resources(name)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ signups: [], ready: false })
  return NextResponse.json({ signups: data || [], ready: true })
}
