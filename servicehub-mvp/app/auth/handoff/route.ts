import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Cross-app SSO handoff.
 *
 * Goal Planning is the auth authority. Because the two apps live on different
 * domains, ServiceHub can't read Goal Planning's session cookie — so GP's
 * `/go/servicehub` bounce sends the user here with the Supabase tokens (both
 * apps share one Supabase project). We set the session SERVER-SIDE so the very
 * next render is already signed in (the old client-only `ProfileSync` set the
 * session after the page had already rendered signed-out, which is why users
 * saw "signed out" on arrival), then redirect to `next`.
 *
 * `next` must be a same-origin path (open-redirect guard).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const accessToken = url.searchParams.get('access_token') || ''
  const refreshToken = url.searchParams.get('refresh_token') || ''
  const nextParam = url.searchParams.get('next') || '/'
  const origin = url.origin

  const safeNext = nextParam.startsWith('/') ? nextParam : '/'
  const response = NextResponse.redirect(`${origin}${safeNext}`)

  // No tokens (e.g. GP user wasn't signed in) — just proceed anonymously.
  if (!accessToken || !refreshToken) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) {
      console.error('[auth/handoff] setSession failed:', error.message)
    }
  } catch (e) {
    console.error('[auth/handoff] setSession threw:', e)
  }

  return response
}
