import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stopCheckinEmails } from '@/lib/checkinToken'

export const dynamic = 'force-dynamic'

/**
 * The check-in email's one-click unsubscribe (List-Unsubscribe-Post), from a mail app: POST ?t=<token>, any body.
 * GET goes to the email's own stop link (/checkin?t=…&stop=1), with its button.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') || ''
  return NextResponse.redirect(new URL(`/checkin?t=${encodeURIComponent(t)}&stop=1`, req.nextUrl.origin), 303)
}

export async function POST(req: NextRequest) {
  try {
    if (!(await stopCheckinEmails(createAdminClient(), req.nextUrl.searchParams.get('t') || ''))) {
      return NextResponse.json({ error: 'This link has expired or is not valid.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not update your settings' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
