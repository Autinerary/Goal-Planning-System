/**
 * One-click Apply (the ask, October 2026: "all the resources people just
 * sign up automatically, they just click on it and it signs up"; on the
 * task view an "Apply all" for that page's resources; and nobody has to go
 * to a service's own website or app to apply). STEP 89.
 *
 * Apply emails the service for the person, from Autinerary, with the
 * details they checked once (application_details). The service's reply
 * goes straight to the person's own email, and they get a copy of what was
 * sent. A listing with no email address yet keeps the application
 * ("waiting") until the team adds one at /admin/applications; then it goes
 * out by itself. Places you just go to (parks, cafés, banks…), products and
 * articles have nothing to apply for, so they get no Apply button.
 *
 * Off unless NEXT_PUBLIC_ONE_CLICK_APPLY=on. Pure functions only: the
 * server (app/api/me/applications) and the pages both use them, and
 * lib/applications.test.mjs checks them.
 */

export const APPLY_ON = process.env.NEXT_PUBLIC_ONE_CLICK_APPLY === 'on'

/** Seconds to change your mind after pressing Apply, before it goes. */
export const UNDO_SECONDS = 5

/** Applications one person can start in a day (sent or waiting), so Apply can't be used to flood services. */
export const DAILY_LIMIT = 10

/** How Apply reaches a service: its email now, held for an address, or nothing to apply for. */
export type ApplyHow = 'email' | 'wait' | 'none'

export type ApplicationStatus = 'sent' | 'waiting' | 'cancelled' | 'failed' | 'unreachable'

export type ApplyingFor = 'me' | 'child' | 'someone'
export type ContactBy = 'email' | 'phone' | 'text' | 'any'

export interface ApplicationDetails {
  fullName: string
  phone: string | null
  applyingFor: ApplyingFor
  /** The child's or supported person's first name, if they want it said. */
  theirName: string | null
  theirAge: number | null
  /** What they're looking for, in their own words. */
  needs: string | null
  contactBy: ContactBy
}

export const APPLYING_FOR: ReadonlyArray<{ id: ApplyingFor; label: string }> = [
  { id: 'me', label: 'Me' },
  { id: 'child', label: 'My child' },
  { id: 'someone', label: 'Someone I support' },
]

export const CONTACT_BY: ReadonlyArray<{ id: ContactBy; label: string }> = [
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone call' },
  { id: 'text', label: 'Text message' },
  { id: 'any', label: 'Any of these' },
]

export const LIMITS = { name: 120, phone: 40, needs: 600 } as const

// ── What can be applied to ──────────────────────────────────────────────

/** ResourceHub's categories for places you just go to: no sign-up there. */
const PLACES = new Set(
  ['restaurant', 'café', 'cafe', 'park', 'bank', 'hotel', 'museum', 'amusement park', 'zoo & aquarium', 'cinema', 'store'].map((c) => c.toLowerCase()),
)

export const isPlace = (category: string | null | undefined): boolean => PLACES.has(String(category || '').trim().toLowerCase())

