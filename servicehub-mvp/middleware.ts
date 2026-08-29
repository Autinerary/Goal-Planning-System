import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { pathname } = request.nextUrl

  // Work out whether this route needs auth BEFORE doing any network calls.
  //
  // supabase.auth.getUser() is a round trip to Supabase's auth server, and it
  // used to run on EVERY request — including /api/*, the home page, search and
  // resource pages, where the result was computed and then thrown away. Every
  // one of those paid the latency, and when the auth call was slow Vercel
  // killed the whole middleware with MIDDLEWARE_INVOCATION_TIMEOUT, which is
  // the 504 seen after adding a wishlist resource.
  //
  // '/verify' is the professional-attestation page: the clinician has no
  // account, so it must stay reachable signed-out (it's useless without a
  // valid one-time token anyway).
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/api/', '/verify/']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isHomePage = pathname === '/'
  const isSearchPage = pathname.startsWith('/search')
  const isResourcePage = pathname.startsWith('/resources')

  if (isPublicRoute || isHomePage || isSearchPage || isResourcePage) {
    // Nothing here depends on who the user is, so don't ask.
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
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components.
  //
  // Bounded: an unbounded await here is what let one slow auth response take
  // down the whole page with a gateway timeout. If the check cannot answer in
  // time we let the request through rather than hanging — a page that renders
  // and does its own auth check is far better than a 504, and every protected
  // page re-verifies server-side anyway. Middleware is a redirect convenience
  // here, not the security boundary.
  const AUTH_TIMEOUT_MS = 3000
  let user = null
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auth check timed out')), AUTH_TIMEOUT_MS)
      ),
    ])
    user = result?.data?.user ?? null
  } catch (e) {
    console.warn('[middleware] auth check skipped:', (e as Error).message)
    return response
  }

  // If user is not authenticated and trying to access a protected route, redirect to Goal Planning login
  if (!user) {
    const goalPlanningUrl = process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000'
    const returnUrl = encodeURIComponent(request.nextUrl.href)
    const redirectUrl = `${goalPlanningUrl}/login?returnTo=${returnUrl}`
    
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    // api/* excluded at the matcher too: those routes do their own auth and
    // gain nothing from middleware but latency.
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
