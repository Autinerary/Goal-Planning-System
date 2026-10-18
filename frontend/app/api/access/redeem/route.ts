import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const WHY: Record<string, string> = {
  not_found: 'That code doesn’t match one we know. Check it with whoever gave it to you.',
  expired: 'That code has expired.',
  used_up: 'That code has been used as many times as it can be.',
  already: 'You already have free access from that code.',
}

/** POST /api/access/redeem { code }: a partner's code for free access (STEP 81's redeem_access_code()). */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase().slice(0, 32) : ''
  if (!/^[A-Z0-9-]{6,32}$/.test(code)) return NextResponse.json({ error: WHY.not_found }, { status: 400 })
  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code })
  if (error) return NextResponse.json({ error: error.code === 'PGRST202' ? 'Codes open soon.' : 'Could not check that code.' }, { status: error.code === 'PGRST202' ? 503 : 500 })
  const out = data as { ok?: boolean; error?: string; organization?: string; ends_at?: string }
  if (!out?.ok) return NextResponse.json({ error: WHY[out?.error || 'not_found'] || WHY.not_found }, { status: 400 })
  return NextResponse.json(out)
}
