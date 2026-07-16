'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  loadPreferences,
  savePreferences,
  saveLayout,
  type UserPreferences,
  type LayoutPositions,
} from '@/lib/preferences'

/**
 * Live access to the user's view/interaction preferences. Updates in the same
 * tab (via the custom `autinerary:prefs` event) and across tabs (storage
 * event), so customization controls reflect instantly everywhere.
 */
export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences)

  useEffect(() => {
    const sync = () => setPrefs(loadPreferences())
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as UserPreferences | undefined
      setPrefs(detail || loadPreferences())
    }
    window.addEventListener('storage', sync)
    window.addEventListener('autinerary:prefs', onCustom as EventListener)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('autinerary:prefs', onCustom as EventListener)
    }
  }, [])

  // Hydrate from the server once on mount so customizations follow the user
  // across devices. Server values seed anything not already set locally; the
  // merged result is written back to localStorage and broadcast.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me/preferences', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled || !json?.preferences) return
        const server = json.preferences as Partial<UserPreferences>
        const local = loadPreferences()
        // Prefer server as the source of truth for layout/view (last saved wins),
        // but keep local accessibility which is intentionally device-scoped.
        const merged = savePreferences({
          ...server,
          accessibility: local.accessibility,
        })
        setPrefs(merged)
      } catch {
        /* offline — keep local */
      }
    })()
    return () => { cancelled = true }
  }, [])

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs(savePreferences(patch))
    // Fire-and-forget server sync (skip device-only accessibility).
    const { accessibility, ...serverPatch } = patch
    if (Object.keys(serverPatch).length > 0) {
      fetch('/api/me/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(serverPatch),
      }).catch(() => {/* localStorage already has it */})
    }
  }, [])

  const updateLayout = useCallback((patch: Partial<LayoutPositions>) => {
    setPrefs(saveLayout(patch))
    fetch('/api/me/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ layout: patch }),
    }).catch(() => {/* localStorage already has it */})
  }, [])

  return { prefs, update, updateLayout }
}
