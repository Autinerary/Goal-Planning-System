'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Share, X } from 'lucide-react'

const DISMISSED_KEY = 'autinerary_install_dismissed'

// Not offered while someone is still deciding whether to sign up or working
// through setup: on a phone it sat over the Continue button at the bottom of
// every onboarding step, and it is a second call to action competing with the
// one that matters there. It still appears on the first page after setup.
const FIRST_RUN_ROUTES = ['/', '/login', '/signup', '/onboarding', '/onboarding-confirmation']

/**
 * "Add Autinerary to your home screen."
 *
 * Two completely different mechanisms, because the platforms differ:
 *
 *   Android/Chrome  fires beforeinstallprompt, which we capture and replay
 *                   when the user taps Install — a real one-tap install.
 *   iOS/Safari      fires nothing and offers no API. The ONLY way to install
 *                   is Share → Add to Home Screen, so all we can do is tell
 *                   them where it is. Without this, iPhone users have no way
 *                   to discover the app is installable at all.
 *
 * Hidden once already installed (display-mode: standalone) and once
 * dismissed, so it never becomes the nagging banner everyone hates.
 */
export default function InstallPrompt() {
  const pathname = usePathname()
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Already installed — nothing to offer.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (standalone) return

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch {}

    const ua = window.navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(iOS)

    if (iOS) {
      // No event to wait for; show the manual instructions.
      setShow(true)
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault() // stop Chrome's own mini-infobar; we show our own
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    dismiss()
  }

  // Also held until the first-run tour is done, so a new user's first look
  // at the Path is not a tour with an install banner under it.
  let tourDone = false
  try { tourDone = Boolean(localStorage.getItem('autinerary_demo_seen_v1')) } catch {}
  if (!show || FIRST_RUN_ROUTES.includes(pathname) || !tourDone) return null

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-sm rounded-2xl border border-cyan-300 bg-white shadow-xl p-4">
      <button
        onClick={dismiss}
        aria-label="Not now"
        className="absolute top-2 right-2 text-slate-500 hover:text-slate-800"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm">Add Autinerary to your phone</p>
          {isIOS ? (
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline text-cyan-700" aria-label="the Share button" />
              below, then <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-600 mt-1">
                Opens like an app, with its own icon: no browser bar.
              </p>
              <button
                onClick={install}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 text-white text-xs font-bold hover:bg-cyan-800"
              >
                <Download className="w-3.5 h-3.5" /> Install
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
