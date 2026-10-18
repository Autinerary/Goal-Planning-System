import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSpotGuide } from '@/lib/spotGuides'

const BATCH = /^[a-z0-9-]{3,60}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Spot Guides' review of what the service-adding loop and the bulk imports
 * added (lib/spotGuides.ts; the team's planning note, October 2026, Goal 1).
 *
 * GET  /api/spot-guides                  the batches, with their counts
 * GET  /api/spot-guides?batch=&offset=   50 pending places of one batch
 * POST /api/spot-guides  { action: 'approve' | 'hide', batch, ids? }
 *      approve or hide those places, or every pending place in the batch.
 *      Hiding sets status 'rejected'; nothing is deleted.
 */
async function guide() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, ok: false }
  return { supabase, user, ok: await isSpotGuide(supabase) }
}

export async function GET(request: NextRequest) {
  const { supabase, user, ok } = await guide()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!ok) return NextResponse.json({ error: 'This is for Spot Guides.' }, { status: 403 })

  const batch = request.nextUrl.searchParams.get('batch') || ''
  if (!batch) {
    const { data, error } = await supabase.rpc('spot_guide_batches')
    if (error) return NextResponse.json({ batches: [], note: 'Apply STEP 78 to see the batches.' })
    return NextResponse.json({ batches: data || [] })
  }
  if (!BATCH.test(batch)) return NextResponse.json({ error: 'Which batch?' }, { status: 400 })
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') || 0) || 0)
  const { data, error } = await createAdminClient()
    .from('resources')
    .select('id, name, category, location, contact_info, source_url, tags, cost_type, created_at')
    .eq('import_batch', batch)
    .eq('status', 'pending')
    .order('created_at')
    .order('id')
    .range(offset, offset + 49)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ places: data || [] })
}

export async function POST(request: NextRequest) {
  const { user, ok } = await guide()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!ok) return NextResponse.json({ error: 'This is for Spot Guides.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const action = body?.action
  const batch = String(body?.batch || '')
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string' && UUID.test(id)).slice(0, 200) : []
  if ((action !== 'approve' && action !== 'hide') || !BATCH.test(batch)) {
    return NextResponse.json({ error: 'Approve or hide, and which batch.' }, { status: 400 })
  }
  let query = createAdminClient()
    .from('resources')
    .update({ status: action === 'approve' ? 'approved' : 'rejected' })
    .eq('import_batch', batch)
    .eq('status', 'pending')
  if (ids.length) query = query.in('id', ids)
  const { data, error } = await query.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log(`[spot-guides] ${user.id} ${action} ${data?.length || 0} in ${batch}`)
  return NextResponse.json({ changed: data?.length || 0 })
}
