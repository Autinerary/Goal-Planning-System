import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkVerification, maskPhone, normalizePhone, smsEnabled } from '@/lib/sms'

export const dynamic = 'force-dynamic'

/**
 * POST /api/me/sms/check { phone, code }: if the code is the one texted to
 * the number, reminders by text may go to it. The number is kept in the
 * account's app_metadata, which only the server can change, so it cannot be
 * set to someone else's number from the browser.
 */
export async function POST(req: NextRequest) {
  if (!smsEnabled()) return NextResponse.json({ error: 'Texts are not available yet.' }, { status: 404 })
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const phone = normalizePhone(body?.phone)
  const code = typeof body?.code === 'string' ? body.code.replace(/\D/g, '') : ''
  if (!phone || !/^\d{4,10}$/.test(code)) return NextResponse.json({ error: 'Enter the code from the text.' }, { status: 400 })
  if (!(await checkVerification(phone, code))) {
    return NextResponse.json({ error: 'That code did not match. Check the text, or ask for a new code.' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(user.id)
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(data?.user?.app_metadata || {}), sms_phone: phone, sms_verified_at: new Date().toISOString() },
  })
  if (error) return NextResponse.json({ error: 'The number could not be saved. Please try again.' }, { status: 500 })
  return NextResponse.json({ phone: maskPhone(phone) })
}
