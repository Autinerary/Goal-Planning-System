'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { goHubHref } from '@/lib/serviceHub'

/**
 * What a page shows before there is a plan: someone who chose "Skip for now"
 * in setup (Riipen Labs, Group 33), or whose plan isn't made yet. Group 31
 * found "most of the app remains empty and meaningless until onboarding is
 * completed". So: what will be here, the one step that fills it, in plain
 * words ("Complete onboarding" was the app's word, not theirs), and what
 * works without a plan in the meantime.
 *
 * `card` sits on the Path where "Your next step" goes; `page` fills a page.
 */
export default function NoPlanYet({ what, variant = 'page' }: { what?: string; variant?: 'page' | 'card' }) {
  const body = (
    <>
      <p className="mt-1 text-sm text-slate-700">
        {what ? `${what} once you make your plan. ` : ''}Making it takes two questions, about two minutes: who it is for, and one
        goal. Then your goal becomes small, clear steps.
      </p>
      <Link
        href="/onboarding"
        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
      >
        Make my plan <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <p className="mt-4 text-sm text-slate-700">
        These work without a plan:{' '}
        <a href={goHubHref('/search')} className="font-medium text-indigo-800 underline underline-offset-2">find services</a>,{' '}
        <a href={goHubHref('/community')} className="font-medium text-indigo-800 underline underline-offset-2">questions and answers in Tidbits</a>,{' '}
        <Link href="/hare-world" className="font-medium text-indigo-800 underline underline-offset-2">your people in Hare World</Link>, and{' '}
        <Link href="/help" className="font-medium text-indigo-800 underline underline-offset-2">what things are called</Link>.
      </p>
    </>
  )
  if (variant === 'card') {
    return (
      <section aria-labelledby="no-plan-heading" className="mb-6 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
        <h2 id="no-plan-heading" className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Your first step</h2>
        <p className="mt-1 text-lg font-bold text-slate-900">Make your plan</p>
        {body}
      </section>
    )
  }
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <section aria-labelledby="no-plan-heading" className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 id="no-plan-heading" className="text-xl font-bold text-slate-900">No plan yet</h1>
        {body}
      </section>
    </div>
  )
}
