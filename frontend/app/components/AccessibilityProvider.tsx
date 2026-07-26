'use client'

import { useEffect } from 'react'
import { loadPreferences, applyAccessibility, applyLayout, type UserPreferences } from '@/lib/preferences'
import { recordVisit } from '@/lib/disclosure'

/**
 * Applies the user's accessibility settings to the document on mount and
 * whenever they change (same-tab custom event or cross-tab storage event).
 * Renders nothing. Mounted once in the root layout.
 */
export default function AccessibilityProvider() {
  useEffect(() => {
    const apply = (prefs: UserPreferences) => {
      applyAccessibility(prefs.accessibility)
      applyLayout(prefs)
    }
    apply(loadPreferences())
    // Record one visit per calendar day (idempotent) to drive progressive
    // disclosure (start simple → open up over time). Streak "active" days are
    // recorded on task completion, not app open (see app/tasks/[id]/page.tsx).
    recordVisit()
    const onPrefs = (e: Event) => {
      const prefs = (e as CustomEvent).detail as UserPreferences | undefined
      apply(prefs || loadPreferences())
    }
    const onStorage = () => apply(loadPreferences())
    window.addEventListener('autinerary:prefs', onPrefs as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('autinerary:prefs', onPrefs as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
