/**
 * One-click sign-up for local services (the account holder's choice, 25
 * October 2026, STEP 91). Most of ResourceHub is clinics, programs and
 * centres with no online sign-up, so Sign me up sends the person's request
 * instead, and the service replies to them:
 *   - by email, where the listing has an address (Autinerary sends it; the
 *     reply goes to the person; they get a copy);
 *   - through the contact or booking form on the listing's own website, where
 *     it only has a website (lib/signupKit.ts runContactForm fills it in);
 *   - not at all where it has neither: it says there's no online way to reach
 *     them yet.
 * Places you just go to (parks, cafés, banks…) have nothing to sign up for.
 *
 * Pure functions only (lib/requests.test.mjs).
 */

import type { FoundEmail } from './signupKit'

export type RequestHow = 'email' | 'form' | 'none'

export type ApplyingFor = 'me' | 'child' | 'someone'
export type ContactBy = 'email' | 'phone' | 'text' | 'any'

/** What a request carries besides the name and the account's email; all optional. */
export interface RequestExtras {
  phone: string | null
  applyingFor: ApplyingFor
  theirName: string | null
  theirAge: number | null
  needs: string | null
  contactBy: ContactBy
}

export const NO_EXTRAS: RequestExtras = { phone: null, applyingFor: 'me', theirName: null, theirAge: null, needs: null, contactBy: 'email' }

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

export const LIMITS = { name: 60, phone: 40, needs: 500 } as const

/** Requests one person can send in a day (email and website forms), so the button can't flood services. */
export const REQUEST_DAILY_LIMIT = 10

// ── Which listings, and how ─────────────────────────────────────────────

const PLACES = new Set(['restaurant', 'café', 'cafe', 'park', 'bank', 'hotel', 'museum', 'amusement park', 'zoo & aquarium', 'cinema', 'store'])

export const isPlace = (category: string | null | undefined): boolean => PLACES.has(String(category || '').trim().toLowerCase())

