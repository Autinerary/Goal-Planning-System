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
  // Supabase Auth merges app_metadata: a key that is left out is kept, and only null removes it. Deleting the keys
  // from the object before sending it used to keep the number, and reminders kept texting it.
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { sms_phone: null, sms_verified_at: null } })
  if (error) return NextResponse.json({ error: 'Could not remove the number' }, { status: 500 })
  return NextResponse.json({ phone: null })
}
