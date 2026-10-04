'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

/**
 * "Notifications on this device" (Riipen Labs, Group 2: "add email and
 * notification opt-in so a check-in can reach users who stop opening the
 * app"). Turning it on asks the browser for permission, subscribes this
 * device through the service worker (public/sw.js) and saves it
 * (/api/push/subscribe), which sends one notification straight away.
 *
 * Used in Settings and on the page after setup. Each device is separate.
 * iPhone and iPad only allow notifications from a site added to the Home
 * Screen, so there it explains that instead.
 */

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

type State = 'checking' | 'dev' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on' | 'busy' | 'error'

function keyBytes(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // In production ServiceWorkerRegistrar registers the worker after load;
  // register here too in case someone is faster than that.
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export default function PushOptIn() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(KEY)
      let next: State
      if (process.env.NODE_ENV !== 'production') next = 'dev'
      else if (!supported) next = isAppleMobile() && !isInstalled() ? 'ios-install' : 'unsupported'
      else if (Notification.permission === 'denied') next = 'blocked'
      else {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        next = sub && Notification.permission === 'granted' ? 'on' : 'off'
      }
      if (!cancelled) setState(next)
    })().catch(() => {
      if (!cancelled) setState('unsupported')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function turnOn() {
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const reg = await registration()
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY as string) }))
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {})
        throw new Error(String(res.status))
      }
      setState('on')
    } catch {
      setState('error')
    }
  }

  async function turnOff() {
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe()
      }
      setState('off')
    } catch {
      setState('error')
    }
  }

  if (state === 'checking') return null

  const message: Record<Exclude<State, 'checking'>, string> = {
    dev: 'Notifications can be turned on in the deployed app.',
    unsupported: "This browser can't show notifications from websites. The check-in email still works.",
    'ios-install':
      'On iPhone and iPad, notifications work once Autinerary is on your Home Screen: tap Share, then Add to Home Screen, and open it from there.',
    blocked: 'Notifications are blocked for this site in your browser settings. Allow them there, then come back here.',
    off: "One check-in if you haven't opened Autinerary for two weeks. We'll send one now, so you can see what it looks like.",
    on: "On for this device. We'll only notify you with a check-in if you haven't opened Autinerary for two weeks.",
    busy: 'One moment…',
    error: "Couldn't turn notifications on. Please try again.",
  }
  const canToggle = state === 'off' || state === 'on' || state === 'error'

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
        <Bell className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Notifications on this device
      </p>
      <p className="text-sm text-slate-700" role="status" aria-live="polite">
        {message[state]}
      </p>
      {canToggle && (
        <button
          type="button"
          onClick={state === 'on' ? turnOff : turnOn}
          className={`mt-2 rounded-lg px-4 py-2 text-sm font-semibold ${
            state === 'on'
              ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              : 'bg-cyan-700 text-white hover:bg-cyan-800'
          }`}
        >
          {state === 'on' ? 'Turn off on this device' : state === 'error' ? 'Try again' : 'Turn on'}
        </button>
      )}
    </div>
  )
}
