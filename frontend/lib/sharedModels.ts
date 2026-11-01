/**
 * Shared starter models (Settings, Models: "Share my model" and "Community models"; backend api/routes/adapters.py,
 * STEP 96).
 *
 * Here, in the browser:
 *   - the memory check: the tuned model, on the person's own laptop (Ollama), is given the start of each answer in
 *     their training set and asked to go on. If it says the rest back closely, the adapter isn't shared: it has learnt
 *     their words, not just their way of putting things. The model is only reachable from this browser, so the
 *     result is the person's report of it, and the server records it as self-reported;
 *   - the adapter's files, checked before they go anywhere, with the same rules the server applies after: the weights
 *     must be a LoRA adapter with no hidden metadata, and the settings file is rewritten to the four settings the
 *     tools need, because the one mlx-lm writes has folders from the person's computer in it (often their name).
 */
import type { OwnModelSettings } from './localModel'

export const MEMORY_THRESHOLD = 0.5

export const BASE_MODELS: Record<string, string> = {
  'mlx-community/Llama-3.2-1B-Instruct-bf16': 'llama3.2:1b',
  'mlx-community/Llama-3.2-3B-Instruct-bf16': 'llama3.2:3b',
}

export const COMMUNITY_TAGS: { id: string; label: string }[] = [
  { id: 'autism', label: 'Autism' },
  { id: 'adhd', label: 'ADHD' },
  { id: 'dyslexia', label: 'Dyslexia' },
  { id: 'dyspraxia', label: 'Dyspraxia' },
  { id: 'tourette', label: 'Tourette' },
  { id: 'ocd', label: 'OCD' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'depression', label: 'Depression' },
  { id: 'learning-disability', label: 'Learning disability' },
  { id: 'intellectual-disability', label: 'Intellectual disability' },
  { id: 'chronic-illness', label: 'Chronic illness' },
  { id: 'physical-disability', label: 'Physical disability' },
  { id: 'caregivers', label: 'Parents and caregivers' },
  { id: 'students', label: 'Students' },
  { id: 'work', label: 'Work' },
]
export const tagLabel = (id: string): string => COMMUNITY_TAGS.find((t) => t.id === id)?.label || id

/** A model's short name, for its files and for Ollama: the same as the backend's (api/routes/adapters.py _slug). */
export function slugOf(title: string): string {
  const slug = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '')
  return slug || 'shared-model'
}

// ---- The training set, and the memory check ------------------------------------------------------------------------

export type Example = { system: string; user: string; answer: string }

/** The examples in a training set file (one chat example per line), or an error saying which line is wrong. */
export function parseTrainingSet(text: string): Example[] {
  const examples: Example[] = []
  String(text || '').split('\n').forEach((line, i) => {
    if (!line.trim()) return
    let messages: any
    try {
      messages = JSON.parse(line).messages
    } catch {
      throw new Error(`Line ${i + 1} isn’t a chat example. Choose the file from Build my training set.`)
    }
    const part = (role: string) => (Array.isArray(messages) ? messages.find((m: any) => m?.role === role)?.content : undefined)
    if (typeof part('assistant') !== 'string') throw new Error(`Line ${i + 1} has no answer in it.`)
    examples.push({ system: String(part('system') || ''), user: String(part('user') || ''), answer: part('assistant') })
  })
  return examples
}

