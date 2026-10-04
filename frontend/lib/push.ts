import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  configure()
  try {
    const res = await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(message),
      // Kept for a day if the device is offline; a check-in is not urgent.
      { TTL: 86_400, urgency: 'normal' }
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
  const { data: devices, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error || !devices?.length) return 0
  let sent = 0
  for (const device of devices) {
    const { result } = await sendPush(device as PushDevice, message)
    if (result === 'sent') {
      sent++
      await admin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('endpoint', device.endpoint)
    } else if (result === 'gone') {
      await admin.from('push_subscriptions').delete().eq('endpoint', device.endpoint)
    }
  }
  return sent
}
