import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, smsEnabled, startVerification } from '@/lib/sms'

export const dynamic = 'force-dynamic'

const RESEND_AFTER_MS = 60 * 1000

/**
 * POST /api/me/sms/start { phone }: text a code to a Canadian or US number,
 * so its owner can prove it is theirs before reminders go to it. At most one
 * code a minute per account; Twilio Verify limits each number as well.
 */
export async function POST(req: NextRequest) {
  if (!smsEnabled()) return NextResponse.json({ error: 'Texts are not available yet.' }, { status: 404 })
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const phone = normalizePhone(body?.phone)
  if (!phone) return NextResponse.json({ error: 'Enter a Canadian or US mobile number, like 416 555 0123.' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(user.id)
  const meta = data?.user?.app_metadata || {}
  const last = Date.parse(String(meta.sms_code_sent_at || ''))
  if (Number.isFinite(last) && Date.now() - last < RESEND_AFTER_MS) {
    return NextResponse.json({ error: 'A code was just sent. Please wait a minute before asking for another.' }, { status: 429 })
  }
  const sent = await startVerification(phone)
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 })
  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, sms_code_sent_at: new Date().toISOString() } })
  return NextResponse.json({ ok: true })
}
