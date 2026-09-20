import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/venues/[id]/scan
 *
 * Accepts the handful of numbers a scan produced. It will not accept
 * anything else: the body is whitelisted field by field, so even if a
 * future client tried to attach a recording or an image there is
 * nowhere for it to land.
 */

/** Clamp and round, or null. Keeps a bad client from writing nonsense. */
function num(v: unknown, min: number, max: number, dp = 2): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  if (n < min || n > max) return null
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to add a scan' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const localHour = num(body.localHour, 0, 23, 0)
  const dayOfWeek = num(body.dayOfWeek, 0, 6, 0)
  const duration = num(body.durationSeconds, 5, 300, 0)
  if (localHour === null || dayOfWeek === null || duration === null) {
    return NextResponse.json({ error: 'Scan is missing its timing information' }, { status: 400 })
  }

  // Only these fields are ever read off the request.
  const row = {
    resource_id: params.id,
    user_id: user.id,
    local_hour: localHour,
    day_of_week: dayOfWeek,
    duration_seconds: duration,
    sound_median_db: num(body.soundMedianDb, 0, 140),
    sound_l10_db: num(body.soundL10Db, 0, 140),
    sound_l90_db: num(body.soundL90Db, 0, 140),
    sound_peak_db: num(body.soundPeakDb, 0, 140),
    sound_peak_events_per_min: num(body.soundPeakEventsPerMin, 0, 600),
    sound_onset_rate: num(body.soundOnsetRate, 0, 600),
    light_lux: num(body.lightLux, 0, 200000),
    flicker_hz: num(body.flickerHz, 0, 1000),
    flicker_modulation_pct: num(body.flickerModulationPct, 0, 100),
    light_kelvin: num(body.lightKelvin, 1000, 20000, 0),
    device_model: typeof body.deviceModel === 'string' ? body.deviceModel.slice(0, 120) : null,
    calibration_offset_db: num(body.calibrationOffsetDb, -60, 140) ?? 0,
    calibration_source: ['uncalibrated', 'model_table', 'user_calibrated'].includes(body.calibrationSource)
      ? body.calibrationSource : 'uncalibrated',
    confidence: num(body.confidence, 0, 1) ?? 0.5,
    notes: typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim().slice(0, 500) : null,
  }

  if (row.sound_median_db === null && row.light_lux === null && row.flicker_hz === null) {
    return NextResponse.json({ error: 'That scan did not measure anything' }, { status: 400 })
  }

  const { data, error } = await supabase.from('venue_scans').insert(row).select('id').single()

  if (error) {
    // 23505 is the one-scan-per-person-per-venue-per-hour index doing its
    // job. That is not a failure the user needs an error page for.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You already added a scan for this place in the last hour. Come back later in the day to build up a picture.' },
        { status: 409 },
      )
    }
    console.error('venue scan insert failed:', error)
    return NextResponse.json({ error: 'Could not save that scan' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
