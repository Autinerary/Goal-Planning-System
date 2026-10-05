import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { needsSetup } from '@/lib/onboarding/profile'

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

    // A chosen role, or any norm from an older setup, means setup is done.
    // The topic can be skipped now, so norms alone cannot say (Group 8).
    return NextResponse.json({
      needsOnboarding: await needsSetup(supabase, user.id),
    })
  } catch (error) {
    console.error('Error checking onboarding status:', error)
    return NextResponse.json({ needsOnboarding: false }, { status: 200 })
  }
}
