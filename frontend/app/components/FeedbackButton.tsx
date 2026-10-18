'use client'

import { MessageSquareHeart } from 'lucide-react'
import { FEEDBACK_EMAIL, feedbackMailto } from '@/lib/feedback'

/**
 * "Send feedback": an email to heydevs@autinerary.ca from the person's own
 * email app, with the page they were on (Goal 8). `className` styles it for
 * where it sits (the bar, a footer, a settings button).
 */
export default function FeedbackButton({ className = '', label = 'Send feedback', icon = true, iconClassName = 'h-4 w-4' }: { className?: string; label?: string; icon?: boolean; iconClassName?: string }) {
  return (
    <a
      href={feedbackMailto()}
      onClick={(e) => {
        e.currentTarget.href = feedbackMailto(window.location.href)
      }}
      className={className}
      title={`Email ${FEEDBACK_EMAIL}`}
      data-info="Opens an email to the Autinerary team, with this page in it, so you can tell us what happened or share an idea."
    >
      {icon && <MessageSquareHeart className={iconClassName} aria-hidden="true" />}
      <span>{label}</span>
    </a>
  )
}
