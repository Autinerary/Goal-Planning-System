import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A paused account (Your profile → Take a break; app/api/me/pause) gets no
 * reminders, check-ins, weekly picks or notifications. Every sender asks
 * here. preferences.paused is { since, wasDiscoverable } while paused and
 * null after.
 */

export function isPaused(prefs: Record<string, any> | null | undefined): boolean {
  return Boolean(prefs?.paused && typeof prefs.paused === 'object' && prefs.paused.since)
}

/** The ids of paused accounts, for senders that start from another list. */
export async function pausedIds(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin.from('profiles').select('id').not('preferences->>paused', 'is', null)
  return new Set(((data || []) as { id: string }[]).map((r) => r.id))
}

/** The sign-in addresses of paused accounts, lowercased, for the newsletter. */
export async function pausedEmails(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin.from('profiles').select('email').not('preferences->>paused', 'is', null)
  return new Set(((data || []) as { email: string | null }[]).map((r) => (r.email || '').toLowerCase()).filter(Boolean))
}

/** Whether one account is paused. */
export async function accountPaused(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('paused:preferences->>paused').eq('id', userId).maybeSingle()
  return Boolean((data as { paused?: string | null } | null)?.paused)
}
