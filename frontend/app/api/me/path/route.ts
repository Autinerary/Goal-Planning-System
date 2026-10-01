import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Helper to get user from Authorization header OR cookie session.
 */
async function getAuthenticatedUser(req: NextRequest) {
  const supabase = createServerSupabase()

  // 1. Try reading standard cookie session first
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  if (cookieUser) return { user: cookieUser, supabase }

  // 2. Fall back to Authorization: Bearer <token> header from fetchWithAuth
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token)
    if (!error && tokenUser) {
      return { user: tokenUser, supabase }
    }
  }

  return { user: null, supabase }
}

/**
 * GET /api/me/path
 * Returns the signed-in user's multi-agent path payload from public.user_paths.
 */
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // A user can hold SEVERAL rows here — the backend's _save_path is multi-path
  // aware and marks one is_active. `.maybeSingle()` on its own throws PGRST116
  // the moment a second row exists, which 500s this route and leaves the app
  // showing "No races yet" to someone whose path is sitting in the table.
  // Take the active row, newest first, and ask for exactly one.
  const { data, error } = await supabase
    .from('user_paths')
    .select('path_id, payload, updated_at')
    .eq('user_id', user.id)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('GET /api/me/path error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    payload: data?.payload || null,
    path_id: data?.path_id || null,
    updated_at: data?.updated_at || null,
  })
}

/**
 * PUT /api/me/path
 * Upserts the caller's path payload.
 */
export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const pathId = typeof body?.path_id === 'string' && body.path_id ? body.path_id : `path_${user.id}`
  const payload = body?.payload
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_paths')
    .upsert(
      {
        user_id: user.id,
        path_id: pathId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('PUT /api/me/path error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path_id: pathId })
}