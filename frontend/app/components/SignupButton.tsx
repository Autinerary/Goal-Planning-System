'use client'

import Link from 'next/link'
import { CheckCircle2, Loader2, Mail, MousePointerClick, UserPlus } from 'lucide-react'
import { isSettled, statusLabel } from '@/lib/signups'
import type { Signups } from '@/lib/useSignups'

/**
 * One service's Sign me up (lib/signups.ts): the button, then where the
 * sign-up is ("Signed up Oct 26", "Check your email to finish"). Where
 * nothing here can run it (no extension, and the service checks for
 * robots), it says the extension is needed.
 */
export default function SignupButton({ app, service, resourceId, compact = false }: { app: Signups; service: string | null; resourceId?: string | null; compact?: boolean }) {
  if (!app.on || !app.ready || !service) return null
  const recipe = app.serviceInfo(service)
  if (!recipe) return null
  const state = app.signups[service]
  const size = compact ? 'min-h-[32px] px-2.5 py-1 text-xs' : 'min-h-[40px] px-3.5 py-2 text-sm'

  if (app.running[service]) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg bg-indigo-100 font-semibold text-indigo-950 ${size}`} data-signup-running={service}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Signing you up…
      </span>
    )
  }
  if (state && (isSettled(state.status) || state.status === 'needs_you')) {
    const Icon = state.status === 'check_email' ? Mail : state.status === 'needs_you' ? MousePointerClick : CheckCircle2
    return (
      <span className="inline-flex flex-wrap items-center gap-2" data-signup-status={state.status}>
        <span className={`inline-flex items-center gap-1 rounded-lg font-semibold ${state.status === 'signed_up' || state.status === 'exists' ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'} ${size}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {statusLabel(state.status, recipe.kind, state.at)}
        </span>
        {state.status === 'needs_you' && (
          <button type="button" onClick={() => app.signUp([{ service, resourceId }])} className="text-xs font-semibold text-slate-800 underline underline-offset-2">
            Try again
          </button>
        )}
      </span>
    )
  }
  if (!app.runnerFor(service)) {
    return (
      <Link href="/extension" className={`inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white font-semibold text-indigo-900 hover:bg-indigo-50 ${size}`} data-signup-needs-extension={service}>
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Sign up needs the extension
      </Link>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => app.signUp([{ service, resourceId }])}
        disabled={Object.keys(app.running).length > 0}
        className={`inline-flex items-center gap-1 rounded-lg bg-indigo-700 font-bold text-white hover:bg-indigo-800 disabled:opacity-60 ${size}`}
        aria-label={`${recipe.kind === 'newsletter' ? 'Subscribe me to' : 'Sign me up for'} ${recipe.name}`}
        data-signup={service}
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {recipe.kind === 'newsletter' ? 'Subscribe me' : 'Sign me up'}
      </button>
      {state?.status === 'failed' && <span className="text-xs font-semibold text-red-800">{statusLabel('failed', recipe.kind)}</span>}
    </span>
  )
}