const EMAIL = /^[^@\s<>(),;:"\[\]]+@[^@\s<>(),;:"\[\]]+\.[^@\s<>(),;:"\[\]]{2,}$/

export const isEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 320 && EMAIL.test(v.trim())

/** The listing's own email address, when it has a usable one. */
export function listingEmail(contactInfo: unknown): string | null {
  const email = (contactInfo as { email?: unknown } | null)?.email
  return isEmail(email) ? String(email).trim() : null
}

/**
 * How Apply reaches this listing. Only approved listings; never places,
 * products or articles (a plan tool's `type`, when there is one).
 */
export function howToApply(r: { category?: string | null; status?: string | null; contact_info?: unknown; type?: string | null }): ApplyHow {
  if (r.status && r.status !== 'approved') return 'none'
  if (r.type === 'product' || r.type === 'commentary') return 'none'
  if (isPlace(r.category)) return 'none'
  return listingEmail(r.contact_info) ? 'email' : 'wait'
}

/** Already applied (or the team found no way to reach them): Apply again does nothing. */
export const isApplied = (s: ApplicationStatus | null | undefined): boolean => s === 'sent' || s === 'waiting' || s === 'unreachable'

/** Never applied, cancelled while waiting, or the email didn't go: Apply works. */
export const canApplyAgain = (s: ApplicationStatus | null | undefined): boolean => !isApplied(s)

export interface ApplyItem {
  resourceId: string
  name: string
  how: ApplyHow
  status?: ApplicationStatus | null
}

/** What "Apply all" will do with a page's resources: send now, hold for an address, or leave. */
export function applyAllPlan(items: readonly ApplyItem[]): {
  send: ApplyItem[]
  hold: ApplyItem[]
  done: ApplyItem[]
  none: ApplyItem[]
} {
  const out = { send: [] as ApplyItem[], hold: [] as ApplyItem[], done: [] as ApplyItem[], none: [] as ApplyItem[] }
  const seen = new Set<string>()
  for (const item of items) {
    if (!item?.resourceId || seen.has(item.resourceId)) continue
    seen.add(item.resourceId)
    if (item.how === 'none') out.none.push(item)
    else if (isApplied(item.status)) out.done.push(item)
    else if (item.how === 'email') out.send.push(item)
    else out.hold.push(item)
  }
  return out
}

/** Why this account can't apply, or null. Children's accounts ask a parent or guardian. */
export function applyRefusal(account: { adult: boolean; managed: boolean; hasEmail: boolean }): string | null {
  if (account.managed || !account.adult) return 'Applications are sent from a parent’s or guardian’s account. Ask them to apply for you.'
  if (!account.hasEmail) return 'Your account needs an email address first, so services can reply to you.'
  return null
}

// ── The details, checked ────────────────────────────────────────────────

/** One line: no line breaks or control characters (it goes in an email subject), spaces collapsed. */
const oneLine = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** Several lines allowed, but no other control characters. */
const multiLine = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)

export function cleanDetails(raw: unknown): { ok: true; details: ApplicationDetails } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const fullName = oneLine(r.fullName, LIMITS.name)
  if (!fullName) return { ok: false, error: 'Add your name, so the service knows who is asking.' }
  const phone = oneLine(r.phone, LIMITS.phone) || null
  if (phone && (phone.replace(/\D/g, '').length < 7 || /[^\d\s()+.\-x]/i.test(phone))) {
    return { ok: false, error: 'That phone number doesn’t look right. Leave it empty if you’d rather not share one.' }
  }
  const applyingFor: ApplyingFor = r.applyingFor === 'child' || r.applyingFor === 'someone' ? r.applyingFor : 'me'
  const contactBy: ContactBy = r.contactBy === 'phone' || r.contactBy === 'text' || r.contactBy === 'any' ? r.contactBy : 'email'
  if ((contactBy === 'phone' || contactBy === 'text') && !phone) {
    return { ok: false, error: 'Add a phone number, or choose email, so the service can reach you the way you like.' }
  }
  const theirName = applyingFor === 'me' ? null : oneLine(r.theirName, LIMITS.name) || null
  const age = Number(r.theirAge)
  const theirAge = applyingFor === 'me' || r.theirAge === '' || r.theirAge == null || !Number.isFinite(age) ? null : Math.round(age)
  if (theirAge !== null && (theirAge < 0 || theirAge > 120)) return { ok: false, error: 'Check the age.' }
  const needs = multiLine(r.needs, LIMITS.needs) || null
  return { ok: true, details: { fullName, phone, applyingFor, theirName, theirAge, needs, contactBy } }
}

/** application_details row → details. */
export function detailsFromRow(row: Record<string, unknown> | null | undefined): ApplicationDetails | null {
  if (!row) return null
  const r = cleanDetails({
    fullName: row.full_name,
    phone: row.phone,
    applyingFor: row.applying_for,
    theirName: row.their_name,
    theirAge: row.their_age,
    needs: row.needs,
    contactBy: row.contact_by,
  })
  return r.ok ? r.details : null
}

/** details → application_details row. */
export function detailsToRow(userId: string, d: ApplicationDetails) {
  return {
    user_id: userId,
    full_name: d.fullName,
    phone: d.phone,
    applying_for: d.applyingFor,
    their_name: d.theirName,
    their_age: d.theirAge,
    needs: d.needs,
    contact_by: d.contactBy,
  }
}

/** A first guess at the details from the profile, for the person to check. */
export function defaultDetails(p: { fullName?: string | null; displayName?: string | null; audience?: string | null }): ApplicationDetails {
  const applyingFor: ApplyingFor = p.audience === 'child' ? 'child' : p.audience === 'family' || p.audience === 'friend' || p.audience === 'work' ? 'someone' : 'me'
  return {
    fullName: oneLine(p.fullName || p.displayName || '', LIMITS.name),
    phone: null,
    applyingFor,
    theirName: null,
    theirAge: null,
    needs: null,
    contactBy: 'email',
  }
}

