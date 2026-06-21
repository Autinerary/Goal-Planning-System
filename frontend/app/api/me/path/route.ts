import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/me/path
 * Returns the signed-in user's multi-agent path payload from public.user_paths.
 * This is the direct-from-Supabase replacement for the FastAPI /api/onboarding/*
 * endpoints, which aren't deployed alongside the Next.js app on Vercel.
 *
 * Response: { payload: <jsonb> | null, path_id: string | null, updated_at: string | null }
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
    .from('user_paths')
    .select('path_id, payload, updated_at')
    .eq('user_id', user.id)
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
 * Upserts the caller's path payload. Used when a path is generated client-side
 * or when we want to mirror what FastAPI wrote.
 *
 * Body: { path_id: string, payload: any }
 */
export async function PUT(req: NextRequest) {
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
