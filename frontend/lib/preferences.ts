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
export type ReminderChannel = 'email' | 'sms'

/**
 * Daily goal-reminder opt-in. This is the storage/consent groundwork only — the
 * actual send pipeline (scheduler + email/SMS provider) is a separate workstream.
 * Persisted to profiles.preferences.reminders (cross-device) via onboarding submit
 * and mirrored to localStorage for instant UX.
 */
export interface ReminderPreferences {
  /** Whether the user opted in to daily goal reminders. */
  enabled: boolean
  /** Delivery channel. */
  channel: ReminderChannel
  /** Email address or phone number, depending on channel. */
  contact: string
  /** Preferred local send time as "HH:MM" (24h). */
  time: string
  /** Explicit consent to be contacted at `contact`. Required to enable. */
  consent: boolean
}

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
  /** Daily goal-reminder opt-in (storage/consent only; delivery not yet wired). */
  reminders: ReminderPreferences
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
  /** Play a short "pop" when a task is completed (Liam). Default on. */
  soundEffects: boolean
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  fontScale: 'default',
  highContrast: false,
  reduceMotion: false,
  dyslexiaFont: false,
  underlineLinks: false,
  soundEffects: true,
}

export const DEFAULT_LAYOUT: LayoutPositions = {
  pinwheelSide: 'left',
  widgetSize: 'medium',
  accent: 'cyan',
}

export const DEFAULT_REMINDERS: ReminderPreferences = {
  enabled: false,
  channel: 'email',
  contact: '',
  time: '09:00',
  consent: false,
}

/** Preset send times for the reminder opt-in (value is "HH:MM", 24h). */
export const REMINDER_TIMES: { id: string; label: string }[] = [
  { id: '09:00', label: 'Morning · 9:00 AM' },
  { id: '12:00', label: 'Midday · 12:00 PM' },
  { id: '18:00', label: 'Evening · 6:00 PM' },
  { id: '21:00', label: 'Night · 9:00 PM' },
]

// ── Layout option metadata (single source of truth for UI + CSS) ──

export const WIDGET_SIZES: { id: LayoutPositions['widgetSize']; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]

/** Accent theme keys with a representative swatch color (for the picker UI). */
export const ACCENTS: { id: LayoutPositions['accent']; label: string; swatch: string }[] = [
  { id: 'cyan', label: 'Cyan', swatch: '#06b6d4' },
  { id: 'purple', label: 'Purple', swatch: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { id: 'amber', label: 'Amber', swatch: '#f59e0b' },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e' },
]

export const DEFAULT_PREFERENCES: UserPreferences = {
  ageRange: '',
  techSavvy: '',
  viewPreference: '',
  layout: { ...DEFAULT_LAYOUT },
  accessibility: { ...DEFAULT_ACCESSIBILITY },
  language: 'en',
  reminders: { ...DEFAULT_REMINDERS },
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

/**
 * Compute the *effective* gamification energy (0–3) for a user, adapting the
 * chosen view preference to the audience. The journey is always a gamified
 * checklist — this only tunes HOW MUCH visual energy we render so the UI feels
 * right for who's using it (a calmer experience for seniors / less tech-savvy
 * users, the full playful treatment for younger, app-fluent users).
 *
 * Rules (only ever *cap* the user's own choice — never force more energy than
 * they asked for):
 *  - 65+ audience → cap at 1 (pretty). Big celebratory motion can be jarring.
 *  - 40–65 audience → cap at 2 (exciting).
 *  - "Not at all" tech-savvy → cap at 1 (keep it simple and legible).
 *  - "Somewhat" tech-savvy → cap at 2.
 * The lowest applicable cap wins. If the user picked "plain", it stays plain.
 */
export function computeEnergy(prefs: UserPreferences): number {
  const base = prefs.viewPreference ? VIEW_ENERGY[prefs.viewPreference] : 1
  let cap = 3
  if (prefs.ageRange === '65+') cap = Math.min(cap, 1)
  else if (prefs.ageRange === '40-65') cap = Math.min(cap, 2)
  if (prefs.techSavvy === 'not_at_all') cap = Math.min(cap, 1)
  else if (prefs.techSavvy === 'somewhat') cap = Math.min(cap, 2)
  return Math.min(base, cap)
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
      reminders: { ...DEFAULT_REMINDERS, ...(parsed.reminders || {}) },
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
    reminders: { ...current.reminders, ...(prefs.reminders || {}) },
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

/**
 * Apply view/layout preferences to the document root as data-attributes.
 * Global CSS keys off these to scale widgets, tune visual energy, and set the
 * accent color. Everything stays a gamified checklist — this only changes HOW
 * MUCH visual energy and which accent we render.
 */
export function applyLayout(prefs: UserPreferences): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.widgetSize = prefs.layout.widgetSize
  root.dataset.accent = prefs.layout.accent
  root.dataset.pinwheelSide = prefs.layout.pinwheelSide
  // Visual energy 0–3, adapted to the audience (age + tech comfort).
  root.dataset.viewEnergy = String(computeEnergy(prefs))
}
