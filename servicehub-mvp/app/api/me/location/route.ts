import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocodeLocation, reverseGeocode, roundCoordinate } from '@/lib/geocode'

export const dynamic = 'force-dynamic'

/**
 * POST /api/me/location
 *
 * Sets the signed-in user's location, which is what "near you" recommendations
 * run on. 106 of 109 real users had none: Goal Planning onboarding asks for a
 * city, but the hand-off to ResourceHub is unauthenticated, so it was never
 * saved to the profile.
 *
 * Body, one of:
 *   { city, province?, country? }   typed by the user, geocoded here
 *   { lat, lng }                    from the browser, rounded to ~1 km first
 *
 * Writable only by the user themselves (profiles RLS: auth.uid() = id).
 */

function text(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let location: { city: string; province: string; country: string; lat: number; lng: number }

  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (body?.lat != null && body?.lng != null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }
    const rLat = roundCoordinate(lat)
    const rLng = roundCoordinate(lng)
    // Reverse geocoding the rounded value, so the lookup never sees the
    // precise position either.
    const place = await reverseGeocode(rLat, rLng)
    location = {
      city: place?.city || '',
      province: place?.province || '',
      country: place?.country || '',
      lat: rLat,
      lng: rLng,
    }
  } else {
    const city = text(body?.city)
    const province = text(body?.province)
    const country = text(body?.country)
    if (!city) return NextResponse.json({ error: 'City is required' }, { status: 400 })
    const coords = await geocodeLocation({ city, province, country })
    if (!coords) {
      // Nothing is stored (not 0,0 as a placeholder), so the prompt stays up
      // and the user can try a different spelling or a nearby city.
      return NextResponse.json(
        { error: "We couldn't find that place. Check the spelling, or try a nearby larger city." },
        { status: 422 }
      )
    }
    location = { city, province, country, lat: coords.lat, lng: coords.lng }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ location })
    .eq('id', user.id)
    .select('id')

  if (error) return NextResponse.json({ error: 'Could not save your location' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json({
    location: { city: location.city, province: location.province, country: location.country },
  })
}
