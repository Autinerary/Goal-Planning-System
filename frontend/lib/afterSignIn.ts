import { safeNextPath } from './safeNext'

/**
 * Where to go after signing in, when a link was opened signed out (bug audit, 17 November 2026: "Signed-out deep
 * links lose their destination"). The app's sign-in guard sends a signed-out visit to /login?next=<that page>
 * (app/context/AuthContext.tsx); after sign-in the person goes back there.
 *
 * Only a page of this site (lib/safeNext.ts), and never a sign-in or setup page, which would only send them round
 * again. Null means "the usual place" (the Path).
 */
const NOT_AFTER_SIGN_IN = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/age', '/auth/callback', '/onboarding'])

export function afterSignInPath(raw: unknown): string | null {
  const next = safeNextPath(raw)
  if (!next) return null
  const path = next.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return NOT_AFTER_SIGN_IN.has(path) ? null : next
}

/** The sign-in page's address for a signed-out visit to `path` (its query and hash included). */
export function loginHrefFor(path: string): string {
  const next = afterSignInPath(path)
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login'
}
