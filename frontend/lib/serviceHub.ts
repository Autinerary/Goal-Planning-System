/**
 * Build a Goal Planning → ServiceHub link that carries the user's session.
 *
 * Returns a SAME-ORIGIN GP url (`/go/servicehub?next=…`) so plain <a> tags work.
 * The /go/servicehub page forwards the Supabase session to ServiceHub's
 * /auth/handoff, so the user lands signed in. Never link straight to
 * NEXT_PUBLIC_SERVICE_HUB_URL — that arrives signed out.
 *
 * @param path ServiceHub path to land on, e.g. '/community?from=hare-world'.
 */
export function goHubHref(path: string = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `/go/servicehub?next=${encodeURIComponent(p)}`
}

/**
 * Where to send someone ResourceHub sent to sign in (`/login?returnTo=<hub
 * URL>`), as a hand-off link, or null when `returnTo` is not a ResourceHub
 * page. A person who was already signed in here used to be sent to their
 * Path instead, and after signing in they went to the bare ResourceHub URL,
 * which arrives signed out. Only ResourceHub's own address is accepted (no
 * open redirect), and any session tokens in it are dropped.
 */
export function hubReturnHref(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null
  try {
    const hub = new URL(process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001')
    const target = new URL(returnTo)
    if (target.origin !== hub.origin) return null
    target.searchParams.delete('access_token')
    target.searchParams.delete('refresh_token')
    return goHubHref(`${target.pathname}${target.search}${target.hash}`)
  } catch {
    return null
  }
}
