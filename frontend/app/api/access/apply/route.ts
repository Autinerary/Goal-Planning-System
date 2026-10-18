import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET  /api/access/apply  the person's free-access requests and grants
 * POST /api/access/apply { kind: 'student' | 'advocate', source, case }:
 *   register as a student (which school), or explain your case (STEP 81's
 *   apply_for_access()). Both wait for the team.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ grants: [] })
  const { data, error } = await supabase.from('access_grants').select('kind, source, status, ends_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
  return NextResponse.json({ grants: error ? [] : data || [], open: !error })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const kind = body?.kind === 'advocate' ? 'advocate' : body?.kind === 'student' ? 'student' : null
  if (!kind) return NextResponse.json({ error: 'Choose student, or explain your case.' }, { status: 400 })
  const { data, error } = await supabase.rpc('apply_for_access', {
    p_kind: kind,
    p_source: typeof body?.source === 'string' ? body.source.slice(0, 200) : '',
    p_case: typeof body?.case === 'string' ? body.case.slice(0, 2000) : null,
  })
  if (error) return NextResponse.json({ error: error.code === 'PGRST202' ? 'This opens soon.' : 'Could not send that.' }, { status: error.code === 'PGRST202' ? 503 : 500 })
  const out = data as { ok?: boolean; error?: string }
  if (!out?.ok) {
    const why: Record<string, string> = { source: kind === 'student' ? 'Say which school.' : 'Say where you live.', case: 'Tell us a little more: a sentence or two.' }
    return NextResponse.json({ error: why[out?.error || ''] || 'Could not send that.' }, { status: 400 })
  }
  return NextResponse.json(out)
}
