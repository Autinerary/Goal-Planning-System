import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const ALLOWED_PRIORITY = new Set(['essential', 'high', 'medium', 'low', 'wellness', 'growth'])
const ALLOWED_SCENARIO = new Set(['worst', 'average', 'best'])

function clamp(s: unknown, max: number, fallback = ''): string {
  if (typeof s !== 'string') return fallback
  return s.trim().slice(0, max)
}

/**
 * GET /api/me/calendar
 * Returns all of the signed-in user's calendar tasks.
 */
export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('calendar_tasks')
    .select('id, client_id, day, time, name, duration, priority, source, scenario, completed, completed_at, created_at')
    .eq('user_id', user.id)
    .order('day', { ascending: true })
    .order('time', { ascending: true })

  if (error) {
    console.error('GET /api/me/calendar error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: data || [] })
}

/**
 * POST /api/me/calendar
 * Body: { client_id, day, time, name, duration?, priority?, source?, scenario? }
 * Upserts by (user_id, client_id) so adding the same task twice is a no-op.
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const client_id = clamp(body?.client_id, 120)
  const day = clamp(body?.day, 40)
  const time = clamp(body?.time, 20)
  const name = clamp(body?.name, 200)
  if (!client_id || !day || !time || !name) {
    return NextResponse.json({ error: 'client_id, day, time, and name are required' }, { status: 400 })
  }

  const duration = clamp(body?.duration, 40, '30 min')
  const rawPriority = clamp(body?.priority, 20, 'medium')
  const priority = ALLOWED_PRIORITY.has(rawPriority) ? rawPriority : 'medium'
  const source = clamp(body?.source, 120) || null
  const rawScenario = clamp(body?.scenario, 20)
  const scenario = rawScenario && ALLOWED_SCENARIO.has(rawScenario) ? rawScenario : null

  const { data, error } = await supabase
    .from('calendar_tasks')
    .upsert(
      {
        user_id: user.id,
        client_id,
        day,
        time,
        name,
        duration,
        priority,
        source,
        scenario,
      },
      { onConflict: 'user_id,client_id' }
    )
    .select('id, client_id, day, time, name, duration, priority, source, scenario, completed, completed_at, created_at')
    .single()

  if (error) {
    console.error('POST /api/me/calendar error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data })
}