const EMAIL = /^[^@\s<>(),;:"\[\]]+@[^@\s<>(),;:"\[\]]+\.[^@\s<>(),;:"\[\]]{2,}$/

export const isEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 320 && EMAIL.test(v.trim())

/** The listing's own website (never OpenStreetMap's page about it). */
export function listingWebsite(r: { contact_info?: unknown; source_url?: string | null; source_type?: string | null }): string | null {
  const own = (r.contact_info as { website?: unknown } | null)?.website
  const site = typeof own === 'string' && own.trim() ? own.trim() : r.source_type === 'openstreetmap' ? null : r.source_url || null
  if (!site || /openstreetmap\.org/i.test(site)) return null
  try {
    const u = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** How a request reaches this listing: its email, its website's form, or no way online. */
export function howToRequest(r: { category?: string | null; status?: string | null; contact_info?: unknown; source_url?: string | null; source_type?: string | null }): RequestHow {
  if ((r.status && r.status !== 'approved') || isPlace(r.category)) return 'none'
  const email = (r.contact_info as { email?: unknown } | null)?.email
  if (isEmail(email)) return 'email'
  return listingWebsite(r) ? 'form' : 'none'
}

// ── When their website has no form: the address it shows ───────────────

// Addresses that are never for a new client's request.
const NOT_FOR_REQUESTS = /^(no-?reply|do-?not-?reply|donotreply|bounces?|mailer-daemon|privacy|privacyofficer|webmaster|web|website|accessibility|aoda|media|press|news|newsletters?|communications|comms|marketing|careers?|jobs?|employment|hr|humanresources|recruit(ing|ment)?|hiring|billing|accounts?|accounting|accountspayable|payables|receivables|payroll|finance|invoices?|donat(e|ions?)|giving|fundrais(e|ing)|foi|foip|fippa|atip|complaints?|feedback|abuse|postmaster|hostmaster|security|unsubscribe|it|helpdesk|servicedesk|tech|purchasing|procurement|legal|volunteers?|volunteering|events?|sponsors?|sponsorship|partnerships?|ads|advertising|trustees?|board|chair|president|ceo|foundation|alumni|store|shop|orders?)$/
// …nor is a part of one that names a council, a PTA or the like ("cspc.stmichael@": a Catholic school parent council).
const NOT_FOR_REQUESTS_PART = /^(cspc|csac|sac|pta|pto|psc|ptsa|parents?|council|parentcouncil|schoolcouncil|alumni|foundation|trustees?|union|local\d*)$/
// A front door: where a service's new requests go.
const FRONT_DOOR = /^(info|information|contact|contactus|contact-us|hello|hi|intake|reception|frontdesk|front\.desk|front-desk|office|admin|administration|appointments?|booking|bookings|book|referrals?|inquiries|enquiries|inquiry|enquiry|general|clinic|care|mail|team|programs?|registration|register|admissions?|enrol(l)?ments?|enrol(l)?|newclients?|newpatients?|services|support|help|ask|questions|connect|welcome)$/
const FRONT_DOOR_PART = /info|intake|referr|appoint|booking|enquir|inquir|admission|regist|reception|office|contact|enrol/
// The words on its line: for new clients (the best), for anything (good), or for something else (never).
const NEW_CLIENT_WORDS = /intake|referral|new (client|patient)s?|appointment|booking|admissions?|registration|register|enrol|waitlist|wait list/i
const ANY_WORDS = /general (inquir|enquir)|inquiries|enquiries|contact us|front desk|reception|get in touch|questions/i
const BAD_WORDS = /media|press|career|job posting|employment|privacy|accessibility|complain|billing|invoice|donat|volunteer|webmaster|website by|designed by|powered by|web design|sponsor|trustee|parent council|school council|fundrais|board of directors|advertis|technical support|report a (problem|bug)|unsubscribe|alumni/i
const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|aol|protonmail|proton|gmx|shaw|rogers|bell|sympatico|telus|cogeco|videotron|eastlink|sasktel|mts)\.(com|ca|net|me)$/
const NOT_REAL = /(^|\.)(example\.(com|org|net|ca)|domain\.(com|ca)|yourdomain\.[a-z]+|yoursite\.[a-z]+|mysite\.com|website\.com|email\.com|company\.com|test\.com|sample\.com|sentry\.io|wixpress\.com|squarespace\.com|godaddy\.com|wordpress\.(com|org)|wpengine\.com|cloudflare\.com|schema\.org|w3\.org|autinerary\.(ca|app|com))$|\.(png|jpe?g|gif|svg|webp|ico|css|js|pdf)$/
// Words in a listing's name that say nothing about which address is its own.
const NAME_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'saint', 'centre', 'center', 'centres', 'centers', 'community', 'school', 'schools', 'elementary', 'secondary', 'public', 'catholic', 'high', 'middle', 'junior', 'senior', 'academy', 'college', 'university', 'clinic', 'clinics', 'health', 'healthcare', 'medical', 'services', 'service', 'program', 'programs', 'family', 'families', 'children', 'child', 'kids', 'youth', 'adult', 'adults', 'city', 'society', 'association', 'foundation', 'care', 'support', 'group', 'therapy', 'therapies', 'counselling', 'counseling', 'mental', 'wellness', 'place', 'house', 'home', 'canada', 'ontario', 'toronto', 'library', 'branch', 'recreation', 'space', 'drop'])
// Canadian (and other) second-level names: "toronto.on.ca" is one site, "x.gc.ca" another.
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'gc', 'on', 'bc', 'ab', 'sk', 'mb', 'qc', 'nb', 'ns', 'pe', 'nl', 'nt', 'nu', 'yk', 'yt'])

const siteOf = (host: string): string => {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean)
  return parts.slice(parts.length >= 3 && parts[parts.length - 1].length === 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? -3 : -2).join('.')
}

const nameWords = (name: string | null | undefined): string[] =>
  String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 4 && !NAME_STOP.has(w))

/**
 * Which of the addresses a service's website shows gets the request, when it
 * has no contact form to fill in: its front door (info@, intake@, the
 * centre's own name@) on its own web address, a name-matching free mail
 * address for a small practice, never media@, billing@, a web designer's or
 * a parent council's; a named person only where nothing better is there and
 * it's on the service's own web address. null: none fits, so the request
 * doesn't go.
 */
