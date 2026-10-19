import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTasteQuality } from '@/lib/shop/taste'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/sensory-preferences   what you like and avoid in products, and your taste profile if you have one
 * PUT /api/me/sensory-preferences { likes, avoids }
 * Optional, only yours to see (STEP 82).
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ signedIn: false })
  const [{ data: prefs, error }, { data: profile }, { data: latest }] = await Promise.all([
    supabase.from('sensory_preferences').select('likes, avoids').eq('user_id', user.id).maybeSingle(),
    supabase.from('taste_profiles').select('group_id, taste_profile_groups(label, top_likes, size)').eq('user_id', user.id).maybeSingle(),
    supabase.from('taste_profile_groups').select('id').order('id', { ascending: false }).limit(1),
  ])
  if (error) return NextResponse.json({ signedIn: true, open: false })
  // Only a profile from the latest run (scripts/taste-profiles.mjs numbers groups run*100+n).
  const run = (id: number | undefined) => Math.floor((id || 0) / 100)
  const current = profile && latest?.length && run((profile as any).group_id) === run(latest[0].id)
  return NextResponse.json({ signedIn: true, open: true, likes: prefs?.likes || [], avoids: prefs?.avoids || [], profile: current ? (profile as any).taste_profile_groups : null })
}

export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const likes = Array.from(new Set((Array.isArray(b?.likes) ? b.likes : []).filter(isTasteQuality))) as string[]
  const avoids = (Array.from(new Set((Array.isArray(b?.avoids) ? b.avoids : []).filter(isTasteQuality))) as string[]).filter((a) => !likes.includes(a))
  const { error } = await supabase.from('sensory_preferences').upsert({ user_id: user.id, likes, avoids, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  return NextResponse.json({ ok: true, likes, avoids })
}
