'use client'

import { openCookieSettings } from '@/lib/consent'

/** "Cookie settings" on the cookie policy page: opens the question again (components/CookieConsent). */
export default function CookieSettingsButton() {
  return (
    <button type="button" onClick={openCookieSettings} className="font-medium text-indigo-800 underline underline-offset-2">
      Cookie settings
    </button>
  )
}
