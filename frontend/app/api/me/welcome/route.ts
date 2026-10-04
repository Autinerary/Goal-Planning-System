import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, sendEmail, welcomeEmail } from '@/lib/email'

export async function POST(req: Request) {
  const supabase = createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!user.email) return NextResponse.json({ error: 'Account email required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(user.id)
  if (accountError || !account.user) return NextResponse.json({ error: 'Account lookup failed' }, { status: 503 })
  if (account.user.app_metadata?.welcome_email_sent_at) return NextResponse.json({ sent: true, alreadySent: true })

  const { data: paths, error: pathError } = await admin.from('user_paths').select('path_id').eq('user_id', user.id).limit(1)
  if (pathError) return NextResponse.json({ error: 'Unable to verify onboarding' }, { status: 503 })
  if (!paths?.length || user.user_metadata?.has_completed_onboarding !== true) {
    return NextResponse.json({ error: 'Complete onboarding first' }, { status: 409 })
  }
  if (!emailEnabled()) return NextResponse.json({ sent: false, reason: 'Email delivery is not configured' }, { status: 503 })

  // With a button to the Path, like the reminder and check-in emails.
  const { subject, html, text } = welcomeEmail(process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin)
  const result = await sendEmail({ to: user.email, subject, html, text, idempotencyKey: `welcome-v1-${user.id}` })
  if (!result.ok) return NextResponse.json({ sent: false, error: 'Email delivery failed' }, { status: 502 })

  const { error: receiptError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...account.user.app_metadata, welcome_email_sent_at: new Date().toISOString(), welcome_email_id: result.id || null },
  })
  if (receiptError) return NextResponse.json({ sent: true, receiptSaved: false }, { status: 202 })
  return NextResponse.json({ sent: true })
}