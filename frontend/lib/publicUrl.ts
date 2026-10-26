import { lookup } from 'dns/promises'

/**
 * Whether the server may read this address: the public internet only. For
 * addresses an answer from the web shaped (lib/contactLookup.ts), so a page
 * can't point the server at itself, its network or a cloud's metadata. Its
 * name must resolve to a public address; check again at every redirect.
 * CONTACT_LOOKUP_ALLOW_PRIVATE=on lets local tests read a stand-in on this
 * machine (never in production).
 */
const PRIVATE = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^::$/, /^f[cd]/i, /^fe80/i, /^::ffff:/i]

export async function publicHost(url: URL): Promise<boolean> {
  if (process.env.CONTACT_LOOKUP_ALLOW_PRIVATE === 'on') return true
  const host = url.hostname.toLowerCase()
  if (!/^https?:$/.test(url.protocol) || !host.includes('.') || /\.(local|internal|localhost|lan)$/.test(host) || /^[\d.]+$|:/.test(host)) return false
  try {
    const { address } = await lookup(host)
    return !PRIVATE.some((re) => re.test(address))
  } catch {
    return false
  }
}
