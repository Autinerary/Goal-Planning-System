'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadPreferences,
  DEFAULT_PREFERENCES,
  savePreferences,
  saveLayout,
  type UserPreferences,
  type LayoutPositions,
} from '@/lib/preferences'
import { PERSONAL_CLEARED_EVENT } from '@/lib/personalData'

let pendingWrites = 0
let preferenceRevision = 0
let writeQueue: Promise<boolean> = Promise.resolve(true)

// Someone signed out, or another account signed in (lib/personalData.ts): an account copy still being read is for
// the last person, so it is not written here when it arrives (the hydration below checks the revision).
if (typeof window !== 'undefined') window.addEventListener(PERSONAL_CLEARED_EVENT, () => { preferenceRevision++ })

function persistPreferences(patch: Partial<UserPreferences>) {
  pendingWrites++
  preferenceRevision++
  const request = writeQueue.then(async () => {
    try {
      const response = await fetch('/api/me/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(patch) })
      return response.ok
    } catch { return false }
    finally { pendingWrites-- }
  })
  writeQueue = request
  return request
}

/**
 * Live access to the user's view/interaction preferences. Updates in the same
 * tab (via the custom `autinerary:prefs` event) and across tabs (storage
 * event), so customization controls reflect instantly everywhere.
 */
export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [saveError, setSaveError] = useState('')
  // True once the server's copy has been read (or could not be): until then
  // prefs may be only this device's, e.g. on a new device.
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    const sync = () => setPrefs(loadPreferences())
    sync()
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
    const revision = preferenceRevision
    const localVersion = loadPreferences().updatedAt
    ;(async () => {
      try {
        const res = await fetch('/api/me/preferences', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled || pendingWrites > 0 || preferenceRevision !== revision || loadPreferences().updatedAt !== localVersion || !json?.preferences) return
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
      } finally {
        if (!cancelled) setSynced(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const update = useCallback(async (patch: Partial<UserPreferences>) => {
    setPrefs(savePreferences(patch))
    // Fire-and-forget server sync (skip device-only accessibility).
    const { accessibility, ...serverPatch } = patch
    if (Object.keys(serverPatch).length > 0) {
      const saved = await persistPreferences(serverPatch)
      setSaveError(saved ? '' : 'Saved on this device only. Account sync failed; try again when connected.')
      return saved
    }
    return true
  }, [])

  const updateLayout = useCallback(async (patch: Partial<LayoutPositions>) => {
    const next = saveLayout(patch)
    setPrefs(next)
    const saved = await persistPreferences({ layout: next.layout })
    setSaveError(saved ? '' : 'Saved on this device only. Account sync failed; try again when connected.')
    return saved
  }, [])

  return { prefs, update, updateLayout, saveError, synced }
}

/**
 * For what is typed into a field (a theme, a name, a note): shown and kept on this device at once, and saved to the
 * account when typing pauses, not once per key. The theme fields and the Alternate Persona sent one request for
 * every letter (bug audit, 17 November 2026). What is still waiting is sent when the page closes or is hidden.
 * Give it usePreferences' `update`.
 */
export function useTypedPreferences(update: (patch: Partial<UserPreferences>) => Promise<boolean>, delay = 800) {
  const waiting = useRef<Partial<UserPreferences> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestUpdate = useRef(update)
  latestUpdate.current = update

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const patch = waiting.current
    waiting.current = null
    if (patch) void latestUpdate.current(patch)
  }, [])

  const type = useCallback((patch: Partial<UserPreferences>) => {
    // At once on this device, and on every open page (the autinerary:prefs event).
    savePreferences(patch)
    waiting.current = { ...(waiting.current || {}), ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }, [flush, delay])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    // Signed out, or another account in: what the last person typed is not saved afterwards, here or to an account.
    const drop = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      waiting.current = null
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    window.addEventListener(PERSONAL_CLEARED_EVENT, drop)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener(PERSONAL_CLEARED_EVENT, drop)
      flush()
    }
  }, [flush])

  return { type, flush }
}
