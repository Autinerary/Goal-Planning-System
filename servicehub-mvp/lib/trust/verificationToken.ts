import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * One-time professional-attestation tokens.
 *
 * Only the SHA-256 hash is stored, so a database leak cannot be replayed to
 * forge a verification. The raw token exists only inside the link the user
 * hands to their clinician.
 */

/** 32 random bytes, url-safe. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time compare so we don't leak information through timing. */
export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** How long a link stays valid. */
export const VERIFICATION_TTL_DAYS = 14

/**
 * A browser that asked for a verification link for its own norm is marked
 * with this cookie, so the same browser can't then fill the link in itself
 * (bug audit, 17 November 2026, item 16). The value is a list of one-way
 * marks of the requesting accounts, never the account ids themselves. It only
 * ever refuses; a forged mark can block nobody but its forger.
 */
export const SELF_MARK_COOKIE = 'rh_nv_self'

export function selfMark(userId: string): string {
  return createHash('sha256').update(`norm-verification-self:${userId}`).digest('hex').slice(0, 32)
}

/** The cookie's marks with this account's added (at most five, newest kept). */
export function addSelfMark(existing: string | undefined, userId: string): string {
  const marks = (existing || '').split('.').filter((m) => /^[0-9a-f]{32}$/.test(m))
  const mark = selfMark(userId)
  return [mark, ...marks.filter((m) => m !== mark)].slice(0, 5).join('.')
}

export function hasSelfMark(cookie: string | undefined, userId: string): boolean {
  return (cookie || '').split('.').includes(selfMark(userId))
}
