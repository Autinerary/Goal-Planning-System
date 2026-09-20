'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

/**
 * Non-blocking notices, replacing window.alert().
 *
 * A tester on the calendar import: "could be better done than a popup that
 * requires OK to be pressed". They are right, and it matters more here than
 * in most products — a modal dialog that seizes focus and demands a
 * keystroke is exactly the kind of interruption this app exists to avoid.
 *
 * Deliberately tiny and dependency-free: a module-level event bus plus one
 * host mounted in the root layout. No provider to thread through, so any
 * module can call showToast() without being inside a React tree.
 */

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const EVENT = 'autinerary:toast'
/** Errors stay longer, since they may need reading twice. */
const DURATION: Record<ToastKind, number> = { success: 4000, info: 5000, error: 8000 }

let nextId = 1

/** Show a notice. Safe to call from anywhere, including outside React. */
export function showToast(message: string, kind: ToastKind = 'info'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: nextId++, kind, message } }))
}

export const toast = {
  success: (m: string) => showToast(m, 'success'),
  error: (m: string) => showToast(m, 'error'),
  info: (m: string) => showToast(m, 'info'),
}

const STYLES: Record<ToastKind, { ring: string; icon: any; iconClass: string }> = {
  success: { ring: 'border-emerald-300 bg-emerald-50', icon: CheckCircle2, iconClass: 'text-emerald-600' },
  error:   { ring: 'border-rose-300 bg-rose-50',       icon: AlertCircle,  iconClass: 'text-rose-600' },
  info:    { ring: 'border-sky-300 bg-sky-50',         icon: Info,         iconClass: 'text-sky-600' },
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent).detail as Toast
      setToasts((prev) => [...prev, t])
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, DURATION[t.kind] ?? 5000)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      // polite, not assertive: a confirmation should not cut across whatever
      // a screen reader is already saying.
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[200] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => {
        const s = STYLES[t.kind] ?? STYLES.info
        const Icon = s.icon
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border-2 ${s.ring} px-4 py-3 shadow-lg`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.iconClass}`} aria-hidden="true" />
            <span className="flex-1 text-sm text-slate-800">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
              className="shrink-0 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
