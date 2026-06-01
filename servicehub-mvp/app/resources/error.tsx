'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ErrorState from '@/components/feedback/ErrorState'

export default function ResourceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Resource error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Unable to load resource"
          message={
            error.message.includes('not found') || error.message.includes('404')
              ? 'The resource you\'re looking for doesn\'t exist or has been removed.'
              : error.message || 
                'There was an error loading this resource. Please try again.'
          }
          onRetry={reset}
          showRetry={true}
        />
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Search
          </Link>
        </div>
      </div>
    </div>
  )
}