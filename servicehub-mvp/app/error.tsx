'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import ErrorState from '@/components/feedback/ErrorState'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console in development
    console.error('Application error:', error)
    
    // In production, you could send to error tracking service
    // logErrorToService(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Something went wrong"
          message={
            error.message || 
            'An unexpected error occurred. Please try again or contact support if the problem persists.'
          }
          onRetry={reset}
          showRetry={true}
        />
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  )
}