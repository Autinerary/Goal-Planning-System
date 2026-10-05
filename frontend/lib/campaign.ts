/**
 * Short links for the October campaign: /c/<code> opens "Start here" with the
 * campaign's tracking (utm_source = the code), and answers its questions in
 * advance where the audience is known.
 *
 * Riipen Labs, Group 5: "connect the October campaign (merch, comic,
 * research) directly to actual app sign-ups", and "channel-specific paths
 * (e.g., trust/safety for Facebook parents vs. peer tools for TikTok/Reddit
 * adults)". Short enough to print on merch or a comic, and to put behind a QR
 * code (docs/campaign/). The funnel report compares them by utm_source.
 */

export const CAMPAIGN = 'beta-oct-2026'

export const CAMPAIGN_LINKS: Record<string, { label: string; for?: string; need?: string }> = {
  merch: { label: 'Merch (QR code)' },
  comic: { label: 'The comic' },
  research: { label: 'Research posts and papers' },
  partners: { label: 'Community partners and role models' },
  // Parents: starter information first, with the trust line under it.
  facebook: { label: 'Facebook (parents)', for: 'child', need: 'learn' },
  // Adults: peer tools, which start with Tidbits.
  tiktok: { label: 'TikTok (adults)', for: 'self', need: 'community' },
  reddit: { label: 'Reddit (adults)', for: 'self', need: 'community' },
}

/** Where a short link goes: /start with its answers and tracking. */
export function campaignTarget(code: string): string {
  const link = CAMPAIGN_LINKS[code]
  if (!link) return '/start'
  const params = new URLSearchParams()
  if (link.for) params.set('for', link.for)
  if (link.need) params.set('need', link.need)
  params.set('utm_source', code)
  params.set('utm_campaign', CAMPAIGN)
  return `/start?${params}`
}
