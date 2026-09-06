'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker that makes Autinerary installable.
 *
 * Registration is deliberately deferred until after load: a service worker
 * competing with the first paint for bandwidth makes the app feel slower on
 * exactly the low-end phones this is meant to help.
 *
 * Skipped entirely in development — a cached dev build is a genuinely
 * miserable debugging experience, and next dev already handles reloading.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Not fatal — the app works fine without it, it just isn't installable.
        console.warn('Service worker registration failed:', err?.message ?? err)
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
