import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, sendEmail, welcomeEmail } from '@/lib/email'
import { isCandidate, isPaused } from '@/lib/welcomeBackfill'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** How many one request sends: with a short wait between each, well inside the time limit. */
const BATCH = 12

const chunks = <T,>(list: T[], n: number): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

/**
 * People who finished setup, were never welcomed, and may be (lib/welcomeBackfill.ts):
 * also a Path made, and not on a break.
 */
async function recipients(): Promise<User[]> {
  const admin = createAdminClient()
  const candidates: User[] = []
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    candidates.push(...data.users.filter(isCandidate))
    if (data.users.length < 1000) break
  }
  const withPath = new Set<string>()
  const paused = new Set<string>()
  for (const part of chunks(candidates.map((u) => u.id), 100)) {
    const [{ data: paths }, { data: profiles }] = await Promise.all([
      admin.from('user_paths').select('user_id').in('user_id', part),
      admin.from('profiles').select('id, preferences').in('id', part),
    ])
    for (const p of paths || []) withPath.add(p.user_id)
    for (const p of profiles || []) if (isPaused(p.preferences)) paused.add(p.id)
  }
  return candidates.filter((u) => withPath.has(u.id) && !paused.has(u.id))
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
 * The welcome email for people who finished setup before it existed (the
 * team's note, October 2026: "send a test email to each person welcoming
 * them to their account"). The team only (is_admin).
 *   GET                              how many would get it; sends nothing
 *   POST { confirm: 'send-welcome' } sends it to the next few, once each
 *                                    (the receipt app/api/me/welcome keeps),
 *                                    and says how many are left; the page
 *                                    asks again until none are
 */
export async function GET() {
  const denied = await teamOnly()
  if (denied) return denied
  const people = await recipients()
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
  const all = await recipients()
  const failedBefore = new Set<string>(Array.isArray(body?.failed) ? body.failed.filter((x: unknown) => typeof x === 'string') : [])
  const next = all.filter((u) => !failedBefore.has(u.id)).slice(0, BATCH)
  let sent = 0
  const failed: string[] = []
  for (const u of next) {
    const { subject, html, text } = welcomeEmail(appUrl)
    const result = await sendEmail({ to: u.email!, subject, html, text, idempotencyKey: `welcome-v1-${u.id}` })
    if (!result.ok) { failed.push(u.id); continue }
    await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, welcome_email_sent_at: new Date().toISOString(), welcome_email_id: result.id || null } })
    sent++
    // Gently: Resend allows a couple a second.
    await new Promise((r) => setTimeout(r, 600))
  }
  const remaining = all.length - sent - failedBefore.size - failed.length
  return NextResponse.json({ sent, failed, remaining: Math.max(0, remaining) })
}