export function pickSiteEmail(found: readonly FoundEmail[] | null | undefined, listing: { name?: string | null; website?: string | null }): string | null {
  const words = nameWords(listing.name)
  let site: string | null = null
  try { site = listing.website ? siteOf(new URL(listing.website).hostname) : null } catch {}
  let best: { email: string; score: number; mailto: boolean } | null = null
  for (const f of found || []) {
    const email = String(f?.email || '').trim().toLowerCase()
    if (!isEmail(email) || NOT_REAL.test(email)) continue
    const [local, domain] = email.split('@')
    if (local.length > 40 || /[0-9a-f]{12,}/.test(local) || NOT_FOR_REQUESTS.test(local)) continue
    const letters = local.replace(/[^a-z]/g, '')
    const named = words.some((w) => letters.includes(w))
    const ownSite = !!site && siteOf(domain) === site
    // Someone else's address (a web designer, a partner, the parent body): no.
    if (!ownSite && !named && !words.some((w) => domain.replace(/[^a-z]/g, '').includes(w)) && !FREE_MAIL.test(domain)) continue
    const door = FRONT_DOOR.test(local)
    const doorPart = !door && FRONT_DOOR_PART.test(local)
    const parts = local.split(/[._+-]/).filter(Boolean)
    if (parts.some((p) => NOT_FOR_REQUESTS_PART.test(p))) continue
    const person = parts.length === 2 && parts.every((p) => /^[a-z]+$/.test(p)) && !door && !doorPart && !parts.some((p) => words.includes(p))
    const context = String(f?.context || '')
    const bad = BAD_WORDS.test(context)
    const onItsLine = bad ? -4 : NEW_CLIENT_WORDS.test(context) ? 3 : ANY_WORDS.test(context) ? 1 : 0
    const score = (named ? 3 : 0) + (door ? 2 : doorPart ? 1 : 0) + (ownSite ? 2 : 0) + (f?.mailto ? 1 : 0) + onItsLine + (person ? -2 : 0)
    if (score >= 3 && (!best || score > best.score || (score === best.score && !!f?.mailto && !best.mailto))) best = { email, score, mailto: !!f?.mailto }
  }
  return best?.email || null
}

/** A listing's key in service_signups: "r-" and its id without dashes. */
export const listingKey = (resourceId: string): string => `r-${resourceId.replace(/-/g, '').toLowerCase()}`

export function resourceIdOfKey(key: string): string | null {
  const m = /^r-([0-9a-f]{32})$/.exec(key)
  if (!m) return null
  const h = m[1]
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ── The extras, checked ─────────────────────────────────────────────────

const oneLine = (v: unknown, max: number): string =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

const multiLine = (v: unknown, max: number): string =>
  String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

export function cleanExtras(raw: unknown): { ok: true; extras: RequestExtras } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const phone = oneLine(r.phone, LIMITS.phone) || null
  if (phone && (phone.replace(/\D/g, '').length < 7 || /[^\d\s()+.\-x]/i.test(phone))) {
    return { ok: false, error: 'That phone number doesn’t look right. Leave it empty if you’d rather not share one.' }
  }
  const applyingFor: ApplyingFor = r.applyingFor === 'child' || r.applyingFor === 'someone' ? r.applyingFor : 'me'
  const contactBy: ContactBy = r.contactBy === 'phone' || r.contactBy === 'text' || r.contactBy === 'any' ? r.contactBy : 'email'
  if ((contactBy === 'phone' || contactBy === 'text') && !phone) return { ok: false, error: 'Add a phone number, or choose email, so services can reach you the way you like.' }
  const theirName = applyingFor === 'me' ? null : oneLine(r.theirName, LIMITS.name) || null
  const age = Number(r.theirAge)
  const theirAge = applyingFor === 'me' || r.theirAge === '' || r.theirAge == null || !Number.isFinite(age) ? null : Math.round(age)
  if (theirAge !== null && (theirAge < 0 || theirAge > 120)) return { ok: false, error: 'Check the age.' }
  const needs = multiLine(r.needs, LIMITS.needs) || null
  return { ok: true, extras: { phone, applyingFor, theirName, theirAge, needs, contactBy } }
}

// ── What the service gets ───────────────────────────────────────────────

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const PREFERS: Record<ContactBy, string> = {
  email: 'by email',
  phone: 'by phone call',
  text: 'by text message',
  any: 'by email, phone call or text',
}

function forWhom(x: RequestExtras): string {
  if (x.applyingFor === 'me') return ''
  const who = x.applyingFor === 'child' ? 'their child' : 'someone they support'
  return ` for ${who}${x.theirName ? `, ${x.theirName}` : ''}${x.theirAge !== null ? ` (age ${x.theirAge})` : ''}`
}

