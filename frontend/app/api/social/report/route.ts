import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE, socialError } from '@/lib/social'
import { emailEnabled, messageReportedEmail, sendEmail } from '@/lib/email'
import { CONTACT_EMAIL } from '@/lib/contact'

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
  const { data: reportId, error } = await supabase.rpc('report_message', { message, why: reason })
  if (error) {
    const e = socialError(error, 'The message could not be reported. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }

  // Tell the team, with a link to the review page in ResourceHub's admin area.
  if (emailEnabled()) {
    const hub = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'https://servicehub-six.vercel.app').replace(/\/$/, '')
    const { subject, html, text } = messageReportedEmail(`${hub}/admin/messages`)
    await sendEmail({ to: CONTACT_EMAIL, subject, html, text, idempotencyKey: `message-report-${reportId || message}` }).catch(() => null)
  }
  return NextResponse.json({ reported: message })
}
