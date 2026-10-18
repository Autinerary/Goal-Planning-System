import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Before STEP 81 there is no table; the page offers email instead.
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /spot_guide_applications/.test(e.message || ''))

/**
 * GET  /api/spot-guides/apply  the signed-in person's application, if any
 * POST /api/spot-guides/apply { area, why }  ask to become a Spot Guide
 * (STEP 81's spot_guide_applications; the team approves in ResourceHub's admin).
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ application: null })
  const { data, error } = await supabase.from('spot_guide_applications').select('area, status, created_at').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ application: null, open: !missing(error) })
  return NextResponse.json({ application: data, open: true })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const area = typeof body?.area === 'string' ? body.area.trim().slice(0, 200) : ''
  const why = typeof body?.why === 'string' ? body.why.trim().slice(0, 1000) : ''
  if (!area) return NextResponse.json({ error: 'Say which area you know.' }, { status: 400 })
  const { error } = await supabase.from('spot_guide_applications').insert({ user_id: user.id, area, why: why || null })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, again: true })
    if (missing(error)) return NextResponse.json({ error: 'Applying here opens soon.', email: true }, { status: 503 })
    return NextResponse.json({ error: 'Could not send that. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
