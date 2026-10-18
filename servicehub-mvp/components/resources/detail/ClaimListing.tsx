import { Building2 } from 'lucide-react'
import { APP_URL } from '@/lib/appSignIn'

/**
 * "Run this service?": the way into a Resource Account (the planning note,
 * October 2026, Goal 11), in the app at /business, where the listing is
 * claimed with a code sent to its own email, or checked by the team.
 */
export default function ClaimListing({ kind, id }: { kind: 'resource' | 'product'; id: string }) {
  return (
    <section aria-labelledby={`claim-${id}`} className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 id={`claim-${id}`} className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <Building2 className="h-5 w-5 text-blue-800" aria-hidden="true" /> {kind === 'product' ? 'Sell this product?' : 'Run this service?'}
      </h2>
      <p className="mt-1 text-sm text-gray-800">
        Claim this listing to keep its details right and see how people use it (counts only, never who). Ratings and comments
        stay the community&apos;s.
      </p>
      <a href={`${APP_URL}/business?claim=${kind}:${id}`} className="mt-2 inline-block text-sm font-semibold text-blue-800 underline underline-offset-2">
        Claim this listing
      </a>
    </section>
  )
}
