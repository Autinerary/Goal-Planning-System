import Link from 'next/link'
import { EyeOff } from 'lucide-react'
import AddRatingButton from './AddRatingButton'

/**
 * A service the monthly rating sweep hid (rated 3.5 or under for two
 * months; the team's planning note, October 2026, Goal 5), as the people who
 * may rate it see it: their new ratings can bring it back above 3.5, and then
 * it returns at the next sweep. Everyone else gets "not found".
 */
export default function HiddenService({ resource }: { resource: { id: string; name: string; category?: string | null; description?: string | null } }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900">{resource.name}</h1>
      {resource.category && <p className="mt-1 text-gray-700">{resource.category}</p>}
      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 text-gray-900">
        <p className="flex items-start gap-2 font-semibold">
          <EyeOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-800" aria-hidden="true" /> Hidden for now
        </p>
        <p className="mt-2 text-sm">
          Its rating stayed at 3.5 out of 5 or under for two months, so it is out of search. Nothing about it is deleted. You can
          still rate it, because it is in your team, you recommended it, or you used it before joining: if new ratings bring it
          above 3.5, it comes back at the next monthly check.
        </p>
        <div className="mt-4">
          <AddRatingButton resourceId={resource.id} resourceName={resource.name} />
        </div>
      </div>
      {resource.description && <p className="mt-6 text-gray-800">{resource.description}</p>}
      <p className="mt-6 text-sm">
        <Link href="/my-resources" className="font-medium text-blue-800 underline">
          Back to my resources
        </Link>
      </p>
    </div>
  )
}
