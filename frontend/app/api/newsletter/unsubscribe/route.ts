import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/newsletter/unsubscribe?t=<token> (or { token }): stop every
 * email. Also the one-click unsubscribe that mail apps send
 * (List-Unsubscribe-Post), so it accepts any body.
 */
export async function POST(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get('t')
  const token = fromQuery || (await req.json().catch(() => null))?.token
  if (typeof token !== 'string' || token.length < 32) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: row } = await admin.from('newsletter_subscribers').select('id, status').eq('token', token).maybeSingle()
  if (!row) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })
  if (row.status !== 'unsubscribed') {
    await admin.from('newsletter_subscribers').update({ status: 'unsubscribed', weekly: false, unsubscribed_at: new Date().toISOString() }).eq('id', row.id)
  }
  return NextResponse.json({ ok: true })
}
