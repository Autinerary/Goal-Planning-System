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
