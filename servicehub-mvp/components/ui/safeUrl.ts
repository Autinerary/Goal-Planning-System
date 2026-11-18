/**
 * Links to other websites that come from data: a listing's website or source
 * page, a maker's page, the article a Tidbit reviews, a tracking or video link.
 *
 * Websites are often stored without "https://" ("example.ca"). As an href that
 * is a path inside ResourceHub, so the link opened one of our 404 pages, and a
 * stored "javascript:" value would have run when pressed (bug audit,
 * 17 November 2026, item 29). So https:// is added when there is no scheme,
 * and only http and https come back. null means "show it without a link".
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || value.length > 2048) return null

  // "example.ca:8080/page" starts like a scheme ("example.ca:") but is a host and port.
  const hostAndPort = /^[^\s/?#:@]+\.[^\s/?#:@]+:\d+(?:[/?#]|$)/.test(value)
  const scheme = hostAndPort ? null : /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase() ?? null
  if (scheme && scheme !== 'http' && scheme !== 'https') return null
  // "example.ca", "www.example.ca/contact" and "//example.ca" all become https://example.ca/…
  const candidate = scheme ? value : `https://${value.replace(/^[\\/]+/, '')}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  // A real website has a dotted name ("n/a", "none" and "TBD" don't), and no sign-in details in it.
  if (!url.hostname.includes('.') || url.username || url.password) return null
  return url.href
}
