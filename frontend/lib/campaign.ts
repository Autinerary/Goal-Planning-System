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
}

/** Where a short link goes: /start with its tracking. */
export function campaignTarget(code: string): string {
  if (!CAMPAIGN_LINKS[code]) return '/start'
  const params = new URLSearchParams({ utm_source: code, utm_campaign: CAMPAIGN })
  return `/start?${params}`
}

// One welcome line for where someone came from, above Start here's first
// question (the cohort report: "vary the entry framing, social proof and
// follow-up"). Only what every visitor would also be told: no invented
// numbers or testimonials. Sources without a line get none.
const TRUST = 'You can look around without an account. No ads, and we never sell your information.'
const PEERS = 'Two quick questions, then places to start, and where to find advice from people with similar experiences.'
const WORK = 'Teachers, employers and support workers use Autinerary too, as well as people planning for themselves.'

const ENTRY_LINES: Record<string, { from: string; line: string }> = {
  facebook: { from: 'Facebook', line: TRUST },
  'parent-group': { from: 'your parent group', line: TRUST },
  tiktok: { from: 'TikTok', line: PEERS },
  reddit: { from: 'Reddit', line: PEERS },
  instagram: { from: 'Instagram', line: PEERS },
  linkedin: { from: 'LinkedIn', line: WORK },
  school: { from: 'your school', line: WORK },
}

/** "Welcome from TikTok." and its line, for a visit that arrived with that utm_source. */
export function entryLine(source: string | null): { welcome: string; line: string } | null {
  const entry = source ? ENTRY_LINES[source.trim().toLowerCase()] : undefined
  return entry ? { welcome: `Welcome from ${entry.from}.`, line: entry.line } : null
}
