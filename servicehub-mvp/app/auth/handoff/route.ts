import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { A11Y_COOKIE, cleanA11y } from '@/lib/a11y'

export const dynamic = 'force-dynamic'

// Set by the middleware when a signed-out visitor is sent to the app's sign-in.
const SENT_TO_APP = 'autinerary_sent_to_app'

/**
 * Cross-app sign-in: /auth/handoff?token_hash=<one-time code>&next=<path>&a11y=<settings>
 *
 * The app is where people sign in. Its /go/servicehub page gets a one-time
 * code for the signed-in person (frontend/app/api/hub-handoff) and sends them
 * here; this exchanges it for ResourceHub's own session, server-side, so the
 * page they asked for opens signed in, with no second sign-in (Riipen Labs,
 * Groups 22 and 24). The code works once and expires, and it is used at once.
 *
 * This used to take the app's access and refresh tokens from the link and set
 * them as the session, which put a reusable refresh token in browser history
 * and request logs. Links with tokens are no longer accepted.
 *
 * `next` must be a path on this site (no open redirect). If the code has
 * expired or was used, the page opens signed out, where it offers sign-in.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash') || ''
  const nextParam = url.searchParams.get('next') || '/'
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/\\') ? nextParam : '/'
  const response = NextResponse.redirect(new URL(safeNext, url.origin))

  // The app's accessibility settings come along (lib/a11y.ts).
  const a11y = url.searchParams.get('a11y')
  if (a11y !== null) {
    response.cookies.set({ name: A11Y_COOKIE, value: cleanA11y(a11y), path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }
  response.cookies.delete(SENT_TO_APP)
  if (!tokenHash) return response

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

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const { error } = await Promise.race([
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timed out')), 5000) }),
    ])
    // Never log the code itself.
    if (error) console.warn('[auth/handoff] sign-in code not accepted:', error.message)
  } catch (e) {
    console.warn('[auth/handoff] sign-in code skipped:', (e as Error).message)
  } finally {
    if (timer) clearTimeout(timer)
  }
  return response
}
