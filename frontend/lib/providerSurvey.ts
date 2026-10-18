/**
 * The V1.5 survey (the planning note, October 2026, Goal 11: "Mass email to
 * services asking what they'd like to see"): what a service would like in its
 * Resource Account. ResourceHub's admin Requests page counts the answers
 * (servicehub-mvp/components/admin/RequestsQueue.tsx keeps the same labels).
 * Plain data, no imports.
 */
export const PROVIDER_WANTS = [
  { id: 'edit_details', label: 'Edit our details (description, phone, website)' },
  { id: 'hours', label: 'Show our opening hours' },
  { id: 'photos', label: 'Add photos' },
  { id: 'insights', label: 'See how people use our listing (counts only)' },
  { id: 'reply_comments', label: 'Reply to comments' },
  { id: 'booking_link', label: 'A booking or intake link' },
  { id: 'waitlist', label: 'Show our waitlist or availability' },
  { id: 'accessibility', label: 'Describe our accessibility and sensory setup' },
  { id: 'languages', label: 'List the languages we serve in' },
  { id: 'events', label: 'Post events and groups' },
  { id: 'promotions', label: 'Promotions (a sponsored place beside matching searches)' },
  { id: 'referrals', label: 'Get referrals from families' },
  { id: 'messages', label: 'Messages from families' },
  { id: 'verified_badge', label: 'A badge saying we checked our listing' },
] as const

export const isWant = (w: unknown) => PROVIDER_WANTS.some((p) => p.id === w)
