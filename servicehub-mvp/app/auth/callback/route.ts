import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserBarriers } from '@/lib/supabase/queries'

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
        const barriers = await getUserBarriers(data.user.id)
        
        // If user has no barriers, they haven't completed onboarding - redirect to onboarding
        if (barriers.length === 0) {
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
