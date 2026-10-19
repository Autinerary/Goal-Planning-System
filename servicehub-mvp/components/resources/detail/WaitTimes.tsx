import Link from 'next/link'
import { Hourglass } from 'lucide-react'
import { waitLabel } from '@/lib/waits'

// Where waits are long: therapy and diagnosis, school supports, and social
// services (the 5Qs report: "Waittime is a universal bug").
const WAITS_COMMON = new Set(['therapist', 'doctor', 'education support', 'social services'])

/**
 * How long the wait is (the 5Qs report, October 2026: "Waittime is a
 * universal bug (solution MUST be highlighted in SHub!!!)"): what people who
 * rated it said (the middle answer of the last two years), what the service
 * says itself (from its Resource Account, with when), and what helps while
 * you wait.
 */
export default function WaitTimes({
  resource,
  shortWaits = 0,
}: {
  resource: { name: string; category: string; wait_reported?: string | null; wait_reports?: number | null; wait_stated?: string | null; wait_stated_at?: string | null }
  /** How many services have a short wait on record: the link shows once some do. */
  shortWaits?: number
}) {
  if (resource.category === 'commentary') return null
  const reported = waitLabel(resource.wait_reported)
  const stated = waitLabel(resource.wait_stated)
  const common = WAITS_COMMON.has(String(resource.category || '').toLowerCase())
  if (!reported && !stated && !common) return null
  return (
    <section aria-labelledby="wait-heading" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 id="wait-heading" className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <Hourglass className="h-5 w-5 text-blue-700" aria-hidden="true" /> How long the wait is
      </h2>
      {reported || stated ? (
        <ul className="mt-2 space-y-1.5 text-sm text-gray-900">
          {reported && (
            <li>
              People who used it waited about <strong>{reported.toLowerCase()}</strong>
              <span className="text-gray-700"> ({resource.wait_reports} {resource.wait_reports === 1 ? 'person' : 'people'} said)</span>.
            </li>
          )}
          {stated && (
            <li>
              {resource.name} says: <strong>{stated.toLowerCase()}</strong>
              {resource.wait_stated_at && (
                <span className="text-gray-700"> (updated {new Date(resource.wait_stated_at).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })})</span>
              )}
              .
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-800">No one has said yet. When you rate it, you can say how long you waited.</p>
      )}
      {common && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm font-semibold text-gray-900">While you wait</p>
          <ul className="mt-1 space-y-1 text-sm">
            <li>
              <Link href="/search?tags=parent_support" className="font-medium text-blue-800 underline underline-offset-2">Support for parents and caregivers</Link>
            </li>
            <li>
              <Link href="/search?tags=funding" className="font-medium text-blue-800 underline underline-offset-2">Help paying for services</Link>
            </li>
            <li>
              <Link href="/search?cost=free" className="font-medium text-blue-800 underline underline-offset-2">Free services</Link>
            </li>
            {shortWaits > 0 && (
              <li>
                <Link href="/search?wait=short" className="font-medium text-blue-800 underline underline-offset-2">Services with short waits</Link>
              </li>
            )}
            <li>
              <Link href="/community?q=wait" className="font-medium text-blue-800 underline underline-offset-2">Tidbits from people who waited</Link>
            </li>
          </ul>
        </div>
      )}
    </section>
  )
}
