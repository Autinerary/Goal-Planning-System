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
/**
 * Three days in (Riipen Labs, Group 12: "Trigger quick micro-surveys on Day 3
 * and Day 7 to gather actionable product feedback"). Day 7 is the usefulness
 * question; day 3 asks what, if anything, is in the way, while it can still
 * be fixed. Two answers are new (STEP 76); the rest are the stop reasons'.
 */
export const EARLY_REASONS = [
  { id: 'going_fine', label: 'It’s going well' },
  { id: 'too_much', label: 'There is too much to take in' },
  { id: 'unclear_next', label: 'I’m not sure what to do next' },
  { id: 'hard_to_find', label: 'I can’t find what I’m looking for' },
  { id: 'not_what_i_needed', label: 'It isn’t what I need' },
  { id: 'other', label: 'Something else' },
] as const

// 'feedback': the glossary's "Tell us how it's going", at any time (STEP 69),
// asked as the usefulness question plus a comment.
// 'early': the day-3 question (STEP 76; before it, kept as text on a
// usefulness check-in).
export type CheckinKind = 'inactive_email' | 'welcome_back' | 'usefulness' | 'feedback' | 'early'

/**
 * What the app can change, offered once someone answers. Riipen Labs Group
 * 10's model ends in "check-ins: adjust path with feedback and engagement";
 * the answers used to be stored and thanked, and nothing changed for the
 * person who gave them. Every option is something the app already does.
 * `simpler` also switches the Path to its simple view (lib/disclosure.ts).
 */
export interface Adjustment {
  id: string
  label: string
  /** An app path, or a ResourceHub path when `hub` is set. */
  href: string
  hub?: boolean
  simpler?: boolean
}

const NEW_GOAL: Adjustment = { id: 'new_goal', label: 'Try a different goal', href: '/onboarding' }
const RESOURCES: Adjustment = { id: 'resources', label: 'Find services and resources instead', href: '/start' }
const NEXT_STEP: Adjustment = { id: 'next_step', label: 'Show me just my next step', href: '/path', simpler: true }

export const ADJUSTMENTS: Record<string, Adjustment[]> = {
  not_yet: [NEW_GOAL, RESOURCES],
  not_useful_yet: [NEW_GOAL, RESOURCES],
  not_what_i_needed: [NEW_GOAL, RESOURCES],
  too_much: [NEXT_STEP],
  no_time: [NEXT_STEP, { id: 'emails', label: 'Change or turn off reminder emails', href: '/profile/settings#emails-heading' }],
  hard_to_find: [
    { id: 'start', label: 'Find it with Start here', href: '/start' },
    { id: 'search', label: 'Search ResourceHub', href: '/search', hub: true },
  ],
  unclear_next: [NEXT_STEP, { id: 'glossary', label: 'What things are called', href: '/help' }],
  just_exploring: [{ id: 'explore', label: 'See what Autinerary has', href: '/start' }],
}

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

