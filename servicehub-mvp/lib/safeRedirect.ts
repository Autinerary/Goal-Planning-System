/**
 * Where to send someone after signing in, kept to this site: the value is
 * resolved the way a browser would resolve it, and only a result on the same
 * origin is accepted. A string check alone ("starts with / but not //") lets
 * through '/\evil.example' and '/<tab>/evil.example', which browsers read as
 * '//evil.example', another site (bug audit, 17 November 2026, item 7).
 *
 * Returns the path, query and fragment on this site, or null when the value
 * is empty or would leave the site. Works the same in the browser and on the
 * server, since it never looks at the real origin.
 */
const SAME_SITE = 'https://same-site.invalid'

export function safeSameSitePath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw === '') return null
  // Only paths: a full address (even this site's) or a protocol-relative one is refused.
  if (!raw.startsWith('/')) return null
  let url: URL
  try {
    url = new URL(raw, SAME_SITE)
  } catch {
    return null
  }
  if (url.origin !== SAME_SITE) return null
  const path = `${url.pathname}${url.search}${url.hash}`
  // Belt and braces: what we hand back must itself be a plain path.
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null
  return path
}
