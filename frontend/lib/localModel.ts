/**
 * A small open model on this device (Settings, "Use my own model"), called from the browser.
 *
 * Our backend runs on Render and can't reach anyone's laptop, so the browser does it: it talks to Ollama at the
 * address of its OpenAI-compatible API (by default http://localhost:11434/v1), asking through Ollama's own API beside
 * it so the agents' longest prompts fit (OLLAMA_CONTEXT), and passes the answers back to the agents (lib/deviceRun.ts,
 * backend/api/routes/device.py). Another server on this machine is asked through the OpenAI-compatible API. Only
 * addresses on this machine are accepted, so the model really is on the person's device.
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
  /** Where the model runs: Ollama on this computer, or inside this browser with nothing to install (lib/browserModel.ts). */
  runtime: 'ollama' | 'browser'
  browserModel: string
  /** For a model that can think before it answers (Qwen3): only on the plan itself ('main'), or never ('off'). Thinking
   *  takes a laptop 1 to 3 minutes an answer, so everything else is answered straight away. */
  thinking: 'main' | 'off'
  /** Whether the model can think first, as the last status check found. */
  thinks: boolean
}

export const DEFAULT_OWN_MODEL: OwnModelSettings = {
  enabled: false,
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2:3b',
  runtime: 'ollama',
  browserModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  thinking: 'main',
  thinks: false,
}

// Thinking first takes up to this many more tokens before the answer (Ollama counts both).
const THINK_ALLOWANCE = 6000

// Room for the agents' longest prompts (Tool Recommendation's shortlists, about 6,500 tokens) and the answer, thinking
// included. Ollama otherwise runs a model at 4,096 tokens and quietly cuts a longer prompt to fit; its
// OpenAI-compatible API can't change that, its own API can.
export const OLLAMA_CONTEXT = 16384

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
      runtime: parsed?.runtime === 'browser' ? 'browser' : 'ollama',
      browserModel: typeof parsed?.browserModel === 'string' && /^[A-Za-z0-9._-]{3,80}-MLC$/.test(parsed.browserModel)
        ? parsed.browserModel : DEFAULT_OWN_MODEL.browserModel,
      thinking: parsed?.thinking === 'off' ? 'off' : 'main',
      thinks: parsed?.thinks === true,
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
  | { ok: true; models: string[]; hasModel: boolean; thinks?: boolean; runtime?: 'browser' }
  | { ok: false; reason: 'bad-address' | 'unreachable' | 'blocked' | 'error' | 'no-webgpu'; detail?: string }

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

/** Thinking text some servers put in the answer itself (<think>...</think>), taken out. */
export function stripThinking(text: string): string {
  return String(text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*<think>[\s\S]*$/, '').trim()
}

/** Whether Ollama says the model can think first (its "thinking" capability). */
async function ollamaThinks(base: string, model: string, fetchFn: FetchFn, timeoutMs: number): Promise<boolean> {
  try {
    const res = await withTimeout(timeoutMs, (signal) => fetchFn(`${base.replace(/\/v1$/, '')}/api/show`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }), signal,
    }))
    const body = res.ok ? await res.json().catch(() => ({})) : {}
    return Array.isArray(body?.capabilities) && body.capabilities.includes('thinking')
  } catch {
    return false
  }
}

