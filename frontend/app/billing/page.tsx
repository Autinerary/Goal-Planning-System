import type { Metadata } from 'next'
import { Suspense } from 'react'
import BillingPanel from './BillingPanel'

export const metadata: Metadata = {
  title: 'Billing · Autinerary',
  description: 'Your plan, your free month, and free access.',
}

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Suspense>
          <BillingPanel />
        </Suspense>
      </div>
    </div>
  )
}
