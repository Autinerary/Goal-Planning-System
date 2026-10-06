import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { maskPhone, smsEnabled } from '@/lib/sms'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/sms: whether reminders by text are offered (lib/sms.ts), and
 * which number, if any, the signed-in person has verified for them.
 * DELETE /api/me/sms: stop texting that number.
 */
export async function GET() {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  return NextResponse.json({
    available: smsEnabled(),
    phone: user ? maskPhone(user.app_metadata?.sms_phone as string | undefined) : null,
  })
}

export async function DELETE() {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(user.id)
  const meta = { ...(data?.user?.app_metadata || {}) }
  delete meta.sms_phone
  delete meta.sms_verified_at
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: meta })
  if (error) return NextResponse.json({ error: 'Could not remove the number' }, { status: 500 })
  return NextResponse.json({ phone: null })
}
