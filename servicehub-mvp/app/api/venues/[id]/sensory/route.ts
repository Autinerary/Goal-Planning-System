import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MIN_SCANS_FOR_SUMMARY } from '@/lib/sensory/profile'

/**
 * GET /api/venues/[id]/sensory
 *
 * Per-time-of-day sensory summary for one venue, plus the reader's own
 * sensory profile so the client can interpret it for them.
 *
 * scan_count travels with every bucket deliberately. Two readings and
 * fifty readings must not be presented with the same confidence, and
 * the only way the UI can avoid that is if it knows.
 */

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: buckets, error } = await supabase.rpc('get_venue_sensory', {
    resource_id_in: params.id,
  })

  if (error) {
    console.error('get_venue_sensory failed:', error)
    return NextResponse.json({ error: 'Could not load sensory data' }, { status: 500 })
  }

  // The reader's own profile, if they are signed in and have set one.
  // Never anyone else's: this is health-adjacent and RLS enforces it too.
  let profile = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase
      .from('user_sensory_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      profile = {
        soundSensitivity: data.sound_sensitivity,
        suddenNoiseDifficulty: data.sudden_noise_difficulty,
        comfortableDbMax: data.comfortable_db_max,
        comfortableDbMin: data.comfortable_db_min,
        flickerSensitivity: data.flicker_sensitivity,
        brightnessSensitivity: data.brightness_sensitivity,
        comfortableLuxMax: data.comfortable_lux_max,
        comfortableLuxMin: data.comfortable_lux_min,
      }
    }
  }

  const rows = (buckets ?? []) as any[]
  return NextResponse.json({
    buckets: rows,
    profile,
    totalScans: rows.reduce((sum, b) => sum + (b.scan_count ?? 0), 0),
    minScansForSummary: MIN_SCANS_FOR_SUMMARY,
  })
}
