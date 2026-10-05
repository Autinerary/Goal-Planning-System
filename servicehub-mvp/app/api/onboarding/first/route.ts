import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { matchedPlaces } from '@/lib/onboarding/first'
import { readMyProfile } from '@/lib/onboarding/profile'
import { findNorm } from '@/lib/onboarding/setup'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding/first?limit=3
 *
 * Places matched to the signed-in person's topics and needs: the last step
 * of setup ("Here's a place to start") and "For you" on the home page. Uses
 * their first neurodivergence topic (or first topic of any kind), and their
 * location when they have one. See lib/onboarding/first.ts.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 3, 1), 6)
  const me = await readMyProfile(supabase, user)
  const topicNorm =
    me.norms.find((n) => n.group === 'neurodivergence' && findNorm(n.type)) || me.norms.find((n) => findNorm(n.type))

  let userLocation: { lat: number; lng: number; province?: string } | undefined
  if (me.hasCoords) {
    const { data } = await supabase.from('profiles').select('location').eq('id', user.id).maybeSingle()
    const loc = (data?.location || {}) as Record<string, unknown>
    userLocation = {
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      province: typeof loc.province === 'string' ? loc.province : undefined,
    }
  }

  const places = await matchedPlaces({ topic: topicNorm?.type, needs: me.needs, userLocation, limit })
  return NextResponse.json({
    places,
    topic: topicNorm ? { id: topicNorm.type, label: topicNorm.label } : null,
    needs: me.needs,
    place: me.location && me.hasCoords ? [me.location.city, me.location.province].filter(Boolean).join(', ') : null,
  })
}
