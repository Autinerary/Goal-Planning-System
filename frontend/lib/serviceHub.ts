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
