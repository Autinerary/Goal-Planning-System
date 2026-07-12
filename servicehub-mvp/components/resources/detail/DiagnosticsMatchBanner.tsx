import { Brain, Users } from 'lucide-react'

interface DiagnosticsMatchBannerProps {
  /** Formatted barrier/Diagnostics profile labels, e.g. ["Autism", "ADHD"]. */
  profileLabels: string[]
  /** How many users who matched the Diagnostics profile rated this resource highly. */
  similarUserCount: number
  /** Average rating those similar users gave (0 when unknown). */
  averageRating?: number
}

/**
 * Explains why a resource is relevant to the signed-in user, framed around the
 * people who share their Diagnostics profile. Rendered on the resource detail
 * page so the "why" is visible outside the recommendation grid too.
 */
export default function DiagnosticsMatchBanner({
  profileLabels,
  similarUserCount,
  averageRating = 0,
}: DiagnosticsMatchBannerProps) {
  const profile = profileLabels.length ? profileLabels.slice(0, 3).join(', ') : 'your profile'

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex items-start gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
        <Brain className="w-4 h-4 text-white" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-900">
          Based on those who matched your Diagnostics profile
        </p>
        <p className="text-sm text-indigo-700 mt-0.5">
          {similarUserCount > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 font-medium">
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                {similarUserCount} {similarUserCount === 1 ? 'person' : 'people'}
              </span>{' '}
              with a profile like yours ({profile}) rated this highly
              {averageRating >= 4 ? ` — ${averageRating.toFixed(1)}★ average.` : '.'}
            </>
          ) : (
            <>Relevant to your Diagnostics profile ({profile}).</>
          )}
        </p>
      </div>
    </div>
  )
}
