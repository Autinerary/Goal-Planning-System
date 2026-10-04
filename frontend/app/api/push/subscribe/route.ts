import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushEnabled, sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

/**
 * POST   /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
 *        Turn notifications on for this device (PushOptIn), and send one
 *        straight away so the person can see they work.
 * DELETE /api/push/subscribe  { endpoint }
 *        Turn them off for this device.
 *
 * Signed-in only. Stored in public.push_subscriptions (STEP 47) with the
 * service role; a device's keys are never sent back to the browser.
 */

const B64URL = /^[A-Za-z0-9_-]+=*$/

async function signedInUser() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!pushEnabled()) return NextResponse.json({ error: 'Notifications are not set up yet.' }, { status: 503 })
  const user = await signedInUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  const keyOk = (k: unknown, max: number) => typeof k === 'string' && k.length <= max && B64URL.test(k)
  if (!validEndpoint(endpoint) || !keyOk(p256dh, 200) || !keyOk(auth, 100)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const admin = createAdminClient()
  // The endpoint identifies the device, so a device that turns notifications
  // on again, or is now used by someone else, replaces its row.
  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ endpoint, user_id: user.id, p256dh, auth, created_at: new Date().toISOString() }, { onConflict: 'endpoint' })
  if (error) {
    console.error('[push] subscribe failed:', error.message)
    return NextResponse.json({ error: 'Notifications are not available yet.' }, { status: 503 })
  }

  const confirmation = await sendPush(
    { endpoint, p256dh, auth },
    {
      title: 'Notifications are on',
      body: "This is how Autinerary will check in if you haven't opened it for two weeks.",
      url: '/path',
      tag: 'push-on',
    }
  )
  return NextResponse.json({ ok: true, confirmation })
}

export async function DELETE(req: NextRequest) {
  const user = await signedInUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!validEndpoint(body?.endpoint)) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not turn notifications off' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
