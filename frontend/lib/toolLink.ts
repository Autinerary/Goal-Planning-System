import { goHubHref } from '@/lib/serviceHub'

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
    return { href: viaHandoff(clean), usable: true }
  }
  const q = (name || '').trim()
  // Not a real external URL — routed to ResourceHub search as a useful
  // fallback, through the hand-off so the person arrives signed in.
  return { href: goHubHref(q ? `/search?q=${encodeURIComponent(q)}` : '/search'), usable: false }
}

/**
 * A ResourceHub link goes through the app's hand-off (lib/serviceHub.ts), so
 * the person arrives signed in and can save it: it used to arrive signed out
 * and ask for a second sign-in (Riipen Labs, Groups 22 and 24). Any other
 * link is left as it is.
 */
function viaHandoff(href: string): string {
  try {
    const hub = new URL(SERVICE_HUB_URL)
    const target = new URL(href)
    if (target.origin !== hub.origin) return href
    return goHubHref(`${target.pathname}${target.search}${target.hash}`)
  } catch {
    return href
  }
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

