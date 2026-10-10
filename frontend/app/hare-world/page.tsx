import type { Metadata } from 'next'
import { Suspense } from 'react'
import PitStopContent from '../pit-stop/PitStop'

export const metadata: Metadata = { title: 'Hare World · Autinerary' }

/** Hare World: friends, mentors, role models and groups (app/pit-stop/PitStop.tsx). */
export default function HareWorldView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">Loading...</div>}>
      <PitStopContent page="people" />
    </Suspense>
  )
}
