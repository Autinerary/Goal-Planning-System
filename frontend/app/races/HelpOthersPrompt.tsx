'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, MessageCircleQuestion, X } from 'lucide-react'
import { goHubHref } from '@/lib/serviceHub'
import { tidbitQuery } from '@/lib/tidbitQuery'

export const HELP_PROMPT_OFF = 'autinerary_help_prompt_off'

export function helpPromptOff(): boolean {
  try { return localStorage.getItem(HELP_PROMPT_OFF) === '1' } catch { return false }
}

/**
 * After a milestone is done, two ways to help someone with a similar
 * experience (the team's notes, October 2026: the old "Answer related
 * questions" and "Solved threads / share experience" links were unclear and
 * always there; "this should be an option or pop-up that clearly lets
 * someone know that they could help someone else with a similar experience
 * via these two options, and should only appear after they complete a
 * milestone"). Both open Tidbits in ResourceHub, in a new tab, searched for
 * this milestone.
 */
export default function HelpOthersPrompt({ milestone, onClose }: { milestone: { id: string; name: string } | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [dontAsk, setDontAsk] = useState(false)

  useEffect(() => {
    if (milestone && !dialog.current?.open) dialog.current?.showModal()
    if (!milestone && dialog.current?.open) dialog.current.close()
  }, [milestone])

  const close = () => {
    if (dontAsk) try { localStorage.setItem(HELP_PROMPT_OFF, '1') } catch {}
    onClose()
  }
  if (!milestone) return null
  const link = (sort: 'unanswered' | 'solved') => goHubHref(`/community?${new URLSearchParams({ q: tidbitQuery(milestone.name), sort, context: 'races' })}`)

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => { e.preventDefault(); close() }}
      aria-labelledby="help-others-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-help-others
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="help-others-title" className="text-xl font-bold text-slate-900">
            You finished “{milestone.name}” 🎉
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-800">
          Someone else is working on a step like this right now. What you learned could help them. There are two ways, both in Tidbits:
        </p>
        <div className="mt-4 space-y-3">
          <a href={link('unanswered')} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border-2 border-sky-200 p-3 hover:border-sky-400 hover:bg-sky-50">
            <MessageCircleQuestion className="mt-0.5 h-6 w-6 flex-shrink-0 text-sky-700" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-slate-900">Answer someone’s question</span>
              <span className="block text-sm text-slate-800">Open questions about a step like this one that are still waiting for an answer, and answer one.</span>
            </span>
            <ExternalLink className="ml-auto mt-1 h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
          </a>
          <a href={link('solved')} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border-2 border-emerald-200 p-3 hover:border-emerald-400 hover:bg-emerald-50">
            <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-slate-900">Share what worked, or what didn’t</span>
              <span className="block text-sm text-slate-800">Open solved Tidbits about it, and add what worked for you (or didn’t), so the next person knows.</span>
            </span>
            <ExternalLink className="ml-auto mt-1 h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="h-4 w-4" />
            Don’t ask after each milestone
          </label>
          <button type="button" onClick={close} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Not now
          </button>
        </div>
      </div>
    </dialog>
  )
}
