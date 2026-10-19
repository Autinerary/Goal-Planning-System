import type { User } from '@supabase/supabase-js'

/**
 * Who gets the welcome email that came after they finished setup (the team's
 * note, October 2026: "send a test email to each person welcoming them to
 * their account"; app/api/admin/welcome). The same rules as the one sent
 * after setup (app/api/me/welcome: setup finished, and a Path made), and
 * more careful: nobody under 18, nobody who paused their account, nobody
 * locked, and not the team's own or made-up test accounts.
 */

// Team, test and made-up accounts, by email (backend/scripts/vector_evaluation_pull.py).
const TEAM_TEST = ['superautism@gmail.com', 'noreply.psapon@gmail.com', 'aayush_bhan@hotmail.com', 'bhanaayush@gmail.com']

export function notAPerson(email: string): boolean {
  const e = email.toLowerCase()
  return (
    e.startsWith('test') || e.startsWith('child') || e.includes('test.account') || e.endsWith('@test.com') || e.includes('synthetic+') ||
    e.endsWith('@autinerary.dev') || e.endsWith('.test') || e.startsWith('aayush+') || TEAM_TEST.includes(e)
  )
}

/** Before looking up paths and pauses: finished setup, no welcome yet, and fine to email. */
export function isCandidate(u: Pick<User, 'email' | 'user_metadata' | 'app_metadata' | 'banned_until'>): boolean {
  return Boolean(
    u.email && !notAPerson(u.email) && u.user_metadata?.has_completed_onboarding === true && !u.app_metadata?.welcome_email_sent_at &&
      !u.banned_until && !u.app_metadata?.managed_by_guardian && !u.user_metadata?.managed_by_guardian
  )
}

/** What a profile says about being on a break (app/api/me/pause). */
export const isPaused = (preferences: unknown): boolean => Boolean((preferences as { paused?: unknown } | null)?.paused)
