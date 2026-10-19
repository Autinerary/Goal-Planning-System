import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cronAuth'
import { emailEnabled, sendEmail, vendorDiscountEventEmail } from '@/lib/email'
import { postalAddress } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.autinerary.ca').replace(/\/$/, '')

/**
 * GET /api/cron/vendor-notices, once a day (vercel.json): tells product
 * vendors about a coming discount event (the products round's planning note,
 * Goal 10: "Give vendors notifications to their account + their email about
 * upcoming discounts & option to opt-in or out"), its notify_days_before
 * ahead. One notice per vendor and event, in their Resource Account; an
 * email too when email is set up (and only once). Off until the team turns
 * discounts on (NEXT_PUBLIC_SHOP_DISCOUNTS=on).
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (process.env.NEXT_PUBLIC_SHOP_DISCOUNTS !== 'on') return NextResponse.json({ skipped: 'discounts are off' })
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const { data: events, error } = await admin.from('discount_events').select('id, slug, name, description, starts_on, ends_on, suggested_percent, notify_days_before').gt('starts_on', today).limit(50)
  if (error) return NextResponse.json({ skipped: 'apply STEP 82' })
  const due = (events || []).filter((e) => {
    const notifyFrom = new Date(`${e.starts_on}T12:00:00`)
    notifyFrom.setDate(notifyFrom.getDate() - e.notify_days_before)
    return notifyFrom.toLocaleDateString('en-CA') <= today
  })
  if (!due.length) return NextResponse.json({ due: 0 })
  // Vendors who manage at least one product.
  const { data: claims } = await admin.from('listing_claims').select('user_id').eq('item_kind', 'product').eq('status', 'verified').limit(2000)
  const vendors = Array.from(new Set((claims || []).map((c) => c.user_id)))
  const postal = postalAddress()
  let notices = 0
  let emails = 0
  for (const e of due) {
    for (const userId of vendors) {
      const { data: made } = await admin
        .from('vendor_notifications')
        .upsert(
          {
            user_id: userId,
            kind: 'discount_event',
            ref: e.slug,
            title: `${e.name} is coming (${e.starts_on} to ${e.ends_on}).`,
            body: `Would you like to offer a discount${e.suggested_percent ? `, for example ${e.suggested_percent}% off` : ''}? Opt in or out on each product.`,
            link: `${APP}/business`,
          },
          { onConflict: 'user_id,kind,ref', ignoreDuplicates: true }
        )
        .select('id, emailed_at')
      if (!made?.length) continue
      notices += 1
      if (!emailEnabled() || !postal) continue
      const { data: u } = await admin.auth.admin.getUserById(userId)
      const to = u?.user?.email
      if (!to) continue
      const sent = await sendEmail({ to, ...vendorDiscountEventEmail({ name: e.name, starts: e.starts_on, ends: e.ends_on, percent: e.suggested_percent, link: `${APP}/business`, postal }), idempotencyKey: `vendor-event-${e.slug}-${userId}` })
      if (sent.ok) {
        emails += 1
        await admin.from('vendor_notifications').update({ emailed_at: new Date().toISOString() }).eq('id', made[0].id)
      }
    }
  }
  console.log('[vendor-notices]', JSON.stringify({ due: due.length, vendors: vendors.length, notices, emails }))
  return NextResponse.json({ due: due.length, vendors: vendors.length, notices, emails })
}

export const POST = GET
