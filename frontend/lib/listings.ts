import { createHmac, randomInt, timingSafeEqual } from 'crypto'

/**
 * Resource Accounts (the planning note's Goal 11, the Service Provider
 * Dashboard; STEP 81). Server only: the code that proves someone runs a
 * listing, which fields an owner may change, and the signed survey links
 * (V1.5).
 */

function key(label: string): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', label).update(secret).digest()
}

export const CODE_MINUTES = 30
export const CODE_TRIES = 5

/** A six-digit code, sent to the email the listing publishes. */
export const newClaimCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/** Only this is stored: the code can't be read back from it. */
export const claimCodeHash = (claimId: string, code: string) =>
  createHmac('sha256', key('autinerary-listing-claim-v1')).update(`${claimId}|${code}`).digest('base64url')

export function claimCodeMatches(claimId: string, code: unknown, hash: string | null): boolean {
  if (!hash || !/^\d{6}$/.test(String(code || ''))) return false
  const a = Buffer.from(claimCodeHash(claimId, String(code)))
  const b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i
export const usableEmail = (e: unknown) => (typeof e === 'string' && EMAIL.test(e.trim()) && e.length <= 320 ? e.trim() : null)

/** "he***@calm.ca": enough to recognise, not enough to harvest. */
export function maskEmail(e: string): string {
  const [user, domain] = e.split('@')
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`
}

export type ItemKind = 'resource' | 'product'
export const isItemKind = (k: unknown): k is ItemKind => k === 'resource' || k === 'product'

const text = (max: number) => (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
const url = (v: unknown) => {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 300) : undefined
  } catch {
    return undefined
  }
}
const phone = (v: unknown) => (typeof v === 'string' && /^[0-9+().\-\s x]{0,40}$/i.test(v.trim()) ? v.trim() : undefined)
const email = (v: unknown) => (v === '' ? '' : usableEmail(v) ?? undefined)
const oneOf = (...ok: string[]) => (v: unknown) => (v === null || v === '' ? null : typeof v === 'string' && ok.includes(v) ? v : undefined)
const money = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : undefined
}

/**
 * What an owner may change. "now" fields change at once (every change is
 * kept in listing_edits, with what it was before); "review" fields wait for
 * the team, because they change what the listing is (its name, picture or
 * place). Ratings, comments and tags are never the owner's.
 */
export const OWNER_FIELDS: Record<ItemKind, Record<string, { label: string; check: (v: unknown) => unknown; when: 'now' | 'review'; path?: [string, string] }>> = {
  resource: {
    description: { label: 'Description', check: text(2000), when: 'now' },
    phone: { label: 'Phone', check: phone, when: 'now', path: ['contact_info', 'phone'] },
    email: { label: 'Email', check: email, when: 'now', path: ['contact_info', 'email'] },
    website: { label: 'Website', check: url, when: 'now', path: ['contact_info', 'website'] },
    cost_type: { label: 'Free or paid', check: oneOf('free', 'paid'), when: 'now' },
    delivery: { label: 'In person or online', check: oneOf('in_person', 'online', 'both'), when: 'now' },
    name: { label: 'Name', check: text(200), when: 'review' },
    image_url: { label: 'Picture (web address)', check: url, when: 'review' },
    address: { label: 'Address', check: text(300), when: 'review', path: ['location', 'address'] },
  },
  product: {
    description: { label: 'Description', check: text(2000), when: 'now' },
    price: { label: 'Price', check: money, when: 'now' },
    seller: { label: 'Seller', check: text(200), when: 'now' },
    name: { label: 'Name', check: text(200), when: 'review' },
  },
}

/** Splits a requested change into what applies now and what waits, dropping anything not allowed. */
export function splitChanges(kind: ItemKind, changes: Record<string, unknown>) {
  const now: Record<string, unknown> = {}
  const review: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [field, value] of Object.entries(changes || {})) {
    const rule = OWNER_FIELDS[kind][field]
    if (!rule) {
      rejected.push(field)
      continue
    }
    const ok = rule.check(value)
    if (ok === undefined || (field === 'name' && !ok)) {
      rejected.push(field)
      continue
    }
    ;(rule.when === 'now' ? now : review)[field] = ok
  }
  return { now, review, rejected }
}

/** The current value of each owner field, from a listing row. */
export function ownerValues(kind: ItemKind, row: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, rule] of Object.entries(OWNER_FIELDS[kind])) {
    out[field] = rule.path ? row?.[rule.path[0]]?.[rule.path[1]] ?? '' : row?.[field] ?? ''
  }
  return out
}

/** The row update for fields that apply now (nested ones merged into their JSON column). */
export function rowUpdate(kind: ItemKind, row: Record<string, any>, now: Record<string, unknown>) {
  const update: Record<string, any> = {}
  for (const [field, value] of Object.entries(now)) {
    const rule = OWNER_FIELDS[kind][field]
    if (rule.path) {
      const [col, inner] = rule.path
      update[col] = { ...(update[col] || row?.[col] || {}), [inner]: value || null }
    } else update[field] = value === '' ? null : value
  }
  return update
}

/** The V1.5 survey link for a service: signed, so answers can be trusted to come from that listing's email. */
export const surveySignature = (resourceId: string) =>
  createHmac('sha256', key('autinerary-provider-survey-v1')).update(resourceId).digest('base64url')

export function surveySignatureMatches(resourceId: unknown, sig: unknown): boolean {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(resourceId || ''))) return false
    const a = Buffer.from(surveySignature(String(resourceId).toLowerCase()))
    const b = Buffer.from(String(sig || ''))
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const surveyLink = (appUrl: string, resourceId: string) =>
  `${appUrl.replace(/\/$/, '')}/providers/survey?r=${resourceId.toLowerCase()}&t=${encodeURIComponent(surveySignature(resourceId.toLowerCase()))}`

export const step81Missing = (e: { code?: string; message?: string } | null | undefined) =>
  Boolean(e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === 'PGRST202' || /does not exist|schema cache/i.test(e.message || '')))
