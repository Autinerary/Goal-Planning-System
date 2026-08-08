/**
 * Deterministic image placeholders.
 *
 * Products and services often have no photo yet (Odosa: "images aren't showing
 * up"). Rather than a blank grey box — or shipping fake photo URLs as data —
 * we generate a pleasant SVG data-URI from the item's own name + category.
 *
 * Why generated SVG rather than a placeholder service:
 *   - no network request, so it can never fail, 404, or be slow
 *   - deterministic: the same item always gets the same image
 *   - it's a *fallback*, not stored data — the moment a real image_url exists
 *     it wins, so nothing fake ever ends up in the database.
 */

/** Stable 32-bit hash of a string (FNV-1a). */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return Math.abs(h)
}

/** Gradient pairs — muted, on-brand, readable behind white text. */
const PALETTES: [string, string][] = [
  ['#6366f1', '#8b5cf6'], // indigo → violet
  ['#0ea5e9', '#2563eb'], // sky → blue
  ['#10b981', '#0d9488'], // emerald → teal
  ['#f59e0b', '#ea580c'], // amber → orange
  ['#ec4899', '#d946ef'], // pink → fuchsia
  ['#f43f5e', '#e11d48'], // rose
  ['#8b5cf6', '#6366f1'], // violet → indigo
  ['#14b8a6', '#0891b2'], // teal → cyan
]

/** Up to two initials from a name, e.g. "Loop Experience Earplugs" -> "LE". */
function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * An SVG data URI for an item with no photo.
 * @param name  item name — drives the initials and the colour choice
 * @param label small caption (e.g. the category) shown under the initials
 */
export function placeholderImage(name: string, label?: string): string {
  const safeName = (name || 'Item').trim() || 'Item'
  const [from, to] = PALETTES[hash(safeName) % PALETTES.length]
  const text = escapeXml(initials(safeName))
  const caption = label ? escapeXml(label.toUpperCase().slice(0, 22)) : ''

  // 400x400 square: gradient, two soft translucent circles, initials + caption.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/>
<circle cx="320" cy="90" r="130" fill="#ffffff" opacity="0.10"/>
<circle cx="70" cy="330" r="90" fill="#ffffff" opacity="0.08"/>
<text x="200" y="${caption ? 205 : 225}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="128" font-weight="700" fill="#ffffff" opacity="0.95">${text}</text>
${caption ? `<text x="200" y="260" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="22" font-weight="600" letter-spacing="2" fill="#ffffff" opacity="0.75">${caption}</text>` : ''}
</svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ''))}`
}

/** Real image if there is one, otherwise a generated placeholder. */
export function imageOrPlaceholder(
  url: string | null | undefined,
  name: string,
  label?: string
): string {
  const trimmed = (url || '').trim()
  return trimmed ? trimmed : placeholderImage(name, label)
}
