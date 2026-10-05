'use client'

import Link from 'next/link'
import { useAuth } from '../context/AuthContext'

/** "Sign in" for visitors; signed-in people get back to their Path. */
export default function AccountLink() {
  const { user } = useAuth()
  return (
    <Link href={user ? '/path' : '/login'} className="text-sm font-medium text-indigo-800 underline-offset-4 hover:underline">
      {user ? 'Back to your Path' : 'Sign in'}
    </Link>
  )
}
