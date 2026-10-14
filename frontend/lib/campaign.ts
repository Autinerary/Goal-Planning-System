/**
 * Short links for the October campaign: /c/<code> opens "Start here" with the
 * campaign's tracking (utm_source = the code).
 *
 * Riipen Labs, Group 5: "connect the October campaign (merch, comic,
 * research) directly to actual app sign-ups". Short enough to print on merch
 * or a comic, and to put behind a QR code (docs/campaign/). The funnel report
 * compares them by utm_source.
 *
 * Group 5 also suggested "channel-specific paths (e.g., trust/safety for
 * Facebook parents vs. peer tools for TikTok/Reddit adults)", so the Facebook,
 * TikTok and Reddit links used to answer Start here's two questions in
 * advance. Riipen Labs' cohort report (all 36 teams) asked for the opposite:
 * "use the same onboarding spine across channels, then vary the entry
 * framing", and "channel should not be used as a proxy for identity or need".
 * So every link now asks both questions, and only the welcome line changes
 * (ENTRY_LINES). Who actually arrives from each channel is then measured, not
 * assumed.
 */

export const CAMPAIGN = 'beta-oct-2026'

export const CAMPAIGN_LINKS: Record<string, { label: string }> = {
  merch: { label: 'Merch (QR code)' },
  comic: { label: 'The comic' },
  research: { label: 'Research posts and papers' },
  partners: { label: 'Community partners and role models' },
  facebook: { label: 'Facebook' },
  tiktok: { label: 'TikTok' },
  reddit: { label: 'Reddit' },
  // Riipen Labs, Group 15's channel profiles: X (Twitter) and in-person groups.
  x: { label: 'X (Twitter)' },
  'in-person': { label: 'In person: a group, meetup or event' },
}

/** Where a short link goes: /start with its tracking. */
export function campaignTarget(code: string): string {
  if (!CAMPAIGN_LINKS[code]) return '/start'
  const params = new URLSearchParams({ utm_source: code, utm_campaign: CAMPAIGN })
  return `/start?${params}`
}

/**
 * What Start here does for a visitor from each channel (Riipen Labs, Group
 * 15, "Five doors in, five different expectations"):
 *   Facebook groups: "Lead with a concrete, shareable first win"
 *   TikTok: "Match the video's energy in-app; no dry forms first"
 *   Reddit: "Show the 'why' and sourcing before asking for data"
 *   Twitter/X: "One-tap preview before any sign-up commitment"
 *   In-person groups: "Let them name who invited them; personalize opening
 *   screen"
 * The questions stay the same for everyone (the cohort report: "same
 * onboarding spine across channels ... channel should not be used as a proxy
 * for identity or need"); what changes is the welcome and one thing beside
 * it: a share button first (share), why we ask and where the lists come from
 * before the first question (sources), or a look at the app with a sample
 * plan (preview). In-person visitors can say who told them about Autinerary
 * in the questions after setup (components/OnboardingFeedback.tsx).
 */
export type EntryLead = 'share' | 'sources' | 'preview'

// Only what every visitor would also be told: no invented numbers or
// testimonials. Sources without a line get none.
const SHARE = 'Two quick questions, then a short list of places to start that you can open now, and share with your group in one tap. No account needed. No ads, and we never sell your information.'
const QUICK = 'Two taps, then real places to start. No forms, and no account.'
const SOURCED = 'Before you answer anything: why we ask, and where the lists come from, are just below.'
const PREVIEW = 'Look around first: no account and no email. Two taps to places to start, or see the app with a sample plan.'
const WORK = 'Teachers, employers and support workers use Autinerary too, as well as people planning for themselves.'
const IN_PERSON = 'Two quick questions, then places to start. If you make an account, you can tell us who pointed you here, so we can thank them.'

const ENTRY_LINES: Record<string, { from?: string; welcome?: string; line: string; lead?: EntryLead }> = {
  facebook: { from: 'Facebook', line: SHARE, lead: 'share' },
  'parent-group': { from: 'your parent group', line: SHARE, lead: 'share' },
  tiktok: { from: 'TikTok', line: QUICK },
  instagram: { from: 'Instagram', line: QUICK },
  reddit: { from: 'Reddit', line: SOURCED, lead: 'sources' },
  x: { from: 'X', line: PREVIEW, lead: 'preview' },
  twitter: { from: 'X', line: PREVIEW, lead: 'preview' },
  linkedin: { from: 'LinkedIn', line: WORK },
  school: { from: 'your school', line: WORK },
  'in-person': { welcome: 'Welcome. Someone you met in person shared this.', line: IN_PERSON },
  // A list someone shared from Start here (components/StartHere.tsx).
  share: { welcome: 'Someone shared this list with you.', line: 'It is free, and you don’t need an account to use it.' },
}

/** The welcome for a visit that arrived with that utm_source, and what to show beside it. */
export function entryLine(source: string | null): { welcome: string; line: string; lead?: EntryLead } | null {
  const entry = source ? ENTRY_LINES[source.trim().toLowerCase()] : undefined
  if (!entry) return null
  return { welcome: entry.welcome || `Welcome from ${entry.from}.`, line: entry.line, lead: entry.lead }
}

/** A link to a Start here list, to share with someone else (utm_source=share opens the list itself). */
export function sharedListUrl(origin: string, role: string, need: string): string {
  const params = new URLSearchParams({ for: role, need, utm_source: 'share' })
  return `${origin.replace(/\/$/, '')}/start?${params}`
}
