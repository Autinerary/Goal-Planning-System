import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import PitStopContent from './PitStop'

export const metadata: Metadata = { title: 'Pit Stop · Autinerary' }

const loading = <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">Loading...</div>

/**
 * Pit Stop: tools and supports. People and community moved to their own page,
 * Hare World; links made before that (/pit-stop?tab=haveworld, from emails,
 * ResourceHub or bookmarks) go there.
 */
export default function PitStopView({ searchParams }: { searchParams: { tab?: string; view?: string } }) {
  if (searchParams.tab === 'haveworld') {
    redirect(`/hare-world${searchParams.view ? `?view=${encodeURIComponent(searchParams.view)}` : ''}`)
  }
  return (
    <Suspense fallback={loading}>
      <PitStopContent page="tools" />
    </Suspense>
  )
}
