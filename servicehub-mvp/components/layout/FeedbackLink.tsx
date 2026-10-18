'use client'

import { feedbackMailto } from '@/lib/feedback'

/** "Send feedback": an email to heydevs@autinerary.ca with the page in it (Goal 8). */
export default function FeedbackLink({ className = '', children = 'Send feedback' }: { className?: string; children?: React.ReactNode }) {
  return (
    <a
      href={feedbackMailto()}
      onClick={(e) => {
        e.currentTarget.href = feedbackMailto(window.location.href)
      }}
      className={className}
    >
      {children}
    </a>
  )
}
