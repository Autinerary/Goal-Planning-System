/**
 * A small open model on this device (Settings, "Use my own model"), called from the browser.
 *
 * Our backend runs on Render and can't reach anyone's laptop, so the browser does it: it talks to Ollama's
 * OpenAI-compatible API (by default http://localhost:11434/v1) and passes the answers back to the agents
 * (lib/deviceRun.ts, backend/api/routes/device.py). Only addresses on this machine are accepted, so the model really
 * is on the person's device.
 *
 * Ollama only answers web pages it has been told to trust. Pages on localhost are trusted by default, so local
 * development works as is; for the live site the person starts Ollama with our origin allowed, for example
 *   macOS:  launchctl setenv OLLAMA_ORIGINS "https://app.autinerary.ca"   (then quit and reopen Ollama)
 *   Linux:  OLLAMA_ORIGINS="https://app.autinerary.ca" ollama serve
 * Without it the browser blocks the reply (a CORS error), which pingOwnModel reports as 'blocked'. Chrome may also
 * ask the person to allow this site to reach devices on their network; that is the browser's own question.
 *
 * Stored in this browser only: it's a preference, not a credential.
 */

export type OwnModelSettings = {
  enabled: boolean
  baseUrl: string
  model: string
}

export const DEFAULT_OWN_MODEL: OwnModelSettings = {
  enabled: false,
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2:3b',
}

const STORAGE_KEY = 'autinerary.ownModel.v1'

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void }
const browserStorage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage)

/** The base URL if it points at this machine (localhost, 127.0.0.1 or ::1), cleaned; otherwise null. */
export function cleanBaseUrl(value: string): string | null {
  try {
    const url = new URL(String(value || '').trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/** A model name as Ollama writes them (llama3.2:3b, my-tuned/model:latest), or null. */
export function cleanModelName(value: string): string | null {
  const name = String(value || '').trim()
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(name) ? name : null
}

export function loadOwnModel(storage: Storage | null = browserStorage()): OwnModelSettings {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_OWN_MODEL
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed?.enabled === true,
      baseUrl: cleanBaseUrl(parsed?.baseUrl) ?? DEFAULT_OWN_MODEL.baseUrl,
      model: cleanModelName(parsed?.model) ?? DEFAULT_OWN_MODEL.model,
    }
  } catch {
    return DEFAULT_OWN_MODEL
  }
}

export function saveOwnModel(settings: OwnModelSettings, storage: Storage | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // A full or blocked localStorage must not break the page.
  }
}

export type Ping =
  | { ok: true; models: string[]; hasModel: boolean }
  | { ok: false; reason: 'bad-address' | 'unreachable' | 'blocked' | 'error'; detail?: string }

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** Is the model server answering, and does it have the model named in Settings? */
export async function pingOwnModel(settings: OwnModelSettings, fetchFn: FetchFn = fetch, timeoutMs = 4000): Promise<Ping> {
  const base = cleanBaseUrl(settings.baseUrl)
  if (!base) return { ok: false, reason: 'bad-address' }
  try {
    const res = await withTimeout(timeoutMs, (signal) => fetchFn(`${base}/models`, { signal, cache: 'no-store' }))
    if (!res.ok) return { ok: false, reason: 'error', detail: `HTTP ${res.status}` }
    const body = await res.json().catch(() => ({}))
    const models = Array.isArray(body?.data) ? body.data.map((m: any) => String(m?.id || '')).filter(Boolean) : []
    const want = settings.model.trim()
    const hasModel = models.some((m: string) => m === want || m === `${want}:latest` || `${m}:latest` === want)
    return { ok: true, models, hasModel }
  } catch (e: any) {
    // A server that refuses this site and one that isn't running look the same to a page (a TypeError), so the
    // message covers both; a timeout means nothing answered at all.
    if (e?.name === 'AbortError') return { ok: false, reason: 'unreachable' }
    return { ok: false, reason: 'blocked', detail: String(e?.message || e) }
  }
}

export type Ask = {
  messages: { role: string; content: string }[]
  temperature?: number | null
  max_tokens?: number | null
  json?: boolean
}

/** One answer from the model on this device. Throws if it can't answer. */
export async function askOwnModel(settings: OwnModelSettings, ask: Ask, fetchFn: FetchFn = fetch,
                                  timeoutMs = 170_000): Promise<string> {
  const base = cleanBaseUrl(settings.baseUrl)
  const model = cleanModelName(settings.model)
  if (!base || !model) throw new Error('Your model settings are not complete.')
  const body: Record<string, unknown> = { model, messages: ask.messages, stream: false }
  if (typeof ask.temperature === 'number') body.temperature = ask.temperature
  if (typeof ask.max_tokens === 'number') body.max_tokens = ask.max_tokens
  const post = (payload: Record<string, unknown>) =>
    withTimeout(timeoutMs, (signal) => fetchFn(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    }))
  let res = await post(ask.json ? { ...body, response_format: { type: 'json_object' } } : body)
  // Some models can't do JSON mode; the agent's prompt already asks for JSON, so ask once more without it.
  if (!res.ok && ask.json) res = await post(body)
  if (!res.ok) throw new Error(`Your model answered with HTTP ${res.status}.`)
  const out = await res.json()
  const content = out?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('Your model sent back an empty answer.')
  return content
}

/** What to tell the person when a ping fails. */
export function pingMessage(ping: Ping, origin = typeof window === 'undefined' ? '' : window.location.origin): string {
  if (ping.ok) return ping.hasModel ? 'Your model is answering.' : 'Ollama is answering, but the model name above isn’t installed.'
  switch (ping.reason) {
    case 'bad-address':
      return 'The address must be on this computer (localhost or 127.0.0.1).'
    case 'unreachable':
      return 'Nothing answered at that address. Is Ollama running?'
    case 'blocked':
      return `Ollama isn’t running, or it isn’t allowing this site yet. Allow ${origin || 'this site'} with OLLAMA_ORIGINS and restart Ollama.`
    default:
      return `Ollama answered with an error${ping.detail ? ` (${ping.detail})` : ''}.`
  }
}

/** Before a plan: make it on this device, or ask the person first. Never a cloud model without asking. */
export type PlanRoute = { route: 'device' } | { route: 'ask'; why: string }

export function planRoute(ping: Ping, signedIn: boolean, origin?: string): PlanRoute {
  if (!signedIn) return { route: 'ask', why: 'you need to be signed in to use it.' }
  if (ping.ok && ping.hasModel) return { route: 'device' }
  return { route: 'ask', why: pingMessage(ping, origin) }
}

/** The question asked before a cloud model is used instead. */
export function cloudFallbackQuestion(why: string, cloudModel?: string): string {
  return (
    `Your own model isn't ready: ${why}\n\n` +
    `Make this plan with ${cloudModel || 'our usual cloud model'} instead? ` +
    "That model runs in the cloud, so your plan's prompts go to that AI company."
  )
}
