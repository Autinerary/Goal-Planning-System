/**
 * One-click sign-up in the app (the ask, October 2026: "a button that I
 * click on and I sign up for the service, bypassing filling in the form on
 * their site"). Each service's steps and the runner are lib/signupKit.ts.
 *
 * "Sign me up" signs the person up on the service itself, with what they
 * checked once (their first and last name; their account's email), by the
 * first of these that can:
 *   - a partner service's own connection (lib/signupPartners.ts): no form at all;
 *   - the Autinerary desktop app, in a window of its own, when the person is in it;
 *   - the Autinerary extension, in their own browser (lib/signupExtension.ts);
 *   - the server robot (lib/signupRobot.ts), for services with no robot check;
 *   - otherwise it says what is needed (the extension, or the Autinerary app).
 * The phone app has its own Sign up screen (mobile/screens/SignupScreen.tsx).
 * Each new account gets its own strong password, shown to the person once to
 * save; Autinerary never keeps it. Every sign-up is recorded in
 * service_signups (STEP 90), so the button then says how it went.
 *
 * Off unless NEXT_PUBLIC_ONE_CLICK_SIGNUP=on. Pure functions only; tested
 * by lib/signups.test.mjs.
 */

export const SIGNUP_ON = process.env.NEXT_PUBLIC_ONE_CLICK_SIGNUP === 'on'

export const STATUSES = ['started', 'signed_up', 'check_email', 'needs_you', 'exists', 'failed', 'requested'] as const
export type SignupStatus = (typeof STATUSES)[number]

export const RUNNERS = ['extension', 'desktop', 'mobile', 'server', 'partner', 'email', 'form'] as const
export type Runner = (typeof RUNNERS)[number]

export const isStatus = (v: unknown): v is SignupStatus => typeof v === 'string' && (STATUSES as readonly string[]).includes(v)
export const isRunner = (v: unknown): v is Runner => typeof v === 'string' && (RUNNERS as readonly string[]).includes(v)

/** Signed up, waiting on their email, they had an account, or a request went: Sign me up isn't offered again. */
export const isSettled = (s: SignupStatus | null | undefined): boolean => s === 'signed_up' || s === 'check_email' || s === 'exists' || s === 'requested'

/** Server robot runs one person can start in a day. */
export const ROBOT_DAILY_LIMIT = 10

export const NAME_MAX = 60

export interface SignupDetails {
  firstName: string
  lastName: string
}

const oneLine = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** "Sam Lee" → Sam / Lee; "Mary Ann Lee" → Mary Ann / Lee; "Sam" → Sam / "". */
export function splitName(full: string | null | undefined): SignupDetails {
  const words = oneLine(full, NAME_MAX * 2).split(' ').filter(Boolean)
  if (words.length <= 1) return { firstName: words[0] || '', lastName: '' }
  return { firstName: words.slice(0, -1).join(' ').slice(0, NAME_MAX), lastName: words[words.length - 1].slice(0, NAME_MAX) }
}

/** Both names: most services' forms ask for both. */
export function cleanDetails(raw: unknown): { ok: true; details: SignupDetails } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const firstName = oneLine(r.firstName, NAME_MAX)
  const lastName = oneLine(r.lastName, NAME_MAX)
  if (!firstName) return { ok: false, error: 'Add your first name.' }
  if (!lastName) return { ok: false, error: 'Add your last name: most services ask for one.' }
  return { ok: true, details: { firstName, lastName } }
}

/** Why this account can't use Sign me up, or null. */
export function signupRefusal(account: { adult: boolean; managed: boolean; hasEmail: boolean }): string | null {
  if (account.managed || !account.adult) return 'Sign-ups are made from a parent’s or guardian’s account. Ask them to sign you up.'
  if (!account.hasEmail) return 'Your account needs an email address first: services send their emails there.'
  return null
}

