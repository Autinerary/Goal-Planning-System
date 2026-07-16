import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/me/movement
 * Returns the signed-in user's stored movement log (navigation order) so it can
 * be restored on a new device. Returns null when not authenticated.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ movement: null })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('movement')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ movement: null })
  }

  return NextResponse.json({ movement: data?.movement ?? null })
}

/**
 * POST /api/me/movement
 * Persist the signed-in user's movement log to their profiles row for
 * cross-device analytics. The client sends the full (trimmed) visit list; we
 * store the latest snapshot plus a readable summary and timestamp.
 *
 * Body: { visits: [{ path, label, at }], summary?: string }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const visits = Array.isArray(body?.visits) ? body.visits : null
  if (!visits) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Keep the payload bounded to protect the row size.
  const trimmed = visits.slice(-500)
  const summary =
    typeof body.summary === 'string'
      ? body.summary
      : trimmed.map((v: any) => v?.label).filter(Boolean).join(' → ')

  const movement = {
    visits: trimmed,
    summary,
    updatedAt: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, movement }, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ movement })
}
