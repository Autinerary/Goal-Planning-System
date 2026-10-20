'use client'

import { XCircle } from 'lucide-react'
import CommonMistakes from '@/app/components/CommonMistakes'
import { guidanceSource, type StepGuidance } from '@/lib/guidanceData'

/**
 * "Top 5 mistakes made at this stage" (the team's notes on the Milestone
 * view, October 2026: "Negatives - What NOT to do should be highlighted as
 * much"), in red, as strongly as the tools are. The same five the Race view's
 * Avoidance view shows for this step (lib/guidanceData.ts). Below them, once
 * 5 people have reflected at this stage, what actually tripped them up
 * (CommonMistakes, counted from reflections).
 */
export default function TopMistakes({
  milestoneId,
  guidance,
  loading = false,
  failed = false,
  className = '',
}: {
  milestoneId: string
  guidance: StepGuidance | null
  loading?: boolean
  failed?: boolean
  className?: string
}) {
  const headingId = `top-mistakes-${milestoneId}`
  return (
    <section aria-labelledby={headingId} className={`rounded-2xl border-2 border-red-300 bg-red-50 p-4 ${className}`} data-top-mistakes>
      <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold text-red-900">
        <XCircle className="h-5 w-5" aria-hidden="true" />
        Top 5 mistakes made at this stage
      </h2>
      {guidance ? (
        <>
          <ol className="mt-3 space-y-2">
            {guidance.avoid.map((item, i) => (
              <li key={item} className="flex items-start gap-2 text-sm font-semibold text-red-800">
                <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-red-900">{guidanceSource(guidance)}</p>
        </>
      ) : loading ? (
        <p className="mt-2 text-sm text-red-900" role="status">Writing the top mistakes for this step…</p>
      ) : (
        <p className="mt-2 text-sm text-red-900">{failed ? 'This list couldn’t load right now. Try again later.' : 'No list for this step yet.'}</p>
      )}
      <CommonMistakes milestoneId={milestoneId} />
    </section>
  )
}
