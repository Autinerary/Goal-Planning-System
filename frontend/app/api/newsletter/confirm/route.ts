import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { newsletterListEmail, sendEmail } from '@/lib/email'
import { listLinks, postalAddress } from '@/lib/newsletter'
import { isStartGoal, pathwayTitle } from '@/lib/startHere'

export const dynamic = 'force-dynamic'

/**
 * POST /api/newsletter/confirm { token }: the person confirmed from their
 * email (a button press, so a mail scanner opening the link confirms
 * nothing). Sends the list they asked for, if they did.
 */
export async function POST(req: NextRequest) {
  const token = (await req.json().catch(() => null))?.token
  if (typeof token !== 'string' || token.length < 32) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: row } = await admin.from('newsletter_subscribers').select('*').eq('token', token).maybeSingle()
  if (!row || row.status === 'unsubscribed') return NextResponse.json({ error: 'This link has expired. You can ask again on autinerary.ca.' }, { status: 404 })
  const now = new Date().toISOString()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const patch: Record<string, unknown> = row.status === 'confirmed' ? {} : { status: 'confirmed', confirmed_at: now }
  let listSent = Boolean(row.list_sent_at)
  if (row.send_list && !row.list_sent_at && isStartGoal(row.need)) {
    const links = await listLinks(row.role, row.need)
    const title = pathwayTitle(row.role || 'unsure', row.need)
    const start = `${appUrl}/start?for=${row.role || 'unsure'}&need=${row.need}`
    const sent = await sendEmail({ ...newsletterListEmail(title, links, start, `${appUrl}/newsletter/unsubscribe?t=${row.token}`, postalAddress()), to: row.email })
    if (sent.ok) {
      patch.list_sent_at = now
      listSent = true
    }
  }
  if (Object.keys(patch).length) await admin.from('newsletter_subscribers').update(patch).eq('id', row.id)
  return NextResponse.json({ ok: true, weekly: row.weekly, list: row.send_list, listSent })
}
