'use client'

import { useMemo, useState } from 'react'
import { Send, Wrench } from 'lucide-react'
import ApplyButton from './ApplyButton'
import ApplyDetailsDialog from './ApplyDetailsDialog'
import { applyAllPlan, type ApplyItem } from '@/lib/applications'
import { cleanEdits, costLabel, resourceIdOf, toolKey, visibleTools, type PlanTool } from '@/lib/milestoneTools'
import { useApplications } from '@/lib/useApplications'

const names = (items: ApplyItem[]) => items.map((i) => i.name).join(', ')

/**
 * The task view's resources (the ask, October 2026: "on the task view all
 * the resources I am using, and an Apply all that applies to that page's
 * resources"): the resources of the step this task is part of, the same
 * five the Milestone view shows (lib/milestoneTools.ts), each with Apply,
 * and "Apply all", which says what it will do before it sends anything.
 * Only while one-click Apply is switched on.
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
  const app = useApplications(ids, 'task')
  const [confirming, setConfirming] = useState(false)

  const items: ApplyItem[] = tools.flatMap((t): ApplyItem[] => {
    const id = resourceIdOf(t)
    const s = id ? app.states[id] : undefined
    return id && s ? [{ resourceId: id, name: t.name, how: s.how, status: s.status }] : []
  })
  const plan = applyAllPlan(items)
  const toApply = [...plan.send, ...plan.hold]
  const anyPending = Object.keys(app.pending).length > 0

  if (!app.on || !app.loaded || !app.ready || tools.length === 0) return null

  const applyAll = async () => {
    setConfirming(false)
    await app.applyAll(toApply.map((i) => i.resourceId))
  }

  return (
    <section aria-labelledby="task-resources-heading" className="rounded-2xl p-4 surface md:p-6" data-task-resources={milestoneId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="task-resources-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
          <Wrench className="h-4 w-4" aria-hidden="true" /> Resources for this task
        </h2>
        <p className="text-xs text-slate-700">From “{milestoneName}”</p>
      </div>
      <p className="mt-1 text-sm text-slate-800">Apply sends your request to the service for you. No forms, no websites: they reply to your email.</p>

      <ul className="mt-3 space-y-2">
        {tools.map((t) => {
          const id = resourceIdOf(t)
          const s = id ? app.states[id] : undefined
          const cost = costLabel(t)
          return (
            <li key={toolKey(t)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{t.name}</span>
                <span className="block text-xs text-slate-700">
                  {[t.category, cost].filter(Boolean).join(' · ')}
                  {s?.how === 'none' ? `${t.category || cost ? ' · ' : ''}Nothing to apply for: you can just go` : ''}
                  {!s ? `${t.category || cost ? ' · ' : ''}Not in ResourceHub, so it can’t be applied to from here` : ''}
                </span>
              </span>
              <ApplyButton app={app} resourceId={id} name={t.name} compact />
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {app.refusal ? (
          <p className="text-sm text-slate-800">{app.refusal}</p>
        ) : toApply.length > 0 ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={app.busy || anyPending}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60"
            data-apply-all
          >
            <Send className="h-4 w-4" aria-hidden="true" /> {app.busy ? 'Sending…' : `Apply all (${toApply.length})`}
          </button>
        ) : items.length > 0 ? (
          <p className="text-sm font-semibold text-slate-800">{plan.done.length ? 'You’ve applied to everything here.' : ''}</p>
        ) : null}
        {app.details && (
          <button type="button" onClick={app.editDetails} className="text-sm font-semibold text-indigo-800 underline underline-offset-2">
            Change what we send
          </button>
        )}
      </div>

      {confirming && (
        <div role="alertdialog" aria-labelledby="apply-all-heading" aria-describedby="apply-all-what" className="mt-3 rounded-xl border border-indigo-300 bg-indigo-50 p-4" data-apply-all-confirm>
          <p id="apply-all-heading" className="font-semibold text-slate-900">
            Apply to {toApply.length} {toApply.length === 1 ? 'service' : 'services'}?
          </p>
          <div id="apply-all-what" className="mt-1 space-y-1 text-sm text-slate-800">
            {plan.send.length > 0 && <p>Sent now: {names(plan.send)}.</p>}
            {plan.hold.length > 0 && <p>Sent as soon as we find their email address: {names(plan.hold)}.</p>}
            {plan.done.length > 0 && <p>Already applied: {names(plan.done)}.</p>}
            {app.details ? (
              <p>Each gets your saved details{app.email ? `, and replies go to ${app.email}` : ''}. An email can’t be taken back once it’s sent.</p>
            ) : (
              <p>First, you’ll check what we send. Nothing goes until you save it.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={applyAll} disabled={app.busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
              {app.details ? `Yes, apply to ${toApply.length}` : 'Check what we send'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-400 bg-white px-4 py-2 font-semibold text-slate-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="mt-2 min-h-[1.25rem] text-sm text-slate-900" role="status" aria-live="polite" data-apply-note>
        {app.note}
      </p>
      <ApplyDetailsDialog app={app} />
    </section>
  )
}