export interface RequestInput {
  firstName: string
  lastName: string
  email: string
  extras: RequestExtras
  serviceName: string
}

/**
 * The email a service gets: who is asking, for whom, what they're looking
 * for, how to reach them. Nothing else (no link to Autinerary's listings: the
 * account holder's choice, 26 October 2026, so it is only the person's
 * request), but who sent it and a way to stop requests to this address
 * (lib/requestLinks.ts).
 */
export function requestEmail(input: RequestInput & { stopUrl: string; fromWebsite?: boolean; postal?: string | null }): { subject: string; text: string; html: string } {
  const name = oneLine(`${input.firstName} ${input.lastName}`, 120)
  const x = input.extras
  const service = oneLine(input.serviceName, 200) || 'there'
  const subject = `New request from ${name}, via Autinerary`
  const opening = `${name} would like to start with your service${forWhom(x)}, and asked Autinerary to send you this request.`
  const reach = [`Email: ${input.email}`, ...(x.phone ? [`Phone: ${x.phone}`] : []), `They prefer to be contacted ${PREFERS[x.contactBy]}.`]
  const next = `Please reply to let ${name} know the next steps: for example an intake form, the wait time, the cost, and anything to have ready.`
  const footer = `Sent by Autinerary (autinerary.ca) at ${name}’s request${input.fromWebsite ? ', to the address on your website' : ''}. Your reply goes straight to ${name}; Autinerary doesn’t see it.`
  const text = [
    `Hello ${service},`, '', opening, ...(x.needs ? ['', 'What they’re looking for:', x.needs] : []), '', 'How to reach them:', ...reach, '', next, '', '—', footer,
    `Not the right address for requests like this? Stop them: ${input.stopUrl}`,
    ...(input.postal ? [`Autinerary Corp., ${oneLine(input.postal, 200)}`] : []),
  ].join('\n')
  const p = (s: string, style = 'font-size:15px;line-height:1.5;margin:0 0 14px') => `<p style="${style}">${s}</p>`
  const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        ${p(`Hello ${esc(service)},`)}
        ${p(esc(opening))}
        ${x.needs ? `${p('<strong>What they’re looking for:</strong>', 'font-size:15px;margin:0 0 4px')}${p(esc(x.needs).replace(/\n/g, '<br>'))}` : ''}
        ${p('<strong>How to reach them:</strong>', 'font-size:15px;margin:0 0 4px')}
        ${p(reach.map(esc).join('<br>'))}
        ${p(esc(next))}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
        ${p(esc(footer), 'font-size:13px;line-height:1.5;color:#475569;margin:0 0 8px')}
        ${p(`Not the right address for requests like this? <a href="${esc(input.stopUrl)}" style="color:#1d4ed8">Stop them</a>.`, 'font-size:13px;line-height:1.5;color:#475569;margin:0')}
        ${input.postal ? p(esc(`Autinerary Corp., ${oneLine(input.postal, 200)}`), 'font-size:13px;line-height:1.5;color:#475569;margin:8px 0 0') : ''}
      </div>`
  return { subject, text, html }
}

/** The message typed into a service's contact form: in the person's voice, short, plain. */
export function formMessage(input: RequestInput): string {
  const x = input.extras
  const name = oneLine(`${input.firstName} ${input.lastName}`, 120)
  const forWho = x.applyingFor === 'me' ? '' : ` for my ${x.applyingFor === 'child' ? 'child' : 'family member'}${x.theirName ? `, ${x.theirName}` : ''}${x.theirAge !== null ? ` (${x.theirAge})` : ''}`
  const lines = [
    `Hello, I'm ${name}. I'd like to start with your service${forWho}.`,
    ...(x.needs ? [`What I'm looking for: ${oneLine(x.needs, LIMITS.needs)}`] : []),
    `Please let me know the next steps (for example an intake form, the wait time and the cost). You can reach me at ${input.email}${x.phone ? ` or ${x.phone}` : ''}; I prefer ${PREFERS[x.contactBy]}.`,
    'Thank you. (Sent with Autinerary.)',
  ]
  return lines.join('\n\n').slice(0, 1200)
}

/** A subject line, for forms that ask for one. */
export const formSubject = (input: RequestInput): string => `New client request: ${oneLine(`${input.firstName} ${input.lastName}`, 120)}`
