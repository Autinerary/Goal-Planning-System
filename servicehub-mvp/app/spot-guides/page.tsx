import { redirect } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SpotGuideQueue from '@/components/spotGuides/SpotGuideQueue'
import { createClient } from '@/lib/supabase/server'
import { isSpotGuide } from '@/lib/spotGuides'

export const metadata = { title: 'Spot Guides | ResourceHub' }

/**
 * Spot Guides: review what the service-adding loop and the bulk imports
 * found before it is shown (the team's planning note, October 2026, Goal 1:
 * "continuous Service-adding loop with Spot Guides (for now, use agents)").
 */
export default async function SpotGuidesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/spot-guides')
  const allowed = await isSpotGuide(supabase)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Spot Guides</h1>
          {allowed ? (
            <>
              <p className="mt-2 mb-6 max-w-2xl text-gray-700">
                Places found by the daily loop and the bulk imports wait here until a Spot Guide approves them. Look at a
                few, then approve or hide the batch. Only the facts a mapper recorded are listed; what a place is like
                comes from ratings.
              </p>
              <SpotGuideQueue />
            </>
          ) : (
            <p className="mt-2 text-gray-700">This page is for Spot Guides. Ask the Autinerary team if you would like to be one.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
