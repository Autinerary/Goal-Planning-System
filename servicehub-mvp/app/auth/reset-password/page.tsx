'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Supabase password reset emails redirect here with hash fragments
    // We redirect to the actual reset password page
    // The hash fragments will be preserved and processed by Supabase client
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      // Use window.location to preserve hash fragments
      window.location.href = `/reset-password${hash ? hash : ''}`
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to password reset...</p>
      </div>
    </div>
  )
}
