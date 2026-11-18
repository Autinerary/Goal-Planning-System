/**
 * Paths on this site, for anything that sends people somewhere from a query
 * string or from data: `?next=` after signing in, and a notification's link.
 *
 * One rule for the whole of ResourceHub: lib/safeRedirect.ts resolves the
 * value the way a browser would and keeps it only if it stays on this site
 * (bug audit, 17 November 2026, items 1 and 7). These are its two uses on
 * screen, so a fix there covers both.
 */
import { safeSameSitePath } from '@/lib/safeRedirect'

/** The path, query and #part of `raw` when it stays on this site; otherwise null. */
export function sameSitePath(raw: unknown): string | null {
  return typeof raw === 'string' ? safeSameSitePath(raw) : null
}

/** Where to go after signing in: `raw` when it stays on this site, otherwise `fallback`. */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  return safeSameSitePath(raw) ?? fallback
}

/**
 * A link stored in data (a notification's), only when it is written as a path
 * on this site ('/resources/123'): no backslash or control characters either,
 * and still here once resolved. Otherwise null: show it without a link.
 */
export function sameSiteLink(raw: unknown): string | null {
  if (typeof raw !== 'string' || /[\\\u0000-\u001f\u007f]/.test(raw)) return null
  return safeSameSitePath(raw)
}
