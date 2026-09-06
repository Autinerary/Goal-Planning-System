/**
 * Autinerary service worker.
 *
 * Deliberately conservative. A service worker that caches too eagerly is
 * worse than none at all: users get served a stale build indefinitely and
 * have no way to know, which for a planning app means acting on yesterday's
 * plan. So:
 *
 *   - API calls and auth are NEVER cached. Network only.
 *   - Pages are network-first: you always get the live version when online,
 *     and the cached copy only when the network genuinely fails.
 *   - Static build assets are cache-first, because Next.js fingerprints
 *     them — a changed file has a different URL, so a cached one can never
 *     be stale.
 *
 * Bumping CACHE_VERSION discards every old cache on the next activation.
 */
const CACHE_VERSION = 'autinerary-v1'
const OFFLINE_URL = '/offline'

// Never intercept these. Auth callbacks and API responses must always be
// live, and caching a session exchange would be a security problem.
const NEVER_CACHE = [/^\/api\//, /^\/auth\//, /\/_next\/webpack-hmr/]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => {})
  )
  // Take over immediately rather than waiting for every tab to close —
  // otherwise a fix can sit undelivered for days.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return

  // Fingerprinted build output: safe to serve from cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
      )
    )
    return
  }

  // Everything else: network first, cache only as a genuine offline fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.mode === 'navigate') {
          const copy = res.clone()
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(request)
        if (hit) return hit
        if (request.mode === 'navigate') {
          const offline = await caches.match(OFFLINE_URL)
          if (offline) return offline
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      })
  )
})
