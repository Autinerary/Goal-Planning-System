import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { A11Y_COOKIE, cleanA11y } from '@/lib/a11y'

// Set when a signed-out visitor is sent to Goal Planning's sign-in, so a
// second trip within the minute goes to ResourceHub's own sign-in instead.
const SENT_TO_APP = 'autinerary_sent_to_app'

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

  // Cross-app hand-off. Goal Planning's /go/servicehub sends people to the
  // page they asked for with their Supabase session in the link. ProfileSync
  // used to pick it up in the browser, but on a protected page (Tidbits, the
  // shop, your profile) this middleware ran first, found no cookie and sent a
  // signed-in person to Goal Planning's sign-in, which sends signed-in people
  // to their Path: the Tidbits link never reached Tidbits. So the session is
  // set here, server-side, and the same page is reopened without the tokens.
  // If Supabase can't answer in time, the request goes on and ProfileSync
  // still tries in the browser.
  const handoffAccess = request.nextUrl.searchParams.get('access_token')
  const handoffRefresh = request.nextUrl.searchParams.get('refresh_token')
  if (handoffAccess && handoffRefresh) {
    const jar: { name: string; value: string; options: CookieOptions }[] = []
    const handoff = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            jar.push({ name, value, options })
          },
          remove(name: string, options: CookieOptions) {
            jar.push({ name, value: '', options })
          },
        },
      }
    )
    let handoffTimer: ReturnType<typeof setTimeout> | undefined
    try {
      const { error } = await Promise.race([
        handoff.auth.setSession({ access_token: handoffAccess, refresh_token: handoffRefresh }),
        new Promise<never>((_, reject) => {
          handoffTimer = setTimeout(() => reject(new Error('hand-off timed out')), 3000)
        }),
      ])
      if (!error && jar.length) {
        const clean = request.nextUrl.clone()
        clean.searchParams.delete('access_token')
        clean.searchParams.delete('refresh_token')
        clean.searchParams.delete('a11y')
        const redirect = NextResponse.redirect(clean)
        for (const c of jar) redirect.cookies.set({ name: c.name, value: c.value, ...c.options })
        if (a11yCookie) redirect.cookies.set(a11yCookie)
        redirect.cookies.delete(SENT_TO_APP)
        return redirect
      }
    } catch (e) {
      console.warn('[middleware] hand-off skipped:', (e as Error).message)
    } finally {
      if (handoffTimer) clearTimeout(handoffTimer)
    }
    // The hand-off didn't go through (an expired or revoked session, or no
    // answer in time). Open the page rather than sending the person to sign
    // in: Goal Planning, still signed in, would send them straight back here
    // with the same session, and round again, without end (seen on /shop,
    // 11 October 2026). ProfileSync tries once more in the browser; a
    // protected page checks for itself and offers ResourceHub's own sign-in.
    if (a11yCookie) response.cookies.set(a11yCookie)
    return response
  }

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