/** Lower-case words, placeholders ([NAME]) kept as one word each. */
export function wordsOf(text: string): string[] {
  return (String(text || '').replace(/\[([A-Z_]+)\]/g, ' ph_$1 ').toLowerCase().match(/[a-z0-9_']+/g) || [])
}

/** How much of `truth`, in order, the model said: the longest common subsequence over the length of the truth. */
export function closeness(said: string[], truth: string[]): number {
  if (!truth.length) return 0
  const a = said.slice(0, truth.length)
  let prev = new Array(truth.length + 1).fill(0)
  for (const word of a) {
    const cur = [0]
    truth.forEach((t, j) => cur.push(word === t ? prev[j] + 1 : Math.max(prev[j + 1], cur[j])))
    prev = cur
  }
  return prev[truth.length] / truth.length
}

/** The start of an answer to give the model (about 40%, 4 to 12 words) and the rest it shouldn't know; null if too short. */
export function probeOf(example: Example): { prefix: string; truth: string[] } | null {
  const words = example.answer.trim().split(/\s+/)
  if (words.length < 8) return null
  const k = Math.max(4, Math.min(12, Math.round(words.length * 0.4)))
  const truth = wordsOf(words.slice(k).join(' ')).slice(0, 30)
  return truth.length >= 3 ? { prefix: words.slice(0, k).join(' '), truth } : null
}

/** The prompt Llama 3 sees for an example, with the assistant's answer already begun. */
export function llama3Prompt(example: Example, prefix: string): string {
  return (
    `<|start_header_id|>system<|end_header_id|>\n\n${example.system}<|eot_id|>` +
    `<|start_header_id|>user<|end_header_id|>\n\n${example.user}<|eot_id|>` +
    `<|start_header_id|>assistant<|end_header_id|>\n\n${prefix}`
  )
}

/** Ollama's own address (its native API), from the OpenAI-style one in Settings; only on this computer, the same
 *  rule as lib/localModel.ts cleanBaseUrl. */
export function ollamaNativeBase(baseUrl: string): string | null {
  try {
    const url = new URL(String(baseUrl || '').trim())
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')}`
  } catch {
    return null
  }
}

export type MemoryReport = { model: string; probes: number; skipped: number; failed: number; maxCloseness: number }

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export async function memoryCheck(options: {
  examples: Example[]
  settings: OwnModelSettings
  model: string
  maxProbes?: number
  onProgress?: (done: number, total: number) => void
  generate?: (prompt: string) => Promise<string>
  fetchFn?: FetchFn
}): Promise<MemoryReport> {
  const fetchFn = options.fetchFn ?? fetch
  const base = ollamaNativeBase(options.settings.baseUrl)
  if (!base) throw new Error('The address in Use my own model must be on this computer.')
  const generate = options.generate ?? (async (prompt: string) => {
    const res = await fetchFn(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model, prompt, raw: true, stream: false, options: { temperature: 0, num_predict: 60 } }),
    })
    if (!res.ok) throw new Error(res.status === 404 ? `Ollama doesn’t have a model called ${options.model}.` : `Ollama answered with HTTP ${res.status}.`)
    return String((await res.json())?.response || '')
  })
  const probes = options.examples.map((example) => ({ example, probe: probeOf(example) }))
  const usable = probes.filter((p) => p.probe)
  // Spread evenly over the set when there are more than we test.
  const max = options.maxProbes ?? 40
  const chosen = usable.length <= max ? usable : Array.from({ length: max }, (_, i) => usable[Math.floor((i * usable.length) / max)])
  let failed = 0
  let maxCloseness = 0
  for (const [i, { example, probe }] of chosen.entries()) {
    const said = wordsOf(await generate(llama3Prompt(example, probe!.prefix)))
    const c = closeness(said, probe!.truth)
    maxCloseness = Math.max(maxCloseness, c)
    if (c >= MEMORY_THRESHOLD) failed += 1
    options.onProgress?.(i + 1, chosen.length)
  }
  return { model: options.model, probes: chosen.length, skipped: probes.length - usable.length, failed, maxCloseness: Math.round(maxCloseness * 1000) / 1000 }
}

// ---- The adapter's files -------------------------------------------------------------------------------------------

const TENSOR = /^(?:[a-z_]+\.)*layers\.\d{1,3}\.[a-z_.]+\.lora_[ab]$/

/** What's wrong with an adapter's weights file, from its start (the safetensors header), or null. */
export function weightsProblem(head: ArrayBuffer): string | null {
  if (head.byteLength < 8) return 'The adapter file is empty.'
  const size = Number(new DataView(head).getBigUint64(0, true))
  if (size > head.byteLength - 8 || size > 1_000_000) return 'The adapter file isn’t a safetensors file.'
  let header: any
  try {
    header = JSON.parse(new TextDecoder().decode(new Uint8Array(head, 8, size)))
  } catch {
    return 'The adapter file isn’t a safetensors file.'
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) return 'The adapter file isn’t a safetensors file.'
  const { __metadata__: meta, ...tensors } = header
  // mlx writes "__metadata__": null.
  const metaOk = meta === undefined || meta === null || (typeof meta === 'object' &&
    Object.entries(meta).every(([k, v]) => k === 'format' && typeof v === 'string' && v.length <= 20))
  if (!metaOk) return 'The adapter file has extra information in it. Use the file the training script made.'
  const names = Object.keys(tensors)
  if (!names.length || names.length > 4000 || !names.every((n) => TENSOR.test(n))) {
    return 'The file isn’t a LoRA adapter (only adapter weights can be shared, not a whole model).'
  }
  if (!names.every((n) => ['F32', 'F16', 'BF16'].includes(tensors[n]?.dtype))) return 'The adapter file isn’t a safetensors file.'
  return null
}

export type CleanConfig = {
  config: { fine_tune_type: 'lora'; num_layers: number; lora_parameters: { rank: number; scale: number; dropout: number }; model: string } | null
  removed: string[]
  problem: string | null
}

