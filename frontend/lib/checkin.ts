/**
 * Check-in questions (Riipen Labs, Group 2: "ask active users about
 * usefulness and inactive users why they disengaged"). Shared by the email
 * check-in page, the in-app prompts and the API route, which validates
 * answers against these same lists.
 */

export const STOP_REASONS = [
  { id: 'too_much', label: 'It was too much to set up or learn' },
  { id: 'not_what_i_needed', label: "It wasn't what I needed" },
  { id: 'hard_to_find', label: "I couldn't find what I was looking for" },
  { id: 'no_time', label: "I didn't have time" },
  { id: 'not_useful_yet', label: "It hasn't been useful yet" },
  { id: 'just_exploring', label: 'I was just exploring' },
  { id: 'other', label: 'Something else' },
] as const

export const USEFULNESS = [
  { id: 'very', label: 'Very useful' },
  { id: 'somewhat', label: 'Somewhat' },
  { id: 'not_yet', label: 'Not yet' },
] as const

export type CheckinKind = 'inactive_email' | 'welcome_back' | 'usefulness'

// Away this long before the email check-in or the welcome-back question.
export const AWAY_DAYS = 14

const SEEN_KEY = 'autinerary_checkin_seen_day'

/**
 * Tell the server this person opened the app today, once a day per browser,
 * so the check-in email only goes to people who have really been away. The
 * server stores it only for people who opted in to that email. Separate from
 * analytics on purpose: it must work when the browser asks not to be tracked.
 */
export function markSeenToday(): void {
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(SEEN_KEY) === today) return
    localStorage.setItem(SEEN_KEY, today)
    void fetch('/api/checkin/seen', { method: 'POST', credentials: 'include', keepalive: true }).catch(() => {})
  } catch {}
}

