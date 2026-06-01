'use client'

interface IntersectionalityBadgeProps {
  count: number
  barriers: string[]
}

export default function IntersectionalityBadge({ count, barriers }: IntersectionalityBadgeProps) {
  if (count === 0) {
    return null
  }

  return (
    <div className="mt-6 p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="w-8 h-8 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-purple-900">
            You've selected {count} {count === 1 ? 'barrier' : 'barriers'}
          </h3>
          <p className="mt-2 text-sm text-purple-800">
            <strong className="font-semibold">Rated BY people like you, FOR people like you.</strong>
            <br />
            We'll find resources that work for people with your unique combination of experiences.
          </p>
          {barriers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {barriers.slice(0, 6).map((barrier, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                >
                  {barrier}
                </span>
              ))}
              {barriers.length > 6 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  +{barriers.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
