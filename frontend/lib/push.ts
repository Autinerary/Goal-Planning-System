import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { accountPaused } from '@/lib/pause'

/**
 * Push notifications (Web Push), server-only. Riipen Labs, Group 2: "add email
 * and notification opt-in so a check-in can reach users who stop opening the
 * app". Devices are stored in public.push_subscriptions (STEP 47); the service
 * worker (public/sw.js) shows what arrives.
 *
 * Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (one key pair for
 * the app; `npx web-push generate-vapid-keys`), and VAPID_SUBJECT, a contact
 * the push services can use (mailto: or https:). Sends nothing without them.
 */

export interface PushMessage {
  title: string
  body: string
  /** Page to open when the notification is tapped (same site). */
  url: string
  /** Notifications with the same tag replace each other on the device. */
  tag?: string
}

export interface PushDevice {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Push services browsers actually use: Chrome, Edge-on-Android, Samsung and Opera (FCM), Firefox (Mozilla),
 * Safari (Apple) and Edge on Windows (WNS). A "device" anywhere else is refused: an endpoint on a server that
 * never answers would make every send to that account hang, and the people messaging it would wait too.
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function knownPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/** One device gets this long to answer; the whole send to a person gets PUSH_TOTAL_MS. */
const PUSH_TIMEOUT_MS = 5_000
const PUSH_TOTAL_MS = 6_000

export function pushEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )
  configured = true
}

export interface PushResult {
  /** 'gone': the device turned notifications off or was reset, so forget it. */
  result: 'sent' | 'gone' | 'failed'
  /** The push service's HTTP status, when it answered. */
  status?: number
}

export async function sendPush(device: PushDevice, message: PushMessage): Promise<PushResult> {
  if (!pushEnabled()) return { result: 'failed' }
  // Saved before the list of push services existed: forget it rather than wait on it.
  if (!knownPushEndpoint(device.endpoint)) return { result: 'gone' }
  configure()
  try {
    const res = await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(message),
      // Kept for a day if the device is offline; a check-in is not urgent.
      { TTL: 86_400, urgency: 'normal', timeout: PUSH_TIMEOUT_MS }
    )
    return { result: 'sent', status: res.statusCode }
  } catch (error: any) {
    const status: number | undefined = error?.statusCode
    const host = (() => {
      try {
        return new URL(device.endpoint).host
      } catch {
        return '?'
      }
    })()
    console.warn('[push] send failed:', host, status || error?.message, String(error?.body || '').slice(0, 200))
    return { result: status === 404 || status === 410 ? 'gone' : 'failed', status }
  }
}

/**
 * Send to every device a person turned notifications on for. Removes devices
 * the push service says are gone. Returns how many received it.
 */
export async function pushToUser(admin: SupabaseClient, userId: string, message: PushMessage): Promise<number> {
  // A paused account (Your profile) gets no notifications.
  if (await accountPaused(admin, userId)) return 0
  const { data: devices, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error || !devices?.length) return 0
  // All of a person's devices at once, so one slow device doesn't hold up the others.
  const results = await Promise.all(
    devices.map(async (device) => {
      const { result } = await sendPush(device as PushDevice, message)
      if (result === 'sent') {
        await admin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('endpoint', device.endpoint)
      } else if (result === 'gone') {
        await admin.from('push_subscriptions').delete().eq('endpoint', device.endpoint)
      }
      return result === 'sent'
    })
  )
  return results.filter(Boolean).length
}

/**
 * pushToUser with the service client made inside, never throwing: without
 * the service key (createAdminClient throws) or push, it sends nothing and
 * the request that asked carries on.
 */
export async function tryPushToUser(userId: string, message: PushMessage): Promise<number> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // The request that asked (a message, a friend request, a call) answers within a few seconds whatever the
    // push services do.
    let timer: ReturnType<typeof setTimeout> | undefined
    const cap = new Promise<number>((resolve) => {
      timer = setTimeout(() => resolve(0), PUSH_TOTAL_MS)
    })
    try {
      return await Promise.race([pushToUser(createAdminClient(), userId, message), cap])
    } finally {
      if (timer) clearTimeout(timer)
    }
  } catch {
    return 0
  }
}
