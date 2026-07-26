'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X } from 'lucide-react'
import {
  useNotifications,
  markAllRead,
  markRead,
  clearAll,
  notify,
  requestBrowserPermission,
  getPermission,
} from '@/lib/notifications'
import { loadPreferences } from '@/lib/preferences'

/**
 * Notification center in the nav — an unread bell + dropdown that works on any
 * device (laptop or phone). Also offers to turn on OS-level browser
 * notifications, and drops a once-a-day "today's goals" nudge for users who
 * enabled reminders during onboarding.
 */
export default function NotificationBell() {
  const router = useRouter()
  const { list, unread } = useNotifications()
  const [open, setOpen] = useState(false)
  const [perm, setPerm] = useState<string>('default')
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setPerm(getPermission())
  }, [])

  // Once-a-day nudge for users who opted into reminders. Deduped by date, so it
  // only lands once even across reloads. Delivery while the app is CLOSED needs
  // push infra — this fires when they next open the app that day.
  useEffect(() => {
    try {
      const prefs = loadPreferences()
      if (prefs.reminders?.enabled) {
        notify(
          {
            title: 'Your goals for today 🎯',
            body: 'Open your Path to see today’s tasks and keep your streak going.',
            icon: '🎯',
            href: '/path',
          },
          { dedupeKey: `daily-${new Date().toDateString()}`, browser: true }
        )
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const enableBrowser = async () => {
    const p = await requestBrowserPermission()
    setPerm(p)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => {
          setOpen((o) => !o)
          if (!open && unread > 0) markAllRead()
        }}
        className="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-bold text-slate-800 text-sm">Notifications</span>
            {list.length > 0 && (
              <button onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-600">
                Clear all
              </button>
            )}
          </div>

          {/* Enable browser notifications */}
          {perm === 'default' && (
            <button
              onClick={enableBrowser}
              className="w-full text-left px-4 py-2.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs border-b border-cyan-100 transition-colors"
            >
              🔔 Turn on browser notifications so reminders reach you on this device.
            </button>
          )}
          {perm === 'denied' && (
            <div className="px-4 py-2.5 bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
              Browser notifications are blocked. You can re-enable them in your browser settings.
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {list.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">You’re all caught up.</p>
            ) : (
              list.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 ${
                    n.read ? '' : 'bg-cyan-50/40'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{n.icon || '🔔'}</span>
                  <button
                    onClick={() => {
                      markRead(n.id)
                      if (n.href) {
                        setOpen(false)
                        router.push(n.href)
                      }
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </button>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="text-slate-300 hover:text-green-500 flex-shrink-0" aria-label="Mark read">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
