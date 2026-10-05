import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { needsSetup } from '@/lib/onboarding/profile'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_error`)
    }
    
    // After successful email confirmation, check if user needs onboarding
    if (data?.user) {
      try {
        // No role and no norms yet: setup has not been done.
        if (await needsSetup(supabase, data.user.id)) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      } catch (err) {
        console.error('Error checking user barriers:', err)
        // If check fails, still redirect to onboarding to be safe
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  // Redirect to home page after successful authentication
  return NextResponse.redirect(`${origin}/`)
}
