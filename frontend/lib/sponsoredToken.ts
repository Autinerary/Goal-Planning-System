// A copy of servicehub-mvp/lib/sponsoredToken.ts (the main app shows a sponsored service in Paths too).
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Counting sponsored listings honestly. Server only.
 *
 * A promotion is paid by the click (lib/sponsored.ts), and a click used to be
 * counted for anyone who posted a promotion's id to app/api/sponsored/event:
 * a script could spend a business's budget (bug audit, 17 November 2026,
 * item 16). Now:
 *   - serving a promotion (app/api/search/sponsored) comes with a signed token
 *     for that promotion, place and viewer, and a view or a click is counted
 *     only with a token that is valid, unexpired and theirs;
 *   - a signed-out viewer is one address (their IP), not address and browser,
 *     so changing the browser's name doesn't make a new viewer.
 *
 * Kept apart from lib/sponsored.ts, which must stay the same as the app's copy
 * (scripts/qa/check-sponsored.mjs). The signed-in viewer key is the same as
 * lib/sponsored.ts's viewerKey.
 */

/** A token is good for a day after the listing was shown. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
// Servers' clocks can differ a little.
const CLOCK_SKEW_MS = 5 * 60 * 1000

const secret = () => process.env.PROMOTION_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'autinerary'

const forwardedIp = (headers: Headers) => (headers.get('x-forwarded-for') || '').split(',')[0].trim()

/** Who is looking: the signed-in person, or else the address alone. Never stored as it is. */
function viewerIdentity(userId: string | null, headers: Headers): string {
  return userId ? `u:${userId}` : `a:${forwardedIp(headers)}`
}

/**
 * Who saw or clicked, as a key that changes every day and can't be turned
 * back into a person or an address (as lib/sponsored.ts's viewerKey, with a
 * signed-out viewer keyed by their address only).
 */
export function viewerKeyByIp(userId: string | null, headers: Headers, now = Date.now()): string {
  const day = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  return createHmac('sha256', secret()).update(`${day}|${viewerIdentity(userId, headers)}`).digest('hex')
}

function sign(promotionId: string, placement: string, who: string, issuedAt: number): string {
  return createHmac('sha256', secret()).update(`promotion-token|${promotionId}|${placement}|${who}|${issuedAt}`).digest('hex')
}

/** The token served with a promotion: "<issued at, ms>.<signature>". */
export function impressionToken(
  promotionId: string,
  placement: string,
  userId: string | null,
  headers: Headers,
  now = Date.now()
): string {
  return `${now}.${sign(promotionId, placement, viewerIdentity(userId, headers), now)}`
}

/**
 * Whether a token was served by us, for this promotion and place, to this
 * same viewer, within the last day. Compared in constant time.
 */
export function validImpressionToken(
  token: unknown,
  promotionId: string,
  placement: string,
  userId: string | null,
  headers: Headers,
  now = Date.now()
): boolean {
  if (typeof token !== 'string' || token.length > 100) return false
  const m = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(token)
  if (!m) return false
  const issuedAt = Number(m[1])
  if (!Number.isSafeInteger(issuedAt) || now - issuedAt > TOKEN_TTL_MS || issuedAt - now > CLOCK_SKEW_MS) return false
  const expected = Buffer.from(sign(promotionId, placement, viewerIdentity(userId, headers), issuedAt), 'hex')
  const given = Buffer.from(m[2], 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
