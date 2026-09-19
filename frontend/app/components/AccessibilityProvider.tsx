'use client'

import { useEffect } from 'react'
import { loadPreferences, applyAccessibility, applyLayout, type UserPreferences } from '@/lib/preferences'
import { recordVisit } from '@/lib/disclosure'
import { recordLoginDay } from '@/lib/streak'
import { useAuth } from '../context/AuthContext'
import { describeElement } from '@/lib/infoMode'

/**
 * Applies the user's accessibility settings to the document on mount and
 * whenever they change (same-tab custom event or cross-tab storage event).
 * Renders nothing. Mounted once in the root layout.
 */
export default function AccessibilityProvider() {
  const { user } = useAuth()

  useEffect(() => {
    let lastControl: Element | null = null
    let lastSpoken = 0
    const describe = (event: Event) => {
      if (!loadPreferences().accessibility.spokenDescriptions || !('speechSynthesis' in window)) return
      const target = event.target instanceof Element ? event.target : null
      const control = target?.closest('button, a, input, select, textarea, [role="button"], [data-info]')
      if (!control || control.closest('[data-speech-exempt="true"]')) return
      if (control === lastControl && Date.now() - lastSpoken < 700) return
      lastControl = control
      lastSpoken = Date.now()
      const description = describeElement(control)
      const utterance = new SpeechSynthesisUtterance([description.title, description.body].filter(Boolean).join('. '))
      utterance.lang = loadPreferences().language
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }
    const cancel = () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    document.addEventListener('click', describe, true)
    document.addEventListener('focusin', describe, true)
    document.addEventListener('keydown', escape)
    window.addEventListener('autinerary:prefs', cancel)
    return () => {
      cancel()
      document.removeEventListener('click', describe, true)
      document.removeEventListener('focusin', describe, true)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('autinerary:prefs', cancel)
    }
  }, [])

  useEffect(() => {
    const apply = (prefs: UserPreferences) => {
      applyAccessibility(prefs.accessibility)
      applyLayout(prefs)
    }
    apply(loadPreferences())
    // Record one visit per calendar day (idempotent) to drive progressive
    // disclosure (start simple → open up over time).
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

  // Streak day, only once we know someone is signed in — a logged-out visitor
  // landing on the marketing page must not build a streak.
  useEffect(() => {
    if (user) recordLoginDay()
  }, [user])

  return null
}
