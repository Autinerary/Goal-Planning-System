import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { recordHalloweenLogin } from '@/lib/server/achievements'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  let { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const result = await supabase.auth.getUser(token)
      user = result.data.user
      authError = result.error
    }
  }

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // The person's time zone, so Halloween is their own 31 October (lib/achievements.ts, isHalloween).
    const body = await req.json().catch(() => ({}))
    const recorded = await recordHalloweenLogin(user.id, body?.timeZone)
    return NextResponse.json({ recorded })
  } catch (error) {
    console.error('POST /api/achievements/login error:', error)
    return NextResponse.json({ error: 'Could not record login achievement' }, { status: 500 })
  }
}
