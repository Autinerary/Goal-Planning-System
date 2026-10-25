'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '../../components/BackButton'
import ApplyButton from '../../components/ApplyButton'
import ApplyDetailsDialog from '../../components/ApplyDetailsDialog'
import { APPLY_ON } from '@/lib/applications'
import { useApplications } from '@/lib/useApplications'

/**
 * One-click Apply for one service (lib/applications.ts), where ResourceHub's
 * "Apply" on a listing leads: the same Apply, details check and Undo as the
 * task view, without going to the service's own website.
 */
export default function ApplyPage() {
  const params = useParams()
  const id = String(params.id || '')
  const app = useApplications([id], 'apply_page')
  const state = app.states[id]

  return (
    <main className="min-h-screen p-4 md:p-8 surface-veil">
      <div className="mx-auto max-w-xl space-y-4">
        <BackButton fallback="/path" />
        <section aria-labelledby="apply-heading" className="rounded-2xl p-6 surface">
          <h1 id="apply-heading" className="text-2xl font-bold text-slate-900">
            {state?.name ? `Apply to ${state.name}` : 'Apply'}
          </h1>
          {!APPLY_ON || (app.loaded && !app.on) ? (
            <p className="mt-2 text-slate-800">One-click Apply isn’t switched on yet.</p>
          ) : !app.loaded ? (
            <p className="mt-2 text-slate-800">Loading…</p>
          ) : !app.ready ? (
            <p className="mt-2 text-slate-800">One-click Apply isn’t ready yet. Try again soon.</p>
          ) : !state ? (
            <p className="mt-2 text-slate-800">We couldn’t find that service.</p>
          ) : state.how === 'none' ? (
            <p className="mt-2 text-slate-800">There’s nothing to apply for here: it’s a place you can just go to.</p>
          ) : app.refusal ? (
            <p className="mt-2 text-slate-800">{app.refusal}</p>
          ) : (
            <>
              <p className="mt-2 text-slate-800">
                Autinerary sends your request to them for you: no forms, no websites. They reply to your email, and you get a copy.
                {state.how === 'wait' ? ' Their listing has no email address yet, so we’ll find one and send it as soon as we can.' : ''}
              </p>
              <div className="mt-4">
                <ApplyButton app={app} resourceId={id} name={state.name || 'this service'} />
              </div>
              {app.details && (
                <button type="button" onClick={app.editDetails} className="mt-3 text-sm font-semibold text-indigo-800 underline underline-offset-2">
                  Change what we send
                </button>
              )}
            </>
          )}
          <p className="mt-3 min-h-[1.25rem] text-sm text-slate-900" role="status" aria-live="polite" data-apply-note>
            {app.note}
          </p>
          <p className="mt-2 text-sm">
            <Link href="/calendar" className="font-semibold text-indigo-800 underline underline-offset-2">
              Back to your tasks
            </Link>
          </p>
        </section>
        <ApplyDetailsDialog app={app} />
      </div>
    </main>
  )
}
