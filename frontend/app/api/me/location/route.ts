import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { geocodeLocation } from '@/lib/geocode'

export const dynamic = 'force-dynamic'

/**
 * POST /api/me/location
 *
 * Saves the city a user gave at onboarding to profiles.location, with
 * coordinates, so ResourceHub can recommend places near them.
 *
 * Onboarding already asked for this, but only ever sent it to ResourceHub
 * through an unauthenticated proxy (/api/recommendations), and ResourceHub
 * saves a location only for a signed-in caller. So it was dropped every time:
 * 106 of 109 real users had no location on their profile.
 *
 * Body: { city, province?, country? }
 *
 * Existing users are not backfilled from the browser's saved onboarding
 * answers: that copy is not tied to an account, so on a shared device it
 * could write one person's city into another's profile. ResourceHub's home
 * page asks anyone without a location instead.
 */

function text(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const city = text(body?.city)
  const province = text(body?.province)
  const country = text(body?.country)
  if (!city) return NextResponse.json({ error: 'City is required' }, { status: 400 })

  const coords = await geocodeLocation({ city, province, country })
  if (!coords) {
    // Nothing stored rather than 0,0; ResourceHub will ask them instead.
    return NextResponse.json({ error: "Couldn't find that place" }, { status: 422 })
  }

  const location = { city, province, country, lat: coords.lat, lng: coords.lng }
  const { data, error } = await supabase
    .from('profiles')
    .update({ location })
    .eq('id', user.id)
    .select('id')

  if (error) return NextResponse.json({ error: 'Could not save location' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json({ saved: true })
}
