'use client'

import { CheckCircle2, Clock, Phone, Send, Undo2 } from 'lucide-react'
import { isApplied, statusLabel } from '@/lib/applications'
import type { Applications } from '@/lib/useApplications'

/**
 * One service's Apply (lib/applications.ts): "Apply", then a few seconds to
 * Undo, then where the application is ("Applied Oct 26", or waiting for
 * their address, which can still be taken back). Nothing for places,
 * products and articles, which have nothing to apply for.
 */
export default function ApplyButton({ app, resourceId, name, compact = false }: { app: Applications; resourceId: string | null; name: string; compact?: boolean }) {
  if (!app.on || !app.ready || !resourceId) return null
  const state = app.states[resourceId]
  if (!state || state.how === 'none') return null
  const left = app.pending[resourceId]
  const size = compact ? 'min-h-[32px] px-2.5 py-1 text-xs' : 'min-h-[40px] px-3.5 py-2 text-sm'

  if (left) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2" data-apply-pending={resourceId}>
        <span className={`inline-flex items-center gap-1 rounded-lg bg-indigo-100 font-semibold text-indigo-950 ${size}`}>
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Sending in {left}…
        </span>
        <button
          type="button"
          onClick={() => app.undo(resourceId)}
          className={`inline-flex items-center gap-1 rounded-lg border-2 border-indigo-700 bg-white font-bold text-indigo-900 hover:bg-indigo-50 ${size}`}
          aria-label={`Undo applying to ${name}`}
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
        </button>
      </span>
    )
  }

  if (isApplied(state.status)) {
    const Icon = state.status === 'sent' ? CheckCircle2 : state.status === 'waiting' ? Clock : Phone
    return (
      <span className="inline-flex flex-wrap items-center gap-2" data-apply-status={state.status}>
        <span className={`inline-flex items-center gap-1 rounded-lg font-semibold ${state.status === 'sent' ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'} ${size}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {statusLabel(state.status, state.at)}
          {state.status === 'unreachable' && state.phone ? `: call ${state.phone}` : ''}
        </span>
        {state.status === 'waiting' && (
          <button type="button" onClick={() => app.cancel(resourceId)} className="text-xs font-semibold text-slate-800 underline underline-offset-2" aria-label={`Take back your application to ${name}`}>
            Take back
          </button>
        )}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => app.apply(resourceId, name)}
        disabled={app.busy}
        className={`inline-flex items-center gap-1 rounded-lg bg-indigo-700 font-bold text-white hover:bg-indigo-800 disabled:opacity-60 ${size}`}
        aria-label={`Apply to ${name}`}
        data-apply={resourceId}
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" /> Apply
      </button>
      {state.status === 'failed' && <span className="text-xs font-semibold text-red-800">{statusLabel('failed')}</span>}
    </span>
  )
}
