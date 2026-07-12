// User View & Interaction Preferences
//
// Captures how each user wants the app to look and behave, plus where they've
// placed customizable features. Recording these lets us learn from intersecting
// profiles (e.g. "seniors with ADHD prefer plain + large" vs "young adults with
// OCD prefer exciting"). Stored in localStorage for instant UX and mirrored to
// the profile on onboarding submit so it survives across devices.
//
// Every "view mode" is still gamified (a checklist of tasks made fun) — these
// preferences only tune HOW MUCH visual energy we apply, not whether the
// journey is a game.

export type AgeRange = '18-40' | '40-65' | '65+'
export type TechSavvy = 'not_at_all' | 'somewhat' | 'always'
export type ViewPreference = 'plain' | 'pretty' | 'exciting' | 'fun'

export interface LayoutPositions {
  /** Which side the Races pinwheel/spinner sits on. */
  pinwheelSide: 'left' | 'right'
  /** Relative scale for key interactive widgets. */
  widgetSize: 'small' | 'medium' | 'large'
  /** Accent color theme key. */
  accent: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose'
}

export interface UserPreferences {
  ageRange: AgeRange | ''
  techSavvy: TechSavvy | ''
  viewPreference: ViewPreference | ''
  layout: LayoutPositions
  /** Accessibility settings applied globally to the document. */
  accessibility: AccessibilitySettings
  /** UI language code (BCP-47-ish, e.g. "en", "es", "fr"). */
  language: string
  /** ISO timestamp of last update — useful for analytics. */
  updatedAt?: string
}

export type FontScale = 'default' | 'large' | 'xlarge'

export interface AccessibilitySettings {
  fontScale: FontScale
  highContrast: boolean
  reduceMotion: boolean
  dyslexiaFont: boolean
  underlineLinks: boolean
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  fontScale: 'default',
  highContrast: false,
  reduceMotion: false,
  dyslexiaFont: false,
  underlineLinks: false,
}

export const DEFAULT_LAYOUT: LayoutPositions = {
  pinwheelSide: 'left',
  widgetSize: 'medium',
  accent: 'cyan',
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  ageRange: '',
  techSavvy: '',
  viewPreference: '',
  layout: { ...DEFAULT_LAYOUT },
  accessibility: { ...DEFAULT_ACCESSIBILITY },
  language: 'en',
}

const LS_KEY = 'autinerary_preferences'

// ── Option metadata (single source of truth for UI + analytics) ──

export const AGE_RANGES: { id: AgeRange; label: string }[] = [
  { id: '18-40', label: '18–40' },
  { id: '40-65', label: '40–65' },
  { id: '65+', label: '65+' },
]

export const TECH_SAVVY: { id: TechSavvy; label: string; hint: string }[] = [
  { id: 'not_at_all', label: 'Not at all', hint: 'I rarely use apps' },
  { id: 'somewhat', label: 'Somewhat', hint: 'I use apps sometimes' },
  { id: 'always', label: 'Always', hint: 'I use apps all the time' },
]

export const VIEW_PREFERENCES: {
  id: ViewPreference
  label: string
  hint: string
  emoji: string
}[] = [
  { id: 'plain', label: 'Plain', hint: 'Clean and simple', emoji: '⬜' },
  { id: 'pretty', label: 'Pretty', hint: 'Nice, but not distracting', emoji: '🌸' },
  { id: 'exciting', label: 'Exciting', hint: 'Lively, but not too much', emoji: '✨' },
  { id: 'fun', label: 'Fun', hint: 'Full of energy and play', emoji: '🎉' },
]

/**
 * How "much" visual energy a view preference implies (0–3). Everything stays a
 * gamified checklist; this only scales animation/decoration intensity.
 */
export const VIEW_ENERGY: Record<ViewPreference, number> = {
  plain: 0,
  pretty: 1,
  exciting: 2,
  fun: 3,
}

// ── Persistence ──

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      layout: { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) },
      accessibility: { ...DEFAULT_ACCESSIBILITY, ...(parsed.accessibility || {}) },
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const current = loadPreferences()
  const next: UserPreferences = {
    ...current,
    ...prefs,
    layout: { ...current.layout, ...(prefs.layout || {}) },
    accessibility: { ...current.accessibility, ...(prefs.accessibility || {}) },
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    // Let same-tab listeners know (storage event only fires cross-tab).
    window.dispatchEvent(new CustomEvent('autinerary:prefs', { detail: next }))
  } catch {
    /* quota — ignore */
  }
  return next
}

/** Update just the layout positions (used by in-app customization controls). */
export function saveLayout(layout: Partial<LayoutPositions>): UserPreferences {
  return savePreferences({ layout: layout as LayoutPositions })
}

/** Update just the accessibility settings. */
export function saveAccessibility(a11y: Partial<AccessibilitySettings>): UserPreferences {
  return savePreferences({ accessibility: a11y as AccessibilitySettings })
}

/**
 * Apply accessibility settings to the document root as data-attributes and a
 * font-scale class. Global CSS keys off these. Safe to call repeatedly.
 */
export function applyAccessibility(a11y: AccessibilitySettings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.fontScale = a11y.fontScale
  root.dataset.highContrast = a11y.highContrast ? 'on' : 'off'
  root.dataset.reduceMotion = a11y.reduceMotion ? 'on' : 'off'
  root.dataset.dyslexiaFont = a11y.dyslexiaFont ? 'on' : 'off'
  root.dataset.underlineLinks = a11y.underlineLinks ? 'on' : 'off'
}
