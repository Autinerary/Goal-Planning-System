import type { Metadata } from 'next'
import { Suspense } from 'react'
import BusinessDashboard from './BusinessDashboard'

export const metadata: Metadata = {
  title: 'Resource Account · Autinerary',
  description: 'For services and product sellers in ResourceHub: keep your listing right, see how people use it, and ask for a promotion.',
}

/** The Resource Account dashboard (the planning note's Goal 11: the Service Provider Dashboard). */
export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Suspense>
          <BusinessDashboard />
        </Suspense>
      </div>
    </div>
  )
}
