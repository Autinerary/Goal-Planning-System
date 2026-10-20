import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'
import { emailEnabled, momentReviewEmail, sendEmail } from '@/lib/email'
import { CONTACT_EMAIL } from '@/lib/contact'

export const dynamic = 'force-dynamic'

/**
 * POST /api/moments/[id]/report { reason? }: report a moment you can see.
 * Two reports from different people hide it until the team looks (STEP 87);
 * the team is emailed a link to the review page.
 */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = ctx.params.id
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Choose a moment.' }, { status: 400 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null
  const { error } = await supabase.from('moment_reports').insert({ moment_id: id, reporter_id: user.id, reason })
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'Hare World Social opens soon.' }, { status: 503 })
    if (error.code === '23505') return NextResponse.json({ reported: id, already: true })
    return NextResponse.json({ error: 'You can report moments you can see, but not your own.' }, { status: error.code === '42501' ? 403 : 500 })
  }
  if (emailEnabled()) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.autinerary.ca').replace(/\/$/, '')
    const { subject, html, text } = momentReviewEmail(`${site}/admin/moments`, 'reported')
    await sendEmail({ to: CONTACT_EMAIL, subject, html, text, idempotencyKey: `moment-report-${id}-${user.id}` }).catch(() => null)
  }
  return NextResponse.json({ reported: id })
}
