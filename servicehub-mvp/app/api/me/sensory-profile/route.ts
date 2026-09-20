import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * The reader's own sensory profile.
 *
 * This is the input that makes a venue scan mean anything, and it is
 * also information about someone's disability, so it is readable and
 * writable only by them. There is no endpoint that returns anyone
 * else's, and the row-level policy would refuse one anyway.
 */

const SENSITIVITY = ['hyper', 'neutral', 'hypo']
const FLICKER = ['hyper', 'neutral']

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_sensory_profile')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ profile: data ?? null })
}

export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const row = {
    user_id: user.id,
    sound_sensitivity: SENSITIVITY.includes(body.soundSensitivity) ? body.soundSensitivity : 'neutral',
    sudden_noise_difficulty: Boolean(body.suddenNoiseDifficulty),
    comfortable_db_max: body.comfortableDbMax == null ? null : clampInt(body.comfortableDbMax, 30, 120),
    comfortable_db_min: body.comfortableDbMin == null ? null : clampInt(body.comfortableDbMin, 0, 90),
    flicker_sensitivity: FLICKER.includes(body.flickerSensitivity) ? body.flickerSensitivity : 'neutral',
    brightness_sensitivity: SENSITIVITY.includes(body.brightnessSensitivity) ? body.brightnessSensitivity : 'neutral',
    comfortable_lux_max: body.comfortableLuxMax == null ? null : clampInt(body.comfortableLuxMax, 10, 100000),
    comfortable_lux_min: body.comfortableLuxMin == null ? null : clampInt(body.comfortableLuxMin, 0, 10000),
    updated_at: new Date().toISOString(),
  }

  // A min above a max would fail the table's own check constraint, so
  // catch it here and say something useful instead of surfacing a 500.
  if (row.comfortable_db_min != null && row.comfortable_db_max != null
      && row.comfortable_db_min >= row.comfortable_db_max) {
    return NextResponse.json({ error: 'Your quietest comfortable level has to be below your loudest.' }, { status: 400 })
  }
  if (row.comfortable_lux_min != null && row.comfortable_lux_max != null
      && row.comfortable_lux_min >= row.comfortable_lux_max) {
    return NextResponse.json({ error: 'Your dimmest comfortable level has to be below your brightest.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_sensory_profile')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error('sensory profile upsert failed:', error)
    return NextResponse.json({ error: 'Could not save your profile' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
