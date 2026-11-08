// Google Analytics 4, optional and opt-in (Riipen Labs, Group 11: "track each
// onboarding step in GA4", usage analytics only, "no medical or identity
// data").
//
// Off unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set in Vercel. Even then,
// nothing loads until a visitor says yes to counting (components/CookieConsent, lib/consent.ts), never
// when the browser sends Do Not Track or Global Privacy Control, and Google
// signals and ad personalization are turned off. GA receives the same events
// as Autinerary's own funnel (lib/funnel.ts): event names and step ids, never
// anything typed. The privacy page and the home page say so when it is on.

import { countingConsent, setCountingConsent } from '@/lib/consent'

export const GA_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '').trim()

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

export function gaEnabled(): boolean {
  return /^G-[A-Z0-9]{4,}$/.test(GA_ID)
}

export function browserOptedOut(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

/** The answer to counting (lib/consent.ts): one answer covers Autinerary's own counts and Google Analytics. */
export function gaConsent(): 'yes' | 'no' | null {
  return countingConsent()
}

let loaded = false

/** Load GA, once, only when it is on, allowed by the visitor and not opted out. */
export function loadGa(): void {
  if (loaded || typeof window === 'undefined' || !gaEnabled() || gaConsent() !== 'yes' || browserOptedOut()) return
  loaded = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(script)
}

export function setGaConsent(value: 'yes' | 'no'): void {
  setCountingConsent(value)
  if (value === 'yes') loadGa()
  // Turning it off takes effect fully on the next page load; until then GA
  // is told not to collect.
  else if (typeof window !== 'undefined' && gaEnabled()) (window as any)[`ga-disable-${GA_ID}`] = true
}

/** The funnel's events, mirrored to GA when it is loaded. */
export function gaEvent(name: string, step?: string | null): void {
  if (!loaded || !window.gtag || gaConsent() !== 'yes') return
  window.gtag('event', name, step ? { step } : {})
}
