/**
 * Pictures in Tidbits (post and answer images, profile pictures) come only
 * from our own storage: the bucket /api/community/upload puts them in. Any
 * https address used to be accepted, so a post or a profile could show a
 * picture from anywhere, including one that tracks who looks at it (bug
 * audit, 17 November 2026, item 16).
 *
 * Also what /api/community/upload accepts: the picture's kind is read from
 * its first bytes, not from what the browser says, and SVG (which can carry
 * script) is never accepted.
 */

/** The Storage bucket community pictures are uploaded to. */
export const COMMUNITY_IMAGE_BUCKET = 'resource-images'

/** The public address every community picture starts with, or null when the project isn't configured. */
export function ownImagePrefix(base: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  const root = (base || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(root)) return null
  return `${root}/storage/v1/object/public/${COMMUNITY_IMAGE_BUCKET}/`
}

/** Whether `u` is a picture in our own community storage. */
export function isOwnImageUrl(u: unknown, base?: string): u is string {
  if (typeof u !== 'string' || u.length > 1000) return false
  const prefix = ownImagePrefix(base)
  if (!prefix || !u.startsWith(prefix)) return false
  try {
    // Read the way a browser would, so '..' or an encoded trick can't step
    // out of the bucket: what is left must still sit under it.
    const url = new URL(u)
    const plain = `${url.origin}${url.pathname}`
    return plain.startsWith(prefix) && plain.length > prefix.length
  } catch {
    return false
  }
}

/**
 * The picture addresses to save: our own storage only, no repeats, at most
 * `max`. Pictures already on the item (`previous`) are kept when edited, so
 * an older post doesn't lose a picture it already had.
 */
export function keptImageUrls(input: unknown, previous: readonly string[] = [], max = 6, base?: string): string[] {
  if (!Array.isArray(input)) return []
  const before = new Set(previous)
  const out: string[] = []
  for (const u of input) {
    if (typeof u !== 'string') continue
    if (!isOwnImageUrl(u, base) && !before.has(u)) continue
    if (!out.includes(u)) out.push(u)
    if (out.length >= max) break
  }
  return out
}

export interface SniffedImage {
  contentType: string
  ext: string
}

/**
 * The picture's kind from its first bytes: JPEG, PNG, GIF, WebP or AVIF, or
 * null for anything else (SVG, HTML, HEIC, a renamed file).
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const b = bytes
  const at = (i: number, ...vals: number[]) => vals.every((v, k) => b[i + k] === v)
  const ascii = (i: number, s: string) => at(i, ...Array.from(s).map((c) => c.charCodeAt(0)))
  if (b.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return { contentType: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: 'image/png', ext: 'png' }
  if (b.length >= 6 && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'))) return { contentType: 'image/gif', ext: 'gif' }
  if (b.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { contentType: 'image/webp', ext: 'webp' }
  if (b.length >= 12 && ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis'))) return { contentType: 'image/avif', ext: 'avif' }
  return null
}
