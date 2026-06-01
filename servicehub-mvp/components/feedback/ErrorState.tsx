'use client'

import { AlertTriangle, RefreshCw, Wifi, WifiOff, Server } from 'lucide-react'
import Link from 'next/link'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  showRetry?: boolean
  errorType?: 'network' | 'server' | 'not-found' | 'unauthorized' | 'validation' | 'unknown'
}

export default function ErrorState({
  title,
  message,
  onRetry,
  showRetry = false,
  errorType = 'unknown',
}: ErrorStateProps) {
  const getIcon = () => {
    switch (errorType) {
      case 'network':
        return <WifiOff className="w-12 h-12 text-red-600" aria-hidden="true" />
      case 'server':
        return <Server className="w-12 h-12 text-red-600" aria-hidden="true" />
      case 'not-found':
        return <AlertTriangle className="w-12 h-12 text-yellow-600" aria-hidden="true" />
      case 'unauthorized':
        return <AlertTriangle className="w-12 h-12 text-red-600" aria-hidden="true" />
      default:
        return <AlertTriangle className="w-12 h-12 text-red-600" aria-hidden="true" />
    }
  }

  const getDefaultTitle = () => {
    switch (errorType) {
      case 'network':
        return 'Connection Error'
      case 'server':
        return 'Server Error'
      case 'not-found':
        return 'Not Found'
      case 'unauthorized':
        return 'Access Denied'
      case 'validation':
        return 'Validation Error'
      default:
        return 'Something went wrong'
    }
  }

  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-4" aria-hidden="true">
        {getIcon()}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {title || getDefaultTitle()}
      </h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {message}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-h-[44px] min-w-[120px]"
            aria-label="Retry action"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
        )}
        {errorType === 'network' && (
          <div className="text-sm text-gray-500">
            Check your internet connection and try again
          </div>
        )}
        {errorType === 'server' && (
          <Link
            href="/contact"
            className="text-sm text-blue-600 hover:text-blue-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Contact Support
          </Link>
        )}
      </div>
    </div>
  )
}