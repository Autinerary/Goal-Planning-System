import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Ignore - can be called from Server Component
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Ignore - can be called from Server Component
            }
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_error`)
    }
    
    // Email confirmations and Google sign-ins both land here. Google does not
    // share a date of birth, so a new Google account answers that first
    // (the 18+ rule; setup cannot finish without it). Everyone else goes on
    // to setup, or to their Path if setup is done.
    if (data?.user) {
      const u = data.user
      const onboarded = u.user_metadata?.has_completed_onboarding === true
      if (!onboarded && !u.app_metadata?.date_of_birth && !u.user_metadata?.date_of_birth) {
        return NextResponse.redirect(`${origin}/auth/age`)
      }
      return NextResponse.redirect(`${origin}${onboarded ? '/path' : '/onboarding'}`)
    }
  }

  // Redirect to home page after successful authentication
  return NextResponse.redirect(`${origin}/`)
}
