'use client'

import { useMemo, useState } from 'react'
import { UserPlus, Wrench } from 'lucide-react'
import SignupButton from './SignupButton'
import SignupDialogs from './SignupDialogs'
import { signupPlan, type SignupItem } from '@/lib/signups'
import { cleanEdits, costLabel, resourceIdOf, toolKey, visibleTools, type PlanTool } from '@/lib/milestoneTools'
import { useSignups } from '@/lib/useSignups'

const names = (items: SignupItem[]) => items.map((i) => i.name).join(', ')

/**
 * The task view's resources (the ask, October 2026: "on the task view all
 * the resources I am using", with an "Apply all" for that page's resources,
 * then: "a button that I click on and I sign up for the service, bypassing
 * filling in the form on their site"). The resources of the step this task
 * is part of, the same five the Milestone view shows (lib/milestoneTools.ts),
 * each with Sign me up where the kit knows the service's form, and "Sign up
 * for all", which says what it will do first. Only while one-click sign-up
 * is switched on.
 */
export default function TaskResources({
  milestoneId,
  milestoneName,
  baseTools,
  initialEdits,
}: {
  milestoneId: string
  milestoneName: string
  baseTools: PlanTool[]
  initialEdits?: unknown
}) {
  const tools = useMemo(() => visibleTools(baseTools, cleanEdits(initialEdits)), [baseTools, initialEdits])
  const ids = tools.map(resourceIdOf).filter((x): x is string => !!x)
  const app = useSignups(ids)
  const [confirming, setConfirming] = useState(false)

  // Which service each tool is: its ResourceHub listing's website, its own web
  // address, or, for a local service with no online sign-up, a request to it.
  const serviceOf = (t: PlanTool): string | null => {
    const id = resourceIdOf(t)
    return (id && app.listings[id]) || app.serviceFor(t.url) || app.requestFor(id)
  }
  const items: SignupItem[] = tools.flatMap((t): SignupItem[] => {
    const service = serviceOf(t)
    const recipe = app.serviceInfo(service)
    return recipe ? [{ service: recipe.key, name: recipe.name, status: app.signups[recipe.key]?.status || null, runner: app.runnerFor(recipe.key) }] : []
  })
  const plan = signupPlan(items)
  const busy = Object.keys(app.running).length > 0
  // Local services' requests (no account, no password) read differently from sign-ups.
  const isRequest = (i: SignupItem) => app.serviceInfo(i.service)?.kind === 'request'
  const allRequests = plan.go.length > 0 && plan.go.every(isRequest)
  const cantRequests = plan.cant.filter(isRequest)
  const cantAccounts = plan.cant.filter((i) => !isRequest(i))

  if (!app.on || !app.loaded || !app.ready || tools.length === 0) return null

  const signUpAll = () => {
    setConfirming(false)
    app.signUp(plan.go.map((i) => ({ service: i.service, resourceId: tools.map((t) => [serviceOf(t), resourceIdOf(t)]).find(([s]) => s === i.service)?.[1] || null })))
  }

  return (
    <section aria-labelledby="task-resources-heading" className="rounded-2xl p-4 surface md:p-6" data-task-resources={milestoneId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="task-resources-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
          <Wrench className="h-4 w-4" aria-hidden="true" /> Resources for this task
        </h2>
        <p className="text-xs text-slate-700">From “{milestoneName}”</p>
      </div>
      <p className="mt-1 text-sm text-slate-800">Sign me up fills in the service’s own sign-up form for you; for a local service, it sends them your request. No typing, no forms.</p>

      <ul className="mt-3 space-y-2">
        {tools.map((t) => {
          const service = serviceOf(t)
          const cost = costLabel(t)
          return (
            <li key={toolKey(t)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{t.name}</span>
                <span className="block text-xs text-slate-700">
                  {[t.category, cost].filter(Boolean).join(' · ')}
                  {!service ? `${t.category || cost ? ' · ' : ''}${app.unreachable(resourceIdOf(t)) ? 'No online way to reach them yet' : 'No one-click sign-up for this one'}` : ''}
                </span>
              </span>
              <SignupButton app={app} service={service} resourceId={resourceIdOf(t)} compact />
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {app.refusal ? (
          <p className="text-sm text-slate-800">{app.refusal}</p>
        ) : plan.go.length > 0 ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60"
            data-signup-all
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" /> {busy ? (allRequests ? 'Sending…' : 'Signing you up…') : allRequests ? `Send all requests (${plan.go.length})` : `Sign up for all (${plan.go.length})`}
          </button>
        ) : plan.done.length > 0 ? (
          <p className="text-sm font-semibold text-slate-800">
            {plan.done.some(isRequest) ? 'Everything here that can be is done: signed up, or your request sent.' : 'You’re signed up for everything here that can be.'}
          </p>
        ) : null}
        {app.details && (
          <button type="button" onClick={app.editDetails} className="text-sm font-semibold text-indigo-800 underline underline-offset-2">
            Change my name for sign-ups
          </button>
        )}
      </div>

      {confirming && (
        <div role="alertdialog" aria-labelledby="signup-all-heading" aria-describedby="signup-all-what" className="mt-3 rounded-xl border border-indigo-300 bg-indigo-50 p-4" data-signup-all-confirm>
          <p id="signup-all-heading" className="font-semibold text-slate-900">
            {allRequests
              ? `Send your request to ${plan.go.length} ${plan.go.length === 1 ? 'service' : 'services'}?`
              : `Sign you up for ${plan.go.length} ${plan.go.length === 1 ? 'service' : 'services'}?`}
          </p>
          <div id="signup-all-what" className="mt-1 space-y-1 text-sm text-slate-800">
            <p>One after another: {names(plan.go)}.</p>
            {plan.done.length > 0 && <p>Already done: {names(plan.done)}.</p>}
            {cantAccounts.length > 0 && <p>{app.canAddExtension ? 'These need the Autinerary extension' : 'Sign up for these on their own site (the link is next to each)'}: {names(cantAccounts)}.</p>}
            {cantRequests.length > 0 && <p>These can’t be sent from here yet: {names(cantRequests)}.</p>}
            <p>
              {!app.details
                ? 'First you’ll check your name. Nothing starts until you save it.'
                : allRequests
                  ? `Each gets your request, with your name and ${app.email || 'email'}, and replies to you.`
                  : plan.go.some(isRequest)
                    ? `Each gets your name and ${app.email || 'email'}. A local service gets your request; each new account gets its own password for you to save.`
                    : `Each gets your name and ${app.email || 'email'}, and its own new password for you to save.`}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={signUpAll} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">
              {!app.details ? 'Check my name' : allRequests ? `Yes, send ${plan.go.length === 1 ? 'it' : `all ${plan.go.length}`}` : `Yes, sign me up for ${plan.go.length}`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-400 bg-white px-4 py-2 font-semibold text-slate-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="mt-2 min-h-[1.25rem] text-sm text-slate-900" role="status" aria-live="polite" data-signup-note>
        {app.note}
      </p>
      <SignupDialogs app={app} />
    </section>
  )
}