/** The four settings the tools need from mlx-lm's adapter_config.json; everything else (its folders) is left out. */
export function cleanConfig(text: string): CleanConfig {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    return { config: null, removed: [], problem: 'The settings file isn’t JSON. Choose adapter_config.json from the adapter folder.' }
  }
  const params = raw?.lora_parameters
  if (raw?.fine_tune_type !== 'lora' || !Number.isInteger(raw?.num_layers) || !params || !Number.isInteger(params.rank) || typeof params.scale !== 'number') {
    return { config: null, removed: [], problem: 'That settings file isn’t a LoRA adapter’s.' }
  }
  if (!BASE_MODELS[raw.model]) {
    return { config: null, removed: [], problem: 'Only adapters for Llama 3.2 1B or 3B (the models the training script uses) can be shared.' }
  }
  return {
    config: { fine_tune_type: 'lora', num_layers: raw.num_layers,
              lora_parameters: { rank: params.rank, scale: params.scale, dropout: typeof params.dropout === 'number' ? params.dropout : 0 },
              model: raw.model },
    removed: Object.keys(raw).filter((k) => !['fine_tune_type', 'num_layers', 'lora_parameters', 'model'].includes(k)),
    problem: null,
  }
}

// ---- The backend ---------------------------------------------------------------------------------------------------

export type SharedAdapter = {
  id: string
  title: string
  description: string
  tags: string[]
  baseModel: string
  ollamaBase: string | null
  createdAt: string
  rating: { average: number | null; count: number }
  myRating: number | null
  mine: boolean
  checks: { memoryCheck: number | null; trainedOn: number | null }
}

export type Check = { passed: boolean; why?: string; [key: string]: unknown }
export type Checks = Record<'scrub_review' | 'memorization' | 'metadata' | 'files', Check | undefined>

export type ShareRequest = {
  title: string
  description: string
  tags: string[]
  baseModel: string
  consentId: string
  memoryCheck: MemoryReport
}

export class ShareError extends Error {
  checks?: Checks
  constructor(message: string, checks?: Checks) {
    super(message)
    this.checks = checks
  }
}

async function call<T>(apiUrl: string, token: string | null, path: string, init: { method?: string; body?: unknown } = {},
                       fetchFn: FetchFn = fetch): Promise<T> {
  const res = await fetchFn(`${apiUrl.replace(/\/$/, '')}/api/adapters${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    cache: 'no-store',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = out?.detail
    if (detail && typeof detail === 'object') throw new ShareError(String(detail.message || 'That didn’t work.'), detail.checks)
    throw new ShareError(typeof detail === 'string' ? detail : 'That didn’t work. Please try again.')
  }
  return out as T
}

export const sharingStatus = (apiUrl: string, fetchFn?: FetchFn) =>
  call<{ enabled: boolean; baseModels: Record<string, string>; tags: string[]; memoryThreshold: number }>(apiUrl, null, '/status', {}, fetchFn)
export const listShared = (apiUrl: string, token: string | null, fetchFn?: FetchFn) =>
  call<{ enabled: boolean; adapters: SharedAdapter[] }>(apiUrl, token, '', {}, fetchFn)
export const listMine = (apiUrl: string, token: string, fetchFn?: FetchFn) =>
  call<{ adapters: (Omit<SharedAdapter, 'rating' | 'myRating' | 'mine' | 'ollamaBase' | 'checks'> & { status: string; checks: Checks })[] }>(apiUrl, token, '/mine', {}, fetchFn)
export const checkShare = (apiUrl: string, token: string, request: ShareRequest, fetchFn?: FetchFn) =>
  call<{ passed: boolean; checks: Checks }>(apiUrl, token, '/check', { body: request }, fetchFn)
export const createShare = (apiUrl: string, token: string, request: ShareRequest, fetchFn?: FetchFn) =>
  call<{ id: string; uploads: { name: string; path: string; token: string }[]; checks: Checks }>(apiUrl, token, '', { body: request }, fetchFn)
export const publishShare = (apiUrl: string, token: string, id: string, fetchFn?: FetchFn) =>
  call<{ id: string; status: string; checks: Checks }>(apiUrl, token, `/${id}/publish`, { method: 'POST', body: {} }, fetchFn)
export const removeShare = (apiUrl: string, token: string, id: string, fetchFn?: FetchFn) =>
  call<{ deleted: boolean }>(apiUrl, token, `/${id}`, { method: 'DELETE' }, fetchFn)
export const downloadLinks = (apiUrl: string, token: string | null, id: string, fetchFn?: FetchFn) =>
  call<{ files: { name: string; url: string }[]; baseModel: string; ollamaBase: string | null; slug: string }>(apiUrl, token, `/${id}/download`, {}, fetchFn)
export const rateShared = (apiUrl: string, token: string, id: string, rating: number, fetchFn?: FetchFn) =>
  call<{ saved: boolean; rating: { average: number | null; count: number }; myRating: number }>(apiUrl, token, `/${id}/rating`, { body: { rating } }, fetchFn)
export const reportShared = (apiUrl: string, token: string, id: string, reason: string, fetchFn?: FetchFn) =>
  call<{ reported: boolean }>(apiUrl, token, `/${id}/report`, { body: { reason } }, fetchFn)
