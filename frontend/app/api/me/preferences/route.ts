import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/me/preferences
 * Returns the signed-in user's stored view/interaction preferences (the JSON
 * blob on profiles.preferences) so the app can hydrate customizations —
 * pinwheel side, widget size, accent, view preference, etc. — across devices.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ preferences: null })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ preferences: null })
  }

  return NextResponse.json({ preferences: data?.preferences ?? null })
}

/**
 * POST /api/me/preferences
 * Merge-update the signed-in user's preferences JSON on their profiles row.
 * Used by in-app customization controls (layout placement/size/color, view
 * preference) so changes made after onboarding persist server-side.
 *
 * Body: a partial preferences object, e.g.
 *   { layout: { pinwheelSide: 'right', widgetSize: 'large', accent: 'rose' } }
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

  let patch: any
  try {
    patch = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!patch || typeof patch !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Read current preferences so we can shallow-merge (and deep-merge layout).
  const { data: existing } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle()

  const current = (existing?.preferences as Record<string, any>) || {}
  const merged: Record<string, any> = { ...current, ...patch }
  if (patch.layout || current.layout) {
    merged.layout = { ...(current.layout || {}), ...(patch.layout || {}) }
  }
  if (patch.accessibility || current.accessibility) {
    merged.accessibility = { ...(current.accessibility || {}), ...(patch.accessibility || {}) }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, preferences: merged }, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ preferences: merged })
}
