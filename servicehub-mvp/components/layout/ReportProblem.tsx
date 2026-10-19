'use client'

import { Flag } from 'lucide-react'
import { feedbackMailto, type FeedbackAbout } from '@/lib/feedback'

/**
 * "Report a problem with this listing" (the products round, Goal 11): an
 * email to heydevs@ labelled [Listing] [Service] (or Product, Article) with
 * the listing's name, so the team knows at once which one it is.
 */
export default function ReportProblem({ about, name }: { about: FeedbackAbout; name: string }) {
  return (
    <a
      href={feedbackMailto('', { kind: 'listing', about, item: name })}
      onClick={(e) => {
        e.currentTarget.href = feedbackMailto(window.location.href, { kind: 'listing', about, item: name })
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800 underline underline-offset-2 hover:text-gray-900"
    >
      <Flag className="h-4 w-4" aria-hidden="true" /> Report a problem with this listing
    </a>
  )
}
