// Notifications
//
// A cross-device notification system: an in-app notification center (works
// everywhere, laptop or phone) plus optional OS-level browser notifications via
// the Web Notifications API. Client-side/localStorage, consistent with the other
// lib/* stores.
//
// Browser notifications work on desktop browsers and Android Chrome. iOS Safari
// only delivers them when the app is installed to the home screen (PWA, 16.4+);
// until then the in-app center still shows everything. True push while the app
// is CLOSED needs a service worker + server push and is a separate workstream.
'use client'

import { useEffect, useState } from 'react'

export interface AppNotification {
  id: string
  title: string
  body?: string
  /** Emoji shown as the icon in the in-app list. */
  icon?: string
  /** Optional in-app route to open when clicked. */
  href?: string
  createdAt: string
  read: boolean
}

const KEY = 'autinerary_notifications'
export const NOTIF_EVENT = 'autinerary:notifications'
const MAX = 50

function read(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(list: AppNotification[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT))
  } catch {
    /* quota — ignore */
  }
}

/** Newest-first list for display. */
export function getNotifications(): AppNotification[] {
  return read().slice().reverse()
}

export function getUnreadCount(): number {
  return read().filter((n) => !n.read).length
}

export function isBrowserNotifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotifSupported()) return 'unsupported'
  return Notification.permission
}

/** Ask the OS for permission to show browser notifications. Call from a click. */
export async function requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotifSupported()) return 'unsupported'
  try {
    const p = await Notification.requestPermission()
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT))
    return p
  } catch {
    return Notification.permission
  }
}

/**
 * Add a notification to the in-app center. Also fires an OS-level browser
 * notification when the user has granted permission. Deduped by `dedupeKey`
 * (when provided) so the same nudge isn't added twice in a day/session.
 */
export function notify(
  input: { title: string; body?: string; icon?: string; href?: string },
  opts?: { browser?: boolean; dedupeKey?: string }
): void {
  if (typeof window === 'undefined') return
  const list = read()

  if (opts?.dedupeKey) {
    const already = list.some((n) => n.id.startsWith(`${opts.dedupeKey}:`))
    if (already) return
  }

  const id = `${opts?.dedupeKey ? opts.dedupeKey + ':' : ''}${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const item: AppNotification = {
    id,
    title: input.title,
    body: input.body,
    icon: input.icon,
    href: input.href,
    createdAt: new Date().toISOString(),
    read: false,
  }
  write([...list, item])

  // Fire an OS notification too, when allowed and requested.
  if (opts?.browser !== false && isBrowserNotifSupported() && Notification.permission === 'granted') {
    try {
      new Notification(input.title, { body: input.body })
    } catch {
      /* ignore — in-app entry already recorded */
    }
  }
}

export function markAllRead(): void {
  write(read().map((n) => ({ ...n, read: true })))
}

export function markRead(id: string): void {
  write(read().map((n) => (n.id === id ? { ...n, read: true } : n)))
}

export function clearAll(): void {
  write([])
}

/** Live notifications + unread count for components. */
export function useNotifications(): { list: AppNotification[]; unread: number } {
  const [state, setState] = useState<{ list: AppNotification[]; unread: number }>({ list: [], unread: 0 })
  useEffect(() => {
    const sync = () => setState({ list: getNotifications(), unread: getUnreadCount() })
    sync()
    window.addEventListener(NOTIF_EVENT, sync as EventListener)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(NOTIF_EVENT, sync as EventListener)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return state
}
