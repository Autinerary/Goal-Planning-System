/**
 * A basic limit on how often one caller may do something, for routes that cost
 * money (AI calls) or can be abused (sign-up, sponsored clicks). Server only.
 *
 * Counts are kept in this server instance's memory, so they are per instance
 * and reset when it restarts: a speed bump, not a guarantee. That is enough to
 * stop one script from running up a bill or flooding a form; anything that has
 * to hold exactly belongs in the database. The same approach as
 * app/api/resources/[id]/google-rating.
 */

const buckets = new Map<string, Map<string, number[]>>()
const MAX_KEYS = 5000

/**
 * The caller's address as Vercel reports it (the first x-forwarded-for entry,
 * which Vercel sets itself), or 'unknown'.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for') || ''
  const first = forwarded.split(',')[0]?.trim()
  return first || headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Record one attempt by `key` in `bucket` and say whether it is over the
 * limit: true means refuse (more than `limit` attempts within `windowMs`).
 * A refused attempt is not counted, so waiting is always enough.
 */
export function rateLimited(bucket: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  let seen = buckets.get(bucket)
  if (!seen) {
    seen = new Map()
    buckets.set(bucket, seen)
  }
  const recent = (seen.get(key) || []).filter((t) => now - t < windowMs)
  // Re-inserted so the Map's order is "least recently seen first".
  seen.delete(key)
  if (recent.length >= limit) {
    seen.set(key, recent)
    return true
  }
  recent.push(now)
  seen.set(key, recent)
  // Keep memory bounded: forget the oldest callers first (a Map keeps insertion order).
  if (seen.size > MAX_KEYS) {
    for (const k of seen.keys()) {
      seen.delete(k)
      if (seen.size <= MAX_KEYS * 0.9) break
    }
  }
  return false
}

/** The answer when a caller is over a limit: plain and kind. */
export const TOO_MANY_MESSAGE = 'That was a lot of tries in a short time. Please wait a few minutes and try again.'
