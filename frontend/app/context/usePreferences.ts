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

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs(savePreferences(patch))
  }, [])

  const updateLayout = useCallback((patch: Partial<LayoutPositions>) => {
    setPrefs(saveLayout(patch))
  }, [])

  return { prefs, update, updateLayout }
}
