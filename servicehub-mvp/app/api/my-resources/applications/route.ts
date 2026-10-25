import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * The signed-in person's one-click Apply applications (sent from the app,
 * STEP 89), for My Resources' "Applied" tab. Their own rows only (RLS), with
 * each service's name. Empty before STEP 89 is applied.
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('service_applications')
    .select('resource_id, status, sent_at, created_at, resource:resources(id, name, category, contact_info)')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ applications: [], ready: false })

  const applications = (data || []).map((a: any) => ({
    resourceId: a.resource_id,
    name: a.resource?.name || 'A service',
    category: a.resource?.category || null,
    status: a.status,
    at: a.sent_at || a.created_at,
    // Only once the team found no email address, so they can call instead.
    phone: a.status === 'unreachable' && typeof a.resource?.contact_info?.phone === 'string' ? a.resource.contact_info.phone : null,
  }))
  return NextResponse.json({ applications, ready: true })
}
