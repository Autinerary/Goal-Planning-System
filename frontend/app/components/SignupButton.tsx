'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Loader2, Mail, MousePointerClick, UserPlus } from 'lucide-react'
import { isSettled, statusLabel, unconfirmed } from '@/lib/signups'
import { formMessage } from '@/lib/requests'
import type { Signups } from '@/lib/useSignups'

/**
 * One service's Sign me up (lib/signups.ts): the button, then where the
 * sign-up is ("Signed up Oct 26", "Check your email to finish"). Where
 * nothing here can run it (no extension, and the service checks for
 * robots), it points to the extension if this browser can add it, and
 * otherwise to the service's own sign-up page. For a local service
 * (lib/requests.ts) it is "Send my request", and then "Request sent"; a form
 * that needs them, without the extension, comes with their details to copy.
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
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {recipe.kind === 'request' ? 'Sending your request…' : 'Signing you up…'}
      </span>
    )
  }
  if (state && (isSettled(state.status) || state.status === 'needs_you')) {
    const Icon = state.status === 'check_email' ? Mail : state.status === 'needs_you' ? MousePointerClick : CheckCircle2
    const label = recipe.kind === 'request' && state.status === 'needs_you' ? 'Their form needs you' : statusLabel(state.status, recipe.kind, state.at, state.detail)
    const notConfirmed = state.status === 'requested' && unconfirmed(state.detail)
    // A website's form handed over (a robot check, or a question only they can answer): open in the
    // extension's tab, filled in, or its page to finish on; and "I've sent it" for when they have.
    const handed = recipe.kind === 'request' && state.status === 'needs_you' ? app.handOver[service] || null : null
    // Their form's page from this run; after a reload, their website.
    const finishAt = handed ? (handed.inExtension ? null : handed.url) : recipe.kind === 'request' && state.status === 'needs_you' ? recipe.start || null : null
    return (
      <span className="inline-flex flex-wrap items-center gap-2" data-signup-status={state.status}>
        <span className={`inline-flex items-center gap-1 rounded-lg font-semibold ${!notConfirmed && (state.status === 'signed_up' || state.status === 'exists' || state.status === 'requested') ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'} ${size}`} data-signup-unconfirmed={notConfirmed || undefined}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </span>
        {handed?.inExtension && <span className="text-xs text-slate-800" data-signup-in-tab>Open in a new tab, filled in: finish it there</span>}
        {notConfirmed && recipe.start && (
          <a href={recipe.start} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-800 underline underline-offset-2">
            Check with them on their website<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        {finishAt && (
          <a href={finishAt} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-800 underline underline-offset-2">
            Finish on their page<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        {recipe.kind === 'request' && ((state.status === 'needs_you' && !handed?.inExtension) || notConfirmed) && app.details && (
          <CopyDetails
            items={[
              { label: 'Name', value: `${app.details.firstName} ${app.details.lastName}`.trim() },
              { label: 'Email', value: app.email || '' },
              { label: 'Phone', value: app.extras.phone || '' },
              { label: 'Message', value: formMessage({ ...app.details, email: app.email || '', extras: app.extras, serviceName: recipe.name }) },
            ]}
          />
        )}
        {recipe.kind === 'request' && state.status === 'needs_you' && (
          <button type="button" onClick={() => app.markSent(service, resourceId)} className="text-xs font-semibold text-slate-800 underline underline-offset-2" data-signup-sent-it>
            I’ve sent it
          </button>
        )}
        {state.status === 'needs_you' && !handed && (
          <button type="button" onClick={() => app.signUp([{ service, resourceId }])} className="text-xs font-semibold text-slate-800 underline underline-offset-2">
            Try again
          </button>
        )}
      </span>
    )
  }
  if (!app.runnerFor(service)) {
    if (recipe.kind === 'request') return <span className="text-xs text-slate-700">{app.unreachable(resourceId) ? 'No online way to reach them yet' : 'Requests through their website aren’t switched on yet'}</span>
    // This browser can add the extension (it's in a store it takes): point there.
    if (app.canAddExtension) {
      return (
        <Link href="/extension" className={`inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white font-semibold text-indigo-900 hover:bg-indigo-50 ${size}`} data-signup-needs-extension={service}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Sign up needs the extension
        </Link>
      )
    }
    // Otherwise never a dead end: the service's own sign-up page.
    return recipe.start ? (
      <a href={recipe.start} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 ${size}`} data-signup-own-site={service}>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Sign up on their site<span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : null
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => app.signUp([{ service, resourceId }])}
        disabled={Object.keys(app.running).length > 0}
        className={`inline-flex items-center gap-1 rounded-lg bg-indigo-700 font-bold text-white hover:bg-indigo-800 disabled:opacity-60 ${size}`}
        aria-label={`${recipe.kind === 'newsletter' ? 'Subscribe me to' : recipe.kind === 'request' ? 'Send my request to' : 'Sign me up for'} ${recipe.name}`}
        data-signup={service}
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {recipe.kind === 'newsletter' ? 'Subscribe me' : recipe.kind === 'request' ? 'Send my request' : 'Sign me up'}
      </button>
      {state?.status === 'failed' && <span className="text-xs font-semibold text-red-800">{statusLabel('failed', recipe.kind)}</span>}
    </span>
  )
}

/** A form to finish on their page, without the extension: what Autinerary would have typed, to copy. */
function CopyDetails({ items }: { items: { label: string; value: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
    } catch {
      setCopied(null)
    }
  }
  return (
    <details className="basis-full text-xs" data-signup-copy>
      <summary className="cursor-pointer font-semibold text-slate-800 underline underline-offset-2">Copy my details for their form</summary>
      <ul className="mt-2 space-y-1.5">
        {items.filter((i) => i.value).map((i) => (
          <li key={i.label} className="flex items-start gap-2">
            <span className="w-16 shrink-0 font-semibold text-slate-800">{i.label}</span>
            <span className="min-w-0 flex-1 whitespace-pre-line break-words text-slate-900">{i.value}</span>
            <button
              type="button"
              onClick={() => copy(i.label, i.value)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-900 hover:bg-slate-50"
              data-copy={i.label}
            >
              {copied === i.label ? 'Copied' : 'Copy'}
              <span className="sr-only"> your {i.label.toLowerCase()}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">{copied ? `${copied} copied` : ''}</p>
    </details>
  )
}

/**
 * A listing with no email or website (lib/contactLookup.ts): look on the web
 * for its own, once. After that, either Send my request appears beside it, or
 * this says nothing usable was found.
 */
export function LookUpButton({ app, resourceId }: { app: Signups; resourceId: string | null | undefined }) {
  if (!app.on || !app.ready || !resourceId || !app.unreachable(resourceId)) return null
  if (app.lookingUp[resourceId]) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800" data-signup-looking={resourceId}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Looking…
      </span>
    )
  }
  if (app.requests[resourceId]?.lookedUp) return null
  return (
    <button type="button" onClick={() => app.lookUp(resourceId)} className="text-xs font-semibold text-indigo-800 underline underline-offset-2" data-signup-look-up={resourceId}>
      Look for a way to reach them
    </button>
  )
}