/** What runs it: a partner's connection; else the desktop app or the extension; else the server robot where the service allows it. */
export function pickRunner(opts: { partner?: boolean; desktop?: boolean; extension: boolean; robot: boolean }): Runner | null {
  if (opts.partner) return 'partner'
  if (opts.desktop) return 'desktop'
  if (opts.extension) return 'extension'
  if (opts.robot) return 'server'
  return null
}

/** "Oct 26", as Toronto sees it. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' })
}

/** Where a sign-up is, next to the service. */
export function statusLabel(status: SignupStatus | null | undefined, kind: 'account' | 'newsletter' | 'request', at?: string | null): string {
  const day = shortDate(at)
  switch (status) {
    case 'signed_up':
      return `${kind === 'newsletter' ? 'Subscribed' : 'Signed up'}${day ? ` ${day}` : ''}`
    case 'check_email':
      return 'Check your email to finish'
    case 'exists':
      return 'You already have an account'
    case 'needs_you':
      return 'Waiting for you to finish on their page'
    case 'failed':
      return 'Didn’t go through. Try again'
    case 'started':
      return 'Signing you up…'
    case 'requested':
      return `Request sent${day ? ` ${day}` : ''}: they’ll reply to you`
    default:
      return ''
  }
}

/** What happened, in a sentence, for the page's live note. */
export function outcomeMessage(name: string, kind: 'account' | 'newsletter' | 'request', status: SignupStatus | 'timeout', detail?: string | null): string {
  switch (status) {
    case 'requested':
      // Emailed to the address their website shows (app/api/me/signups/request): say which.
      if (detail?.startsWith('website_email:')) return `Your request went to ${name}, by email to the address on their website (${detail.slice(14)}). They’ll reply to you by email, and you have a copy.`
      return `Your request went to ${name}. They’ll reply to you by email, and you have a copy if it was emailed.`
    case 'signed_up':
      return kind === 'newsletter' ? `Subscribed to ${name}.` : `Signed up for ${name}. Save your new password now: it’s shown once.`
    case 'check_email':
      return `${name} sent you an email: open it to finish.${kind === 'account' ? ' Save your new password now: it’s shown once.' : ''}`
    case 'exists':
      return `You already have ${kind === 'newsletter' ? 'a subscription to' : 'an account with'} ${name}.`
    case 'needs_you':
      if (kind === 'request') {
        return detail === 'robot_check'
          ? `${name}’s website wants to check you’re not a robot before the request can go.`
          : `${name}’s form asks something only you can answer${detail?.startsWith('question:') ? ` (${detail.slice(9).trim()})` : ''}.`
      }
      return detail === 'robot_check'
        ? `${name} wants to check you’re not a robot: finish it in the ${name} tab.`
        : `There’s a step only you can do: finish it in the ${name} tab.`
    case 'timeout':
      return `${name} took too long to answer. Try again.`
    default:
      if (kind === 'request') return `Your request couldn’t go to ${name}${detail ? ` (${oneLine(detail, 140).replace(/\.$/, '')})` : ''}.`
      return `${name} didn’t take it${detail ? ` (“${oneLine(detail, 140)}”)` : ''}. If you already have an account there, log in instead.`
  }
}

export interface SignupItem {
  service: string
  name: string
  status?: SignupStatus | null
  /** What can run it for this person right now. */
  runner: Runner | null
}

/** What "Sign up for all" will do with a page's services: sign up, already done, or can't from here. */
export function signupPlan(items: readonly SignupItem[]): { go: SignupItem[]; done: SignupItem[]; cant: SignupItem[] } {
  const out = { go: [] as SignupItem[], done: [] as SignupItem[], cant: [] as SignupItem[] }
  const seen = new Set<string>()
  for (const item of items) {
    if (!item?.service || seen.has(item.service)) continue
    seen.add(item.service)
    if (isSettled(item.status)) out.done.push(item)
    else if (item.runner) out.go.push(item)
    else out.cant.push(item)
  }
  return out
}
