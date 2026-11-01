/**
 * A training set from your own writing (Settings, Models, "Build my training set";
 * app/settings/models/training-set/page.tsx).
 *
 * The backend lists your journal entries, reflections and plan notes, scrubs the ones you pick, and records which
 * ones you approved (backend/api/routes/training.py). This turns the approved ones into the file you train on, made
 * in this browser and saved to your computer: JSON lines in the chat format small-model tools read, one
 * {"messages": [...]} per line. Each example is our question (not your words) and your scrubbed answer.
 */

export type ItemKind = 'reflection' | 'note'

export type TrainingItem = {
  kind: ItemKind
  id: string
  label: string
  date: string
  prompt: string
  text: string
}

export type ScrubbedItem = {
  kind: ItemKind
  id: string
  label: string
  date: string
  /** The question the answer goes with, scrubbed too. */
  prompt: string
  before: string
  after: string
  found: Record<string, number>
}

export type ScrubResponse = { version: string; names: boolean; items: ScrubbedItem[]; missing: number }
export type ConsentRecord = { id: string; createdAt: string; itemCount: number; scrubberVersion: string }

export const SYSTEM_PROMPT =
  'You are a kind, plain-spoken planning helper. You know from lived experience what makes a step easier or harder.'

export const itemKey = (item: { kind: string; id: string }): string => `${item.kind}:${item.id}`

/** One training example: our question, and the person's scrubbed answer. */
export function chatExample(item: { prompt: string; after: string }) {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: item.prompt },
      { role: 'assistant', content: item.after.trim() },
    ],
  }
}

/** The file: one chat example per line. Items left empty after editing are left out. */
export function toJsonl(items: { prompt: string; after: string }[]): string {
  const lines = items.filter((item) => item.after.trim()).map((item) => JSON.stringify(chatExample(item)))
  return lines.length ? `${lines.join('\n')}\n` : ''
}

export function trainingFileName(now = new Date()): string {
  return `my-training-set-${now.toISOString().slice(0, 10)}.jsonl`
}

const KIND_WORDS: Record<string, [string, string]> = {
  name: ['name', 'names'],
  email: ['email address', 'email addresses'],
  link: ['link', 'links'],
  phone: ['phone number', 'phone numbers'],
  id_number: ['ID number', 'ID numbers'],
  address: ['address', 'addresses'],
  date_of_birth: ['date of birth', 'dates of birth'],
  diagnosis: ['diagnosis', 'diagnoses'],
  medication: ['medicine', 'medicines'],
  school: ['school', 'schools'],
  employer: ['employer', 'employers'],
  organization: ['organisation', 'organisations'],
}

/** "Replaced 2 names and 1 school", or "Nothing found to replace". */
export function foundSummary(found: Record<string, number>): string {
  const parts = Object.entries(found || {})
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${(KIND_WORDS[kind] || [kind, kind])[n === 1 ? 0 : 1]}`)
  if (!parts.length) return 'Nothing found to replace'
  return `Replaced ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`}`
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

async function call<T>(apiUrl: string, token: string, path: string, body: unknown, fetchFn: FetchFn): Promise<T> {
  const res = await fetchFn(`${apiUrl.replace(/\/$/, '')}/api/training${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof out?.detail === 'string' ? out.detail : 'That didn’t work. Please try again.')
  return out as T
}

export const listItems = (apiUrl: string, token: string, fetchFn: FetchFn = fetch) =>
  call<{ items: TrainingItem[] }>(apiUrl, token, '/items', undefined, fetchFn)

export const scrubItems = (apiUrl: string, token: string, items: { kind: ItemKind; id: string }[], fetchFn: FetchFn = fetch) =>
  call<ScrubResponse>(apiUrl, token, '/scrub', { items: items.map(({ kind, id }) => ({ kind, id })) }, fetchFn)

/** Text the person edited, scrubbed again, so a name typed back in is caught too. */
export const scrubTexts = (apiUrl: string, token: string, texts: string[], fetchFn: FetchFn = fetch) =>
  call<{ version: string; texts: { after: string; found: Record<string, number> }[] }>(apiUrl, token, '/scrub', { texts }, fetchFn)

export const recordConsent = (apiUrl: string, token: string, items: { kind: ItemKind; id: string }[], scrubberVersion: string,
                              fetchFn: FetchFn = fetch) =>
  call<{ saved: boolean; id: string; createdAt: string; itemCount: number; scrubberVersion: string }>(
    apiUrl, token, '/consent', { items: items.map(({ kind, id }) => ({ kind, id })), scrubberVersion }, fetchFn)

export const listConsents = (apiUrl: string, token: string, fetchFn: FetchFn = fetch) =>
  call<{ available: boolean; records: ConsentRecord[] }>(apiUrl, token, '/consent', undefined, fetchFn)
