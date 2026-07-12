'use client'

import { useEffect } from 'react'
import { loadPreferences, applyAccessibility, type UserPreferences } from '@/lib/preferences'

/**
 * Applies the user's accessibility settings to the document on mount and
 * whenever they change (same-tab custom event or cross-tab storage event).
 * Renders nothing. Mounted once in the root layout.
 */
export default function AccessibilityProvider() {
  useEffect(() => {
    applyAccessibility(loadPreferences().accessibility)
    const onPrefs = (e: Event) => {
      const prefs = (e as CustomEvent).detail as UserPreferences | undefined
      applyAccessibility((prefs || loadPreferences()).accessibility)
    }
    const onStorage = () => applyAccessibility(loadPreferences().accessibility)
    window.addEventListener('autinerary:prefs', onPrefs as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('autinerary:prefs', onPrefs as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
