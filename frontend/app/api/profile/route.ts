import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/profile
 * Returns the current user's profile row from public.profiles.
 * If no row exists yet (e.g. user was created before the trigger), upserts one
 * from auth.users metadata so the rest of the social flow has a target.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_emoji, dream, discoverable, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) {
    // Self-heal: create a row from auth metadata
    const fallbackName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      (user.email ? user.email.split('@')[0] : null)
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: user.id, display_name: fallbackName, email: user.email })
      .select('id, display_name, email, avatar_emoji, dream, discoverable, created_at, updated_at')
      .single()
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    return NextResponse.json({ profile: created })
  }

  return NextResponse.json({ profile: data })
}

/**
 * PATCH /api/profile
 * Body: { display_name?, dream?, avatar_emoji?, discoverable? }
 * Only the four fields above are editable. Strings are trimmed and clamped.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, any> = {}
  if (typeof body.display_name === 'string') patch.display_name = body.display_name.trim().slice(0, 80) || null
  if (typeof body.dream === 'string') patch.dream = body.dream.trim().slice(0, 280) || null
  if (typeof body.avatar_emoji === 'string') patch.avatar_emoji = body.avatar_emoji.trim().slice(0, 8) || '👤'
  if (typeof body.discoverable === 'boolean') patch.discoverable = body.discoverable

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  // RLS guarantees we can only update our own row, but pass eq(id) defensively
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, display_name, email, avatar_emoji, dream, discoverable, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