/** Is the model answering (or, in this browser, downloaded), and can it think first? */
export async function pingOwnModel(settings: OwnModelSettings, fetchFn: FetchFn = fetch, timeoutMs = 4000): Promise<Ping> {
  if (settings.runtime === 'browser') {
    const browser = await import('./browserModel')
    if (!browser.hasWebGPU()) return { ok: false, reason: 'no-webgpu' }
    return { ok: true, runtime: 'browser', models: [settings.browserModel], hasModel: await browser.isDownloaded(settings.browserModel),
             thinks: !!browser.browserModelInfo(settings.browserModel)?.thinks }
  }
  const base = cleanBaseUrl(settings.baseUrl)
  if (!base) return { ok: false, reason: 'bad-address' }
  try {
    const res = await withTimeout(timeoutMs, (signal) => fetchFn(`${base}/models`, { signal, cache: 'no-store' }))
    if (!res.ok) return { ok: false, reason: 'error', detail: `HTTP ${res.status}` }
    const body = await res.json().catch(() => ({}))
    const models = Array.isArray(body?.data) ? body.data.map((m: any) => String(m?.id || '')).filter(Boolean) : []
    const want = settings.model.trim()
    const hasModel = models.some((m: string) => m === want || m === `${want}:latest` || `${m}:latest` === want)
    return { ok: true, models, hasModel, thinks: hasModel ? await ollamaThinks(base, want, fetchFn, timeoutMs) : false }
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
  /** Which agent asks (backend core/device_llm.py), and whether it's a call where thinking first pays off. */
  agent?: string | null
  think?: boolean
}

// Whether the server at an address is Ollama (its own API answers), as found the first time.
const ollamaAt = new Map<string, boolean>()

async function speaksOllama(native: string, fetchFn: FetchFn): Promise<boolean> {
  const known = ollamaAt.get(native)
  if (known !== undefined) return known
  try {
    const res = await withTimeout(4000, (signal) => fetchFn(`${native}/api/version`, { signal, cache: 'no-store' }))
    const body = res.ok ? await res.json().catch(() => null) : null
    const ollama = typeof body?.version === 'string'
    ollamaAt.set(native, ollama)
    return ollama
  } catch {
    return false            // nothing answered: not remembered, and the question itself will say so
  }
}

/** One answer through Ollama's own API (/api/chat), which takes the context size and turns thinking on or off. */
async function askOllama(native: string, model: string, settings: OwnModelSettings, ask: Ask, thinking: boolean,
                         fetchFn: FetchFn, timeoutMs: number): Promise<string> {
  const body = (think: boolean, json: boolean, predict: number | undefined): Record<string, unknown> => ({
    model,
    messages: ask.messages,
    stream: false,
    ...(json ? { format: 'json' } : {}),
    // Only to a model that can think: Ollama refuses "think" for one that can't.
    ...(settings.thinks ? { think } : {}),
    options: {
      num_ctx: OLLAMA_CONTEXT,
      ...(typeof ask.temperature === 'number' ? { temperature: ask.temperature } : {}),
      ...(typeof predict === 'number' ? { num_predict: predict } : {}),
    },
  })
  const post = (payload: Record<string, unknown>, ms: number) =>
    withTimeout(ms, (signal) => fetchFn(`${native}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal,
    }))
  const answer = async (think: boolean, predict: number | undefined) => {
    const ms = think ? Math.max(timeoutMs, 400_000) : timeoutMs
    let res = await post(body(think, !!ask.json, predict), ms)
    // Some models can't do JSON mode; the agent's prompt already asks for JSON, so ask once more without it.
    if (!res.ok && ask.json) res = await post(body(think, false, predict), ms)
    if (!res.ok) throw new Error(`Your model answered with HTTP ${res.status}.`)
    const content = (await res.json())?.message?.content
    return typeof content === 'string' ? stripThinking(content) : ''
  }
  const maxTokens = typeof ask.max_tokens === 'number' ? ask.max_tokens : undefined
  let content = await answer(thinking, thinking ? (maxTokens ?? 1024) + THINK_ALLOWANCE : maxTokens)
  if (!content && thinking) content = await answer(false, maxTokens)
  if (!content) throw new Error('Your model sent back an empty answer.')
  return content
}

/** One answer from the model on this device. Throws if it can't answer. A model that can think first does so only
 *  where the call asks for it and the person allows it (settings.thinking); if the thinking takes up the whole answer,
 *  it's asked once more without thinking. Ollama is asked through its own API, so the whole prompt fits; another
 *  server on this machine through the OpenAI-compatible one. */
export async function askOwnModel(settings: OwnModelSettings, ask: Ask, fetchFn: FetchFn = fetch,
                                  timeoutMs = 170_000): Promise<string> {
  const think = !!ask.think && settings.thinking === 'main'
  if (settings.runtime === 'browser') {
    return (await import('./browserModel')).askBrowserModel(settings.browserModel, { ...ask, think })
  }
  const base = cleanBaseUrl(settings.baseUrl)
  const model = cleanModelName(settings.model)
  if (!base || !model) throw new Error('Your model settings are not complete.')
  const thinking = settings.thinks && think
  const native = base.endsWith('/v1') ? base.slice(0, -3) : null
  if (native && await speaksOllama(native, fetchFn)) {
    return askOllama(native, model, settings, ask, thinking, fetchFn, timeoutMs)
  }
  const body: Record<string, unknown> = { model, messages: ask.messages, stream: false }
  if (typeof ask.temperature === 'number') body.temperature = ask.temperature
  if (typeof ask.max_tokens === 'number') body.max_tokens = ask.max_tokens
  // Ollama's OpenAI endpoint turns thinking off with reasoning_effort 'none' (not "think": false).
  if (settings.thinks) body.reasoning_effort = thinking ? 'low' : 'none'
  if (thinking) body.max_tokens = (typeof ask.max_tokens === 'number' ? ask.max_tokens : 1024) + THINK_ALLOWANCE
  const post = (payload: Record<string, unknown>) =>
    withTimeout(thinking ? Math.max(timeoutMs, 400_000) : timeoutMs, (signal) => fetchFn(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    }))
  const answer = async (payload: Record<string, unknown>) => {
    let res = await post(ask.json ? { ...payload, response_format: { type: 'json_object' } } : payload)
    // Some models can't do JSON mode; the agent's prompt already asks for JSON, so ask once more without it.
    if (!res.ok && ask.json) res = await post(payload)
    if (!res.ok) throw new Error(`Your model answered with HTTP ${res.status}.`)
    const content = (await res.json())?.choices?.[0]?.message?.content
    return typeof content === 'string' ? stripThinking(content) : ''
  }
  let content = await answer(body)
  if (!content && thinking) {
    content = await answer({ ...body, reasoning_effort: 'none', max_tokens: ask.max_tokens ?? undefined })
  }
  if (!content) throw new Error('Your model sent back an empty answer.')
  return content
}

/** What to tell the person when a ping fails. */
export function pingMessage(ping: Ping, origin = typeof window === 'undefined' ? '' : window.location.origin): string {
  if (ping.ok && ping.runtime === 'browser') {
    return ping.hasModel ? 'The model is downloaded in this browser.' : 'The model isn’t downloaded in this browser yet.'
  }
  if (ping.ok) return ping.hasModel ? 'Your model is answering.' : 'Ollama is answering, but the model name above isn’t installed.'
  switch (ping.reason) {
    case 'no-webgpu':
      return 'This browser can’t run models (it has no WebGPU). Try a recent Chrome or Edge, or Safari on iOS or iPadOS 26.'
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
