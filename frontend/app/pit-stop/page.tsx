'use client'

import { useEffect } from 'react'

// Service Hub URL - defaults to localhost:3001 (Service Hub should run on a different port)
const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

export default function PitStopView() {
  useEffect(() => {
    // Redirect to Service Hub immediately
    // Using replace instead of href to avoid adding to browser history
    window.location.replace(SERVICE_HUB_URL)
  }, [])

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Service Hub...</p>
        <p className="text-sm text-gray-400 mt-2">If you are not redirected, <a href={SERVICE_HUB_URL} className="text-blue-600 underline">click here</a></p>
      </div>
    </div>
  )
}
