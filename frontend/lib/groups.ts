/**
 * Groups: a student group or a service someone uses Autinerary with (the organisations of STEP 17, with STEP 102):
 * joined with the group's code, left at any time. A group's own crisis lines, such as its campus counselling, show on
 * its members' crisis card (app/components/CrisisLines), and its leaders see the safety check's counts for the group,
 * week by week, never anyone's words and never who (organization_safety_counts). Plain data, no imports but types.
 */
import type { CrisisLine } from './crisis'

export type GroupRole = 'member' | 'leader'
export type Group = { id: string; name: string; role: GroupRole; lines: CrisisLine[]; joinCode?: string }

export const MAX_LINES = 5
export const MIN_MEMBERS_FOR_COUNTS = 10

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const digits = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '').slice(0, max) : '')

/** A group's crisis lines as they may be kept: a name and what to do, and a number to call or text (or both); at
 *  most 5. Anything else is dropped. */
export function cleanCrisisLines(raw: unknown): CrisisLine[] {
  const out: CrisisLine[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const name = text(r.name, 80)
    const how = text(r.how, 200)
    const tel = digits(r.tel, 15)
    const sms = digits(r.sms, 10)
    const smsBody = sms ? text(r.smsBody, 30).replace(/[^A-Za-z0-9 ]/g, '') : ''
    if (!name || !how || (tel.length < 3 && sms.length < 3)) continue
    out.push({ name, how, ...(tel.length >= 3 ? { tel } : {}), ...(sms.length >= 3 ? { sms, ...(smsBody ? { smsBody } : {}) } : {}) })
    if (out.length === MAX_LINES) break
  }
  return out
}

/** The groups as the browser gets them (app/api/me/groups): a join code only for a group's leaders. */
export function readGroups(raw: unknown): Group[] {
  const list = Array.isArray((raw as { groups?: unknown })?.groups) ? (raw as { groups: unknown[] }).groups : []
  return list.flatMap((g) => {
    const r = (g || {}) as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : ''
    const name = text(r.name, 120)
    if (!id || !name) return []
    const role: GroupRole = r.role === 'leader' ? 'leader' : 'member'
    const joinCode = role === 'leader' && typeof r.joinCode === 'string' ? r.joinCode : undefined
    return [{ id, name, role, lines: cleanCrisisLines(r.lines), ...(joinCode ? { joinCode } : {}) }]
  })
}

/** "student-group-at-u-of-t" */
export function slugFor(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'group'
}

/** A join code people can read out and type: 3 groups of 4, without letters that look alike (0/O, 1/I/L). */
export function newJoinCode(randomBytes: (n: number) => Uint8Array): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(12)
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

/** What a leader sees: a count, or "fewer than 3" when it is 1 or 2 (hidden by the database). */
export function countWords(n: number | null | undefined, smallest = 3): string {
  return n === null ? `fewer than ${smallest}` : String(n ?? 0)
}
