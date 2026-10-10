'use client'

/**
 * Exactly how karma is counted: _community_apply_vote and
 * community_accept_answer in scripts/2026_community_tidbits.sql. Change this
 * line if that rule changes.
 */
export const HELPFUL_POINTS_RULE =
  'Up-votes minus down-votes on their posts and answers, plus 15 for each accepted answer.'

interface HelpfulPointsProps {
  karma: number
  className?: string
}

/**
 * An author's karma, named for what it is. It used to read "N found
 * helpful", but down-votes subtract and an accepted answer adds 15, so it
 * was never a count of people; Riipen Labs, Group 34 also found karma
 * unexplained. The rule is in the tooltip and, for screen readers, in text.
 */
export default function HelpfulPoints({ karma, className }: HelpfulPointsProps) {
  return (
    <span
      title={HELPFUL_POINTS_RULE}
      className={`cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2 ${className ?? ''}`}
    >
      {karma} helpful {Math.abs(karma) === 1 ? 'point' : 'points'}
      <span className="sr-only"> ({HELPFUL_POINTS_RULE})</span>
    </span>
  )
}
