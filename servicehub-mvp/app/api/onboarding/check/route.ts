import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserBarriers } from '@/lib/supabase/queries'

/**
 * Check if the current user needs to complete onboarding
 * Returns { needsOnboarding: boolean }
 */
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ needsOnboarding: false }, { status: 200 })
    }

    // Check if user has barriers (indicates onboarding is complete)
    const barriers = await getUserBarriers(user.id)

    return NextResponse.json({
      needsOnboarding: barriers.length === 0,
    })
  } catch (error) {
    console.error('Error checking onboarding status:', error)
    return NextResponse.json({ needsOnboarding: false }, { status: 200 })
  }
}
