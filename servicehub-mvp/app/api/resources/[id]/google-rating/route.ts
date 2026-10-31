import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchGoogleRating, findPlaceId, googleRatingsOn } from '@/lib/external-ratings/google'

// GET /api/resources/:id/google-rating -> { rating, count, mapsUri } fetched from Google now, or 204. Off unless
// GOOGLE_RATINGS=on and GOOGLE_PLACES_API_KEY are set (lib/external-ratings/google.ts). Only the place id is stored.
export const dynamic = 'force-dynamic'

const DAILY_CAP = Number(process.env.GOOGLE_RATINGS_DAILY_CAP || 500)   // paid lookups a day, per server instance
const PER_MINUTE = 30
let day = ''
let used = 0
const recent = new Map<string, number[]>()

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const none = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  if (!googleRatingsOn() || !/^[0-9a-f-]{36}$/i.test(params.id)) return none()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const hits = (recent.get(ip) || []).filter((t) => now - t < 60_000)
  if (hits.length >= PER_MINUTE) return new NextResponse(null, { status: 429 })
  recent.set(ip, [...hits, now])
  const today = new Date().toISOString().slice(0, 10)
  if (day !== today) { day = today; used = 0 }
  if (used >= DAILY_CAP) return none()

  const key = process.env.GOOGLE_PLACES_API_KEY as string
  const admin = createAdminClient()
  const { data: row } = await admin.from('resources').select('id, name, location, status, google_place_id, google_place_checked_at').eq('id', params.id).eq('status', 'approved').maybeSingle()
  if (!row) return none()

  let placeId: string | null = (row as any).google_place_id || null
  if (!placeId) {
    const checked = (row as any).google_place_checked_at
    if (checked && now - new Date(checked).getTime() < 90 * 86_400_000) return none()   // no match last time: not again for 90 days
    used++
    const loc = (row.location || {}) as { city?: string; province?: string }
    placeId = await findPlaceId({ name: row.name, city: loc.city, province: loc.province }, key)
    await admin.from('resources').update({ google_place_id: placeId, google_place_checked_at: new Date().toISOString() }).eq('id', row.id)
    if (!placeId) return none()
  }
  used++
  const rating = await fetchGoogleRating(placeId, key)
  return rating ? NextResponse.json(rating, { headers: { 'Cache-Control': 'no-store' } }) : none()
}
