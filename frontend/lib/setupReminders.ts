import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { snoozeUntil, type SetupReminderAsk } from '@/lib/reminderSchedule'

/**
 * Reminders to finish setup: asking for them, and the three choices every
 * reminder gives. Server-only.
 *
 * Riipen Labs, Group 24 (September 2026): "Every reminder gives three choices:
 * finish now, remind me in a few days, or stop reminders. No forced binary
 * between 'do it now' or 'never hear from us again'", in the email and in the
 * app, with "user-selected snooze intervals (e.g., 3 or 7 days)". Group 20:
 * reminders need "user consent", so nothing is sent unless asked for.
 *
 * The emails' links work without signing in. Each carries the account id and
 * a signature made with a server-only secret, so a link cannot be made for
 * someone else's account; it only snoozes or stops reminders, never shows
 * anything. Schedule: lib/reminderSchedule.ts (setupReminderDue). Sent by the
 * hourly run (lib/reminderRun.ts).
 */

export type SetupReminderAction = 'ask' | 'cancel' | 'snooze3' | 'snooze7' | 'stop' | 'clicked'

/** The in-app card's own state (components/NoPlanYet.tsx): hidden until a day, or for good. */
export interface SetupNudge {
  snoozeUntil?: string | null
  stoppedAt?: string | null
}

function key(): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', 'autinerary-setup-reminder-v1').update(secret).digest()
}

export function setupReminderSignature(userId: string): string {
  return createHmac('sha256', key()).update(userId).digest('base64url')
}

export function setupReminderSignatureMatches(userId: string, signature: string): boolean {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(userId || ''))) return false
    const expected = Buffer.from(setupReminderSignature(userId))
    const given = Buffer.from(String(signature || ''))
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}

/** The links every reminder email carries. */
export function setupReminderLinks(appUrl: string, userId: string): { finish: string; snooze3: string; snooze7: string; stop: string; oneClick: string } {
  const base = appUrl.replace(/\/$/, '')
  const q = `u=${encodeURIComponent(userId)}&t=${encodeURIComponent(setupReminderSignature(userId))}`
  return {
    finish: `${base}/onboarding?from=setup-reminder`,
    snooze3: `${base}/emails/setup-reminder?${q}&a=snooze3`,
    snooze7: `${base}/emails/setup-reminder?${q}&a=snooze7`,
    stop: `${base}/emails/setup-reminder?${q}&a=stop`,
    // Mail apps' one-click unsubscribe (List-Unsubscribe-Post).
    oneClick: `${base}/api/emails/setup-reminder?${q}&a=stop`,
  }
}

/**
 * Apply one choice to someone's reminders and in-app card, reading the saved
 * preferences first so nothing else in them is lost. Returns the new state.
 */
export async function applySetupReminderAction(
  admin: SupabaseClient,
  userId: string,
  action: SetupReminderAction,
  extra: { timeZone?: string; audience?: string | null; now?: Date } = {},
): Promise<{ setupReminder: SetupReminderAsk | null; setupNudge: SetupNudge | null }> {
  const now = extra.now || new Date()
  const { data: row } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  const prefs = (row?.preferences as Record<string, any>) || {}
  let ask: SetupReminderAsk | null = prefs.setupReminder || null
  let nudge: SetupNudge | null = prefs.setupNudge || null
  const stamp = now.toISOString()

  switch (action) {
    case 'ask':
      ask = {
        requestedAt: stamp,
        timeZone: extra.timeZone || ask?.timeZone,
        plan: 'sequence',
        audience: extra.audience ?? ask?.audience ?? null,
        sends: [],
        snoozes: 0,
      }
      break
    case 'cancel':
      ask = null
      break
    case 'snooze3':
    case 'snooze7': {
      const days = action === 'snooze3' ? 3 : 7
      const until = snoozeUntil(now, ask?.timeZone || extra.timeZone, days)
      if (ask?.plan === 'sequence' && !ask.stoppedAt) ask = { ...ask, snoozeUntil: until, snoozes: (ask.snoozes || 0) + 1 }
      nudge = { ...(nudge || {}), snoozeUntil: until }
      break
    }
    case 'stop':
      if (ask) ask = { ...ask, stoppedAt: stamp, snoozeUntil: null }
      nudge = { ...(nudge || {}), stoppedAt: stamp }
      break
    case 'clicked':
      if (ask) ask = { ...ask, clickedAt: stamp }
      break
  }

  const { error } = await admin.from('profiles').upsert({ id: userId, preferences: { ...prefs, setupReminder: ask, setupNudge: nudge } }, { onConflict: 'id' })
  if (error) throw new Error(error.message)
  return { setupReminder: ask, setupNudge: nudge }
}
