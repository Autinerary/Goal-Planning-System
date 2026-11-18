/**
 * A path on this site to go to after a link or a sign-in, or null when the value isn't one.
 *
 * Checking the raw text isn't enough. Browsers (and `new URL`) drop tabs and newlines and read a backslash as a slash,
 * so "/\t/evil.example" or "/\\evil.example" pass a `startsWith('//')` test and still leave the site. So the value is
 * resolved the way the browser will resolve it, and only a result on the same origin is kept.
 */
export function safeNextPath(raw: unknown, max = 500): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > max || !raw.startsWith('/')) return null
  const base = 'https://same-site.invalid'
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  const path = `${url.pathname}${url.search}${url.hash}`
  // "/.//evil.example" resolves to the path "//evil.example", which a browser reads as another site.
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}
