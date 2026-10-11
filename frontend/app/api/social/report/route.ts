import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE, socialError } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * POST /api/social/report { message_id, reason? }: report a message you were
 * sent. The database keeps a copy of it for the team (report_message,
 * STEP 66), even if the sender unsends it. Blocking is on the person's card.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const message = typeof body?.message_id === 'string' && UUID_RE.test(body.message_id) ? body.message_id : null
  if (!message) return NextResponse.json({ error: 'Choose a message.' }, { status: 400 })
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : ''
  const { error } = await supabase.rpc('report_message', { message, why: reason })
  if (error) {
    const e = socialError(error, 'The message could not be reported. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  return NextResponse.json({ reported: message })
}
