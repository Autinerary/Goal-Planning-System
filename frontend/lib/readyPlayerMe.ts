/**
 * Ready Player Me integration.
 *
 * Why an iframe and a render API rather than three.js: RPM hosts the 3D
 * creator itself and renders finished avatars to PNG on their servers. That
 * gives us genuinely 3D-looking avatars (real geometry, real lighting) while
 * shipping ZERO 3D runtime in our bundle — which matters because the character
 * step sits at the highest-drop-off point in onboarding, and our users are
 * disproportionately on older phones.
 *
 * Everything here degrades: with no subdomain configured, isConfigured() is
 * false and the caller keeps the existing DiceBear vector avatar.
 */

/** Set NEXT_PUBLIC_RPM_SUBDOMAIN to the subdomain from studio.readyplayer.me. */
const SUBDOMAIN = (process.env.NEXT_PUBLIC_RPM_SUBDOMAIN || '').trim()

export const isConfigured = (): boolean => SUBDOMAIN.length > 0

/** Origin the creator iframe posts from — used to reject spoofed messages. */
export const RPM_ORIGIN = SUBDOMAIN ? `https://${SUBDOMAIN}.readyplayer.me` : ''

/**
 * Creator URL. `frameApi` is what makes the iframe emit postMessage events at
 * all; without it the avatar is created but never handed back.
 */
export function creatorUrl(opts: { bodyType?: 'fullbody' | 'halfbody'; clearCache?: boolean } = {}): string {
  if (!isConfigured()) return ''
  const q = new URLSearchParams({ frameApi: '' })
  if (opts.bodyType) q.set('bodyType', opts.bodyType)
  if (opts.clearCache) q.set('clearCache', '')
  return `${RPM_ORIGIN}/avatar?${q.toString()}`
}

/**
 * Pull the avatar id out of a .glb URL.
 * https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb -> 64bfa15f...
 */
export function avatarIdFrom(glbUrl: string | null | undefined): string | null {
  if (!glbUrl) return null
  const m = String(glbUrl).match(/\/([A-Za-z0-9_-]+)\.glb(?:\?|$)/)
  return m ? m[1] : null
}

/**
 * Server-rendered PNG portrait of a finished avatar — a plain <img> src, no
 * WebGL. Callers must still handle onError: the render service is a third
 * party and we treat any failure as "fall back to the vector avatar".
 */
export function portraitUrl(
  glbOrId: string | null | undefined,
  opts: { size?: number; scene?: string } = {}
): string | null {
  const id = avatarIdFrom(glbOrId) || (glbOrId && /^[A-Za-z0-9_-]{8,}$/.test(glbOrId) ? glbOrId : null)
  if (!id) return null
  const q = new URLSearchParams()
  q.set('scene', opts.scene || 'halfbody-portrait-v1')
  if (opts.size) q.set('size', String(opts.size))
  return `https://models.readyplayer.me/${id}.png?${q.toString()}`
}

/** Shape of the messages the creator iframe sends. */
export interface RpmEvent {
  source?: string
  eventName?: string
  data?: { url?: string; id?: string; [k: string]: unknown }
}

/** Parse a MessageEvent into an RPM event, or null if it isn't one. */
export function parseRpmEvent(e: MessageEvent): RpmEvent | null {
  let payload: unknown = e.data
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { return null }
  }
  const ev = payload as RpmEvent
  if (!ev || typeof ev !== 'object') return null
  if (ev.source !== 'readyplayerme') return null
  return ev
}

/** Told to the iframe once it loads, or it emits nothing. */
export const SUBSCRIBE_MESSAGE = JSON.stringify({
  target: 'readyplayerme',
  type: 'subscribe',
  eventName: 'v1.**',
})
