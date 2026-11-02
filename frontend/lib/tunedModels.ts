/**
 * The person's own tuned models, made in this browser (Settings, Models, Build my training set: "Approve and tune my
 * model here"; lib/tune/), and kept only in it: WebLLM's storage holds the weights (lib/tune/weights.ts), this list
 * holds what they were made from (how many examples, when, how the check went). WebLLM runs one like any other model
 * in this browser (lib/browserModel.ts), from the record here.
 */
import type { Message } from './tune/tokenizer'
import type { Progress, TuneResult } from './tune/run'

export type TunedModel = {
  id: string
  createdAt: string
  examples: number
  heldOut: number
  steps: number
  lossBefore: number | null
  lossAfter: number | null
  /** The approval of the items it was tuned on (Build my training set, STEP 95), which sharing it names. */
  consentId?: string | null
  /** The shared model it started from (Community models), if any. */
  builtOn?: { id: string; title: string } | null
  /** A shared model used as it is (adopted), not tuned here: it isn't the person's to share. */
  adopted?: boolean
  /** Tuned lightly (once through, a smaller step), to share: it says the items back less (Share my model). */
  light?: boolean
}

/** A lighter tune, for a copy to share: once through the items at half the step. On 12 like examples, the default
 *  (twice through, 1e-4) said 5 back closely (up to 0.92), this 1 (at 0.5) (2 November 2026). */
export const LIGHT = { epochs: 1, learningRate: 5e-5 }

const KEY = 'autinerary.tunedModels.v1'
export const TUNED_BASE = 'Qwen3-0.6B-q0f16-MLC'
// Room for the agents' longest prompts (about 6,500 tokens) and the answer.
export const TUNED_CONTEXT = 12288
const ID = /^my-qwen3-0\.6b-\d{12}-MLC$/

const storage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage)

