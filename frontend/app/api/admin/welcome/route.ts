import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, sendEmail, welcomeEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Team, test and made-up accounts, by email, as the reports tell them apart
// (backend/scripts/vector_evaluation_pull.py).
const notAPerson = (email: string) => {
  const e = email.toLowerCase()
  return e.startsWith('test') || e.startsWith('child') || e.includes('test.account') || e.endsWith('@test.com') || e.includes('synthetic+') || e.endsWith('@autinerary.dev') || e.endsWith('.test')
}

/** People who finished setup and never got the welcome email (it began in October 2026). */
async function notWelcomed(): Promise<User[]> {
  const admin = createAdminClient()
  const out: User[] = []
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email && !notAPerson(u.email) && u.user_metadata?.has_completed_onboarding === true && !u.app_metadata?.welcome_email_sent_at && !u.banned_until) out.push(u)
    }
    if (data.users.length < 1000) break
  }
  return out
}

async function teamOnly() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return isAdmin === true ? null : NextResponse.json({ error: 'Team only.' }, { status: 403 })
}

/**
 * The welcome email for people who finished setup before it existed (Odosa,
 * October 2026: "Test email notifications by sending a test email to each
 * person welcoming them to their account"). The team only (admin_users).
 *   GET                              how many would get it; sends nothing
 *   POST { confirm: 'send-welcome' } sends it, once per person (the same
 *                                    receipt as after setup: app/api/me/welcome)
 */
export async function GET() {
  const denied = await teamOnly()
  if (denied) return denied
  const people = await notWelcomed()
  return NextResponse.json({ count: people.length, canSend: emailEnabled() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const denied = await teamOnly()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'send-welcome') return NextResponse.json({ error: 'Confirm first.' }, { status: 400 })
  if (!emailEnabled()) return NextResponse.json({ error: 'Email delivery is not set up.' }, { status: 503 })
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  let sent = 0
  let failed = 0
  for (const u of await notWelcomed()) {
    const { subject, html, text } = welcomeEmail(appUrl)
    const result = await sendEmail({ to: u.email!, subject, html, text, idempotencyKey: `welcome-v1-${u.id}` })
    if (!result.ok) { failed++; continue }
    await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, welcome_email_sent_at: new Date().toISOString(), welcome_email_id: result.id || null } })
    sent++
    // Gently: Resend allows a few a second.
    await new Promise((r) => setTimeout(r, 600))
  }
  return NextResponse.json({ sent, failed })
}
