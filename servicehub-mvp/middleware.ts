import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { A11Y_COOKIE, cleanA11y } from '@/lib/a11y'

// Set when a signed-out visitor is sent to Goal Planning's sign-in, so a
// second trip within the minute goes to ResourceHub's own sign-in instead.
const SENT_TO_APP = 'autinerary_sent_to_app'

// A page load (an address typed, a link from elsewhere, a refresh), not one
// of the router's own fetches (Next.js prefetching a linked page before anyone
// clicks it). Next.js removes its router headers before middleware runs, so
// the browser's Sec-Fetch-Mode tells them apart; without it, a page load.
const isPageLoad = (request: NextRequest) => (request.headers.get('sec-fetch-mode') || 'navigate') === 'navigate'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { pathname } = request.nextUrl

  // The app's accessibility settings come with its hand-off link (lib/a11y.ts).
  // They are kept for a year and the page reopens without them; with session
  // tokens too, the redirect below carries the cookie.
  const a11yRaw = request.nextUrl.searchParams.get('a11y')
  const a11yCookie = a11yRaw === null ? null : {
    name: A11Y_COOKIE, value: cleanA11y(a11yRaw), path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const,
  }

  // The cross-app sign-in (app/auth/handoff) handles its own settings and
  // session; nothing here should redirect it first. It used to arrive here
  // with session tokens in the link, set in this middleware; a one-time code
  // replaced them (Riipen Labs, Groups 22 and 24).
  if (pathname === '/auth/handoff') return response

  // Settings with no session: keep them and reopen the page without them.
  if (a11yCookie) {
    const clean = request.nextUrl.clone()
    clean.searchParams.delete('a11y')
    const redirect = NextResponse.redirect(clean)
    redirect.cookies.set(a11yCookie)
    return redirect
  }

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
  // Tidbits' community guidelines are readable before anyone signs in
  // (Riipen Labs, Group 15: "clear moderation policy").
  const isGuidelines = pathname === '/community/guidelines'
  // What is near each college and university, for anyone (the planning
  // note, October 2026: the campus package).
  const isCampus = pathname === '/campus' || pathname.startsWith('/campus/')
  // "Help us rate our resources!" (the planning note's Goal 11), for anyone.
  const isHelpUsRate = pathname === '/help-us-rate'

  if (isPublicRoute || isHomePage || isSearchPage || isResourcePage || isGuidelines || isCampus || isHelpUsRate) {
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
  // The timer is cleared in `finally` rather than left to fire on its own.
  // An uncleared setTimeout keeps rejecting a race that has already been
  // settled, which surfaces as an unhandled rejection, and a pending timer
  // can hold the edge invocation open past the work it was waiting on --
  // the opposite of what a timeout guard is for.
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('auth check timed out')), AUTH_TIMEOUT_MS)
      }),
    ])
    user = result?.data?.user ?? null
  } catch (e) {
    console.warn('[middleware] auth check skipped:', (e as Error).message)
    return response
  } finally {
    if (timer) clearTimeout(timer)
  }

  // If user is not authenticated and trying to access a protected route, redirect to Goal Planning login
  if (!user) {
    // Only a page load counts for the one-minute guard below. A prefetch used
    // to start it, so the click that followed went to ResourceHub's own
    // sign-in instead of the app's (found 20 October 2026: the home page
    // prefetches /shop).
    if (!isPageLoad(request)) {
      const goalPlanningUrl = process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${goalPlanningUrl}/login?returnTo=${encodeURIComponent(request.nextUrl.href)}`)
    }
    // Sent there less than a minute ago and still signed out here: the
    // hand-off isn't working (no session left in the app, say), and going
    // again would loop. ResourceHub's own sign-in instead.
    if (request.cookies.get(SENT_TO_APP)) {
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`
      const toLogin = NextResponse.redirect(login)
      toLogin.cookies.delete(SENT_TO_APP)
      return toLogin
    }
    const goalPlanningUrl = process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000'
    const returnUrl = encodeURIComponent(request.nextUrl.href)
    const redirectUrl = `${goalPlanningUrl}/login?returnTo=${returnUrl}`
    const toApp = NextResponse.redirect(redirectUrl)
    toApp.cookies.set({ name: SENT_TO_APP, value: '1', path: '/', maxAge: 60, sameSite: 'lax' })
    return toApp
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