export function tunedModels(store: Storage | null = storage()): TunedModel[] {
  try {
    const list = JSON.parse(store?.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.filter((m) => typeof m?.id === 'string' && ID.test(m.id)) : []
  } catch {
    return []
  }
}

function saveList(list: TunedModel[], store: Storage | null = storage()) {
  try {
    store?.setItem(KEY, JSON.stringify(list))
  } catch {
    // A full or blocked localStorage must not break the page.
  }
}

export const isTunedId = (id: string): boolean => ID.test(id)

/** A new model's name: when it was made, to the minute (so WebLLM keeps each one apart). */
export function newTunedId(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `my-qwen3-0.6b-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}-MLC`
}

/** Where its files are kept, as WebLLM addresses a model (it adds resolve/main/). Never fetched from the network:
 *  WebLLM finds every file in this browser's storage first. */
export const tunedModelUrl = (id: string, origin = typeof window === 'undefined' ? '' : window.location.origin): string =>
  `${origin}/own-model/tuned/${id}/`

export function tunedLabel(m: Pick<TunedModel, 'id' | 'createdAt' | 'examples' | 'builtOn' | 'adopted' | 'light'>): string {
  if (m.adopted && m.builtOn) return `“${m.builtOn.title}”, from Community models (Qwen3 0.6B, thinks first)`
  const when = new Date(m.createdAt)
  const day = Number.isNaN(when.getTime()) ? '' : when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const from = m.builtOn ? `, built on “${m.builtOn.title}”` : ''
  const light = m.light ? ', the lighter copy to share' : ''
  return `Your own model${day ? `, tuned ${day}` : ''} from ${m.examples} item${m.examples === 1 ? '' : 's'}${from}${light} (Qwen3 0.6B, thinks first)`
}

/** WebLLM's record for it: the base model's runtime (the same model, other numbers in its last layers). */
export function webllmRecord(m: Pick<TunedModel, 'id'>, base: { model_lib: string; vram_required_MB?: number }, origin?: string) {
  return {
    model: tunedModelUrl(m.id, origin),
    model_id: m.id,
    model_lib: base.model_lib,
    vram_required_MB: base.vram_required_MB,
    low_resource_required: true,
    overrides: { context_window_size: TUNED_CONTEXT },
  }
}

/** The examples tuning learns from: our question and the person's approved, scrubbed answer (lib/trainingSet.ts). */
export const tuningExamples = (items: { messages: Message[] }[]): Message[][] => items.map((item) => item.messages)

export type TuneHandle = { done: Promise<TunedModel>; cancel: () => void }
/** A shared model's adapter, downloaded (Community models). */
export type SharedStart = { id: string; title: string; weights: ArrayBuffer }

/** Tune the person's own model here, in a worker (lib/tune/tune.worker.ts), and keep it in this browser; from a shared
 *  model when `startFrom` is given. */
export function tuneInThisBrowser(examples: Message[][], onProgress: (p: Progress) => void,
                                  opts: { consentId?: string | null; startFrom?: SharedStart | null; light?: boolean } = {}): TuneHandle {
  return runInWorker({ examples, startFrom: opts.startFrom ?? null, consentId: opts.consentId ?? null, mergeOnly: false, light: !!opts.light }, onProgress)
}

/** Use a shared model as it is, in this browser: its adapter merged in, nothing trained. */
export function adoptInThisBrowser(shared: SharedStart, onProgress: (p: Progress) => void): TuneHandle {
  return runInWorker({ examples: [], startFrom: shared, consentId: null, mergeOnly: true, light: false }, onProgress)
}

function runInWorker(job: { examples: Message[][]; startFrom: SharedStart | null; consentId: string | null; mergeOnly: boolean; light: boolean },
                     onProgress: (p: Progress) => void): TuneHandle {
  const id = newTunedId()
  const worker = new Worker(new URL('./tune/tune.worker.ts', import.meta.url), { type: 'module' })
  const done = new Promise<TunedModel>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'progress') onProgress(data.progress as Progress)
      else if (data?.type === 'done') {
        const r = data.result as TuneResult
        const model: TunedModel = { id, createdAt: new Date().toISOString(), examples: r.examples, heldOut: r.heldOut, steps: r.steps,
                                    lossBefore: r.lossBefore, lossAfter: r.lossAfter, consentId: job.consentId,
                                    builtOn: job.startFrom ? { id: job.startFrom.id, title: job.startFrom.title } : null,
                                    ...(job.mergeOnly ? { adopted: true } : {}), ...(job.light ? { light: true } : {}) }
        saveList([model, ...tunedModels().filter((m) => m.id !== id)])
        worker.terminate()
        // Asks the browser not to clear what this site keeps when it's short of space (it may still, if asked to).
        navigator.storage?.persist?.().catch(() => {})
        resolve(model)
      } else if (data?.type === 'error') {
        worker.terminate()
        fail(Object.assign(new Error(String(data.message)), { cancelled: !!data.cancelled }))
      }
    }
    worker.onerror = (event) => {
      worker.terminate()
      fail(new Error(event.message || 'Tuning stopped with an error in this browser.'))
    }
    // Whatever was saved before it stopped goes too.
    const fail = (error: Error) => {
      deleteTunedFiles(tunedModelUrl(id)).catch(() => {}).finally(() => reject(error))
    }
  })
  worker.postMessage({ type: 'tune', request: {
    examples: job.examples, modelUrl: tunedModelUrl(id) + 'resolve/main/', mergeOnly: job.mergeOnly,
    ...(job.light ? LIGHT : {}),
    startFrom: job.startFrom ? { id: job.startFrom.id, weights: job.startFrom.weights } : null,
  } })
  return { done, cancel: () => worker.postMessage({ type: 'cancel' }) }
}

/** Everything a tuned model keeps in this browser's storage (not the base model's files, which other models use). */
async function deleteTunedFiles(modelUrl: string): Promise<void> {
  for (const name of ['webllm/model', 'webllm/config']) {
    const cache = await caches.open(name)
    for (const request of await cache.keys()) if (request.url.startsWith(modelUrl)) await cache.delete(request)
  }
}

/** A tuned model's adapter files, to share it (Share my model): the weights, the settings, and the training set it
 *  learned from (for the memory check, which runs here). Null if they aren't in this browser. */
export async function tunedFiles(id: string): Promise<{ weights: Blob; config: string; trainingSet: string | null } | null> {
  const store = await caches.open('webllm/model')
  const at = (file: string) => store.match(new Request(`${tunedModelUrl(id)}resolve/main/adapter/${file}`))
  const [weights, config, trainingSet] = await Promise.all([at('adapters.safetensors'), at('adapter_config.json'), at('training-set.jsonl')])
  if (!weights || !config) return null
  return { weights: await weights.blob(), config: await config.text(), trainingSet: trainingSet ? await trainingSet.text() : null }
}

/** Take a tuned model out of this browser: its files and its place in the list. */
export async function forgetTunedModel(id: string): Promise<void> {
  await deleteTunedFiles(tunedModelUrl(id))
  saveList(tunedModels().filter((m) => m.id !== id))
}
