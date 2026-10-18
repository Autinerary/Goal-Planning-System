import { Trophy } from 'lucide-react'

/**
 * Community's Choice: a month's winner of the community's vote (the team's
 * planning note, October 2026, Goal 5), on services, shop items and
 * articles. Meant to stand out as much as "Autinerary's Own", in gold, which
 * no colour theme changes (amber and yellow are not themed). Dark amber on
 * light gold is well over 4.5:1.
 */
export default function CommunityChoiceBadge({ month, size = 'sm' }: { month?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 font-bold text-amber-950 shadow-sm ring-1 ring-amber-500 ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <Trophy className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      Community&apos;s Choice
      {month ? <span className="font-semibold">· {month}</span> : null}
    </span>
  )
}

/** "October 2026", from 'YYYY-MM'. */
export function choiceMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
