'use client'

/**
 * Info Mode (Odosa), the same as the app's (frontend/lib/infoMode.ts; keep
 * the two the same): ResourceHub's ? button in the navbar (All Apps).
 *
 * For people who are not confident with apps, a tour at the start is not
 * enough: it explains things once, before any of it means anything, and then
 * never again. Info Mode lets someone ask "what does this do?" at the moment
 * they are looking at the control.
 *
 * Three modes, cycled by the ? button in the navbar:
 *
 *   action     normal app. THE DEFAULT — nobody is opted into a changed
 *              interaction model without asking for it.
 *   info       every time: the first click explains, the second runs it.
 *   infoAction the first time only: a control is explained once, then it
 *              works with one click (remembered on this device), so what
 *              has been learned stops getting in the way.
 *
 * Cycle: action → info → infoAction → action (Odosa, October 2026: "If
 * selected, the first click of every action should give a description …
 * selected again, Info + Action Mode … a third time, action mode … on 4th
 * click cycles back to Info Mode. Have this on action mode to start").
 *
 * Descriptions come from a `data-info` attribute on (or above) the element, so
 * a control without one says plainly that it has no description rather than a
 * generated guess about what it might do.
 */

import { useEffect, useState } from 'react'

export type InfoMode = 'action' | 'info' | 'infoAction'

const KEY = 'autinerary_info_mode'
export const INFO_MODE_EVENT = 'autinerary:info-mode'

export const INFO_MODE_ORDER: InfoMode[] = ['action', 'info', 'infoAction']

export const INFO_MODE_META: Record<InfoMode, { label: string; description: string }> = {
  action: {
    label: 'Action Mode',
    description: 'Buttons work normally.',
  },
  info: {
    label: 'Info Mode',
    description: 'Every click explains first. Click the same thing again to use it.',
  },
  infoAction: {
    label: 'Info + Action Mode',
    description: 'New things are explained once. After that, they work with one click.',
  },
}

export function getInfoMode(): InfoMode {
  if (typeof window === 'undefined') return 'action'
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'info' || v === 'infoAction' ? v : 'action'
  } catch {
    return 'action'
  }
}

export function setInfoMode(mode: InfoMode): void {
  if (typeof window === 'undefined') return
  try {
    if (mode === 'action') window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, mode)
    window.dispatchEvent(new CustomEvent(INFO_MODE_EVENT))
  } catch {
    /* quota or blocked storage — the mode simply will not persist */
  }
}

const KNOWN_KEY = 'autinerary_info_known'

/** A control's name for "already explained": its data-info, or its label, with the page. */
export function controlKey(el: Element, path: string): string {
  const info = (el.closest('[data-info]') as HTMLElement | null)?.dataset.info || ''
  const { title } = describeElement(el)
  return `${path.split('?')[0]}|${(info || title).slice(0, 120)}`
}

/** Explained before, in Info + Action Mode (this device only). */
export function isKnown(key: string): boolean {
  try {
    return (JSON.parse(window.localStorage.getItem(KNOWN_KEY) || '[]') as string[]).includes(key)
  } catch {
    return false
  }
}

export function markKnown(key: string): void {
  try {
    const known = JSON.parse(window.localStorage.getItem(KNOWN_KEY) || '[]') as string[]
    if (!known.includes(key)) window.localStorage.setItem(KNOWN_KEY, JSON.stringify([...known, key].slice(-500)))
  } catch {
    /* blocked storage: it is explained again next time, which is safe */
  }
}

export function nextInfoMode(current: InfoMode): InfoMode {
  const i = INFO_MODE_ORDER.indexOf(current)
  return INFO_MODE_ORDER[(i + 1) % INFO_MODE_ORDER.length]
}

export function useInfoMode() {
  const [mode, setMode] = useState<InfoMode>('action')

  useEffect(() => {
    const sync = () => setMode(getInfoMode())
    sync()
    window.addEventListener(INFO_MODE_EVENT, sync as EventListener)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(INFO_MODE_EVENT, sync as EventListener)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return {
    mode,
    setMode: (m: InfoMode) => setInfoMode(m),
    cycle: () => setInfoMode(nextInfoMode(getInfoMode())),
    isOn: mode !== 'action',
  }
}

/**
 * Describe a clicked element.
 *
 * Looks for an explicit `data-info`, then falls back to the control's own
 * accessible label — its aria-label, title, or visible text. That fallback is
 * a restatement of what the control already says about itself, never an
 * invention about what it does.
 */
export function describeElement(el: Element | null): { title: string; body: string | null } {
  const target = el?.closest<HTMLElement>('[data-info], button, a, [role="button"], input, select, textarea')
  if (!target) return { title: 'Nothing to explain here', body: null }

  const described = target.closest<HTMLElement>('[data-info]')
  const info = described?.dataset.info?.trim()

  const label =
    target.getAttribute('aria-label')?.trim() ||
    target.getAttribute('title')?.trim() ||
    (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
      ? Array.from(target.labels || []).map(label => label.textContent?.trim() || '').join(' ').slice(0, 120)
      : '') ||
    target.getAttribute('placeholder')?.trim() ||
    (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)

  if (info) return { title: label || 'This control', body: info }

  if (target instanceof HTMLInputElement) {
    const body = target.type === 'checkbox' ? 'Selects or clears this option.'
      : target.type === 'radio' ? 'Selects this option in its group.'
      : target.type === 'password' ? 'Enter your password. Its value is not read aloud.'
      : 'Enter or edit this field.'
    return { title: label || 'Input field', body }
  }
  if (target instanceof HTMLSelectElement) return { title: label || 'Options', body: 'Choose one option from this list.' }
  if (target instanceof HTMLTextAreaElement) return { title: label || 'Text field', body: 'Enter or edit your answer.' }

  // No authored description. Say so rather than guessing at behaviour.
  return {
    title: label || 'This control',
    body: null,
  }
}
