const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

/**
 * Resolve a tool/resource into a link that always goes somewhere useful.
 *
 * Many agent- and demo-sourced tools ship without a real URL (they use '#'
 * or a relative value). Rendering those as <a href="#"> makes the click just
 * reopen the current app page — the bug Madhu reported for BPN / ISA / ALT.
 *
 * Instead, when there's no valid external URL we fall back to a ResourceHub
 * search for the tool's name, so the user lands on the matching resource
 * rather than a dead anchor.
 */
export function resolveToolLink(url?: string | null, name?: string): { href: string; usable: boolean } {
  const clean = fromDevHost((url || '').trim())
  if (clean && clean !== '#' && /^https?:\/\//i.test(clean)) {
    return { href: clean, usable: true }
  }
  const q = (name || '').trim()
  const href = q ? `${SERVICE_HUB_URL}/search?q=${encodeURIComponent(q)}` : `${SERVICE_HUB_URL}/search`
  // Not a real external URL — routed to ResourceHub search as a useful fallback.
  return { href, usable: false }
}

/**
 * Paths generated while the backend had no SERVICE_HUB_URL set link venues to
 * http://localhost:3001/resources/<id>, which only works on a developer's
 * machine (found by the functional check, Riipen Labs Group 3). Those links,
 * already stored in people's paths, are pointed at the real ResourceHub.
 */
function fromDevHost(url: string): string {
  const m = url.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i)
  if (!m) return url
  return `${SERVICE_HUB_URL.replace(/\/$/, '')}${m[3] || '/'}`
}

