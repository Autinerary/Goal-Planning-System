import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** POST /api/shop/returns { order_id, reason }: start a return on a shipped or delivered order (STEP 82: the buyer may only start one). */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const orderId = String(b?.order_id || '')
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 500) || null : null
  const { error } = await supabase.from('order_returns').insert({ order_id: orderId, user_id: user.id, status: 'return_started', reason })
  if (error) return NextResponse.json({ error: 'A return can be started once the order has shipped.' }, { status: 400 })
  const { data: order } = await supabase.from('orders').select('vendor_user_id').eq('id', orderId).maybeSingle()
  if (order?.vendor_user_id) {
    await createAdminClient().from('vendor_notifications').upsert(
      { user_id: order.vendor_user_id, kind: 'order', ref: `return:${orderId}`, title: 'A return was started', body: reason ? `Reason: ${reason}` : null, link: `${(process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'https://app.autinerary.ca').replace(/\/$/, '')}/business#orders` },
      { onConflict: 'user_id,kind,ref', ignoreDuplicates: true }
    )
  }
  return NextResponse.json({ ok: true })
}