// ── The email the service gets ──────────────────────────────────────────

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const PREFERS: Record<ContactBy, string> = {
  email: 'by email (reply to this message)',
  phone: 'by phone call',
  text: 'by text message',
  any: 'by email, phone call or text',
}

function forWhom(d: ApplicationDetails): string {
  if (d.applyingFor === 'me') return ''
  const who = d.applyingFor === 'child' ? 'their child' : 'someone they support'
  const name = d.theirName ? `, ${d.theirName}` : ''
  const age = d.theirAge !== null ? ` (age ${d.theirAge})` : ''
  return ` for ${who}${name}${age}`
}

/**
 * The email a service gets: who is asking and for whom, what they're
 * looking for in their own words, how to reach them, and a request for the
 * next steps. Nothing else from their account or plan. The pages show this
 * exact text before anything is sent.
 */
export function applicationEmail(input: { details: ApplicationDetails; replyTo: string; serviceName: string; claimUrl: string }): {
  subject: string
  text: string
  html: string
} {
  const d = input.details
  const name = d.fullName
  const service = oneLine(input.serviceName, 200) || 'there'
  const subject = `New request from ${name}, via Autinerary`
  const opening = `${name} would like to start with your service${forWhom(d)}, and asked Autinerary to send you this request.`
  const reach = [`Email: ${input.replyTo}`, ...(d.phone ? [`Phone: ${d.phone}`] : []), `They prefer to be contacted ${PREFERS[d.contactBy]}.`]
  const nextSteps = `Please reply to let ${name} know the next steps: for example an intake form, the wait time, the cost, and anything to have ready.`
  const footer = `Sent by Autinerary (autinerary.ca) at ${name}’s request. Your reply goes straight to ${name}; Autinerary doesn’t see it.`
  const claim = `Not the right address for new requests, or do you run this service? Keep your listing up to date: ${input.claimUrl}`

  const text = [
    `Hello ${service},`,
    '',
    opening,
    ...(d.needs ? ['', 'What they’re looking for:', d.needs] : []),
    '',
    'How to reach them:',
    ...reach,
    '',
    nextSteps,
    '',
    '—',
    footer,
    claim,
  ].join('\n')

  const p = (s: string, style = 'font-size:15px;line-height:1.5;margin:0 0 14px') => `<p style="${style}">${s}</p>`
  const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        ${p(`Hello ${esc(service)},`)}
        ${p(esc(opening))}
        ${d.needs ? `${p('<strong>What they’re looking for:</strong>', 'font-size:15px;margin:0 0 4px')}${p(esc(d.needs).replace(/\n/g, '<br>'))}` : ''}
        ${p('<strong>How to reach them:</strong>', 'font-size:15px;margin:0 0 4px')}
        ${p(reach.map(esc).join('<br>'))}
        ${p(esc(nextSteps))}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
        ${p(esc(footer), 'font-size:13px;line-height:1.5;color:#475569;margin:0 0 8px')}
        ${p(`Not the right address for new requests, or do you run this service? <a href="${esc(input.claimUrl)}" style="color:#1d4ed8">Keep your listing up to date</a>.`, 'font-size:13px;line-height:1.5;color:#475569;margin:0')}
      </div>`
  return { subject, text, html }
}

/** The team's note when a service has its first application waiting for an address (no personal details). */
export function waitingTeamEmail(input: { serviceName: string; adminUrl: string; waiting: number }): { subject: string; text: string } {
  const service = oneLine(input.serviceName, 200)
  return {
    subject: `Apply: ${service} needs an email address`,
    text: `Someone applied to ${service} with one-click Apply, and the listing has no email address, so the application is waiting.\n\nWaiting for this service: ${input.waiting}.\n\nAdd the address (or mark it unreachable) here; everything waiting for it then goes out by itself:\n${input.adminUrl}\n\n- Autinerary`,
  }
}

// ── Saying where an application is ──────────────────────────────────────

/** "26 Oct", as Toronto sees it. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' })
}

export function statusLabel(status: ApplicationStatus | null | undefined, at?: string | null): string {
  switch (status) {
    case 'sent':
      return at ? `Applied ${shortDate(at)}` : 'Applied'
    case 'waiting':
      return 'Applied: we’re finding their email address'
    case 'unreachable':
      return 'We couldn’t reach them by email'
    case 'failed':
      return 'Didn’t send. Try again'
    default:
      return ''
  }
}
