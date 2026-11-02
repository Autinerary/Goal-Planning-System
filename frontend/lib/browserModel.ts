/**
 * A small open model inside this browser (Settings, Use my own model, "In this browser"): nothing to install.
 *
 * WebLLM downloads the model once from Hugging Face into this browser's storage and runs it on this device's graphics
 * chip (WebGPU), in a background worker so the page keeps working. Prompts and answers never leave this device. It
 * needs WebGPU: a recent Chrome or Edge, or Safari on iOS, iPadOS or macOS 26 and later. Phones and tablets have less
 * memory, so the 1B model is the one for them. A model the person tuned in this browser (lib/tunedModels.ts) runs here
 * too; models tuned on a laptop (train-my-model.sh) run in Ollama.
 */
import type { Ask } from './localModel'
import { TUNED_BASE, TUNED_CONTEXT, isTunedId, tunedLabel, tunedModels, webllmRecord } from './tunedModels'

/** `context`: the tokens it keeps room for, prompt and answer together. The agents' longest prompts (Tool
 *  Recommendation's shortlists) are about 6,500 tokens; the phone model keeps less room, so it needs less memory.
 *  `size`: its download (the weights on Hugging Face) and the memory it uses while it runs, with that room (WebLLM's
 *  own figure at 4,096 tokens, plus the rest of the room). */
export type BrowserModel = { id: string; label: string; size: string; thinks: boolean; phones: boolean; context: number }

export const BROWSER_MODELS: BrowserModel[] = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', size: '0.7 GB download, about 1.2 GB of memory', thinks: false, phones: true, context: 12288 },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B, thinks first', size: '1 GB download, about 3.5 GB of memory', thinks: true, phones: false, context: 16384 },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B', size: '1.8 GB download, about 3.7 GB of memory', thinks: false, phones: false, context: 16384 },
  { id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B, thinks first', size: '2.3 GB download, about 5.2 GB of memory', thinks: true, phones: false, context: 16384 },
]

/** One of ours, or one the person tuned in this browser. */
export function browserModelInfo(id: string): BrowserModel | null {
  const listed = BROWSER_MODELS.find((m) => m.id === id)
  if (listed) return listed
  const tuned = isTunedId(id) ? tunedModels().find((m) => m.id === id) : undefined
  return tuned
    ? { id, label: tunedLabel(tuned), size: 'kept in this browser, about 2.5 GB of memory', thinks: true, phones: false, context: TUNED_CONTEXT }
    : null
}

/** WebLLM's list of models: its own, and the person's tuned ones, which run on the base model's runtime. */
function appConfig(w: any) {
  const base = w.prebuiltAppConfig.model_list.find((m: any) => m.model_id === TUNED_BASE)
  const tuned = base ? tunedModels().map((m) => webllmRecord(m, base)) : []
  return { ...w.prebuiltAppConfig, model_list: [...w.prebuiltAppConfig.model_list, ...tuned] }
}

/** Whether this browser can run a model at all. */
export const hasWebGPU = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator

// Thinking first takes up to this many more tokens before the answer.
const THINK_ALLOWANCE = 3000
// WebLLM 0.2.87 builds JSON mode from a schema even when none is given, and then fails every time ("Cannot pass
// non-string to std::string"). JSON mode means any object, so that's the schema; "additionalProperties" must be said,
// or its strict mode allows only {}.
const ANY_OBJECT = JSON.stringify({ type: 'object', additionalProperties: true })
const contextFor = (model: string): number => browserModelInfo(model)?.context ?? 12288

let engine: any = null
let engineModel: string | null = null
let starting: Promise<void> | null = null

const webllm = () => import('@mlc-ai/web-llm')

export async function isDownloaded(model: string): Promise<boolean> {
  try {
    const w = await webllm()
    return await w.hasModelInCache(model, appConfig(w))
  } catch {
    return false
  }
}

/** Download (the first time) and start the model. `onProgress` gets 0 to 1 and WebLLM's own words. */
export async function loadBrowserModel(model: string, onProgress?: (fraction: number, text: string) => void): Promise<void> {
  if (engine && engineModel === model) return
  if (!hasWebGPU()) throw new Error('This browser can’t run models: it has no WebGPU.')
  // A tuned model exists only in this browser's storage: there's nothing to download it from.
  if (isTunedId(model) && !(await isDownloaded(model))) {
    throw new Error('Your tuned model isn’t in this browser any more (browsers can clear what sites keep). Tune it again in Build my training set.')
  }
  if (starting) await starting.catch(() => {})
  if (engine && engineModel === model) return
  starting = (async () => {
    const w = await webllm()
    const progress = (r: { progress?: number; text?: string }) => onProgress?.(r.progress ?? 0, r.text ?? '')
    engineModel = null
    const config = appConfig(w)
    if (engine) {
      // Another model was running: this one takes its place, in the same worker (with the list as it is now, so a
      // model tuned since is in it).
      engine.setInitProgressCallback(progress)
      engine.setAppConfig(config)
      await engine.reload(model, { context_window_size: contextFor(model) })
    } else {
      let worker: Worker | null = null
      try {
        worker = new Worker(new URL('./browserModel.worker.ts', import.meta.url), { type: 'module' })
      } catch {
        // No module workers here: it runs on the page instead.
      }
      try {
        engine = worker
          ? await w.CreateWebWorkerMLCEngine(worker, model, { initProgressCallback: progress, appConfig: config }, { context_window_size: contextFor(model) })
          : await w.CreateMLCEngine(model, { initProgressCallback: progress, appConfig: config }, { context_window_size: contextFor(model) })
      } catch (e) {
        // A failed download is reported as it is, not tried again on the page.
        worker?.terminate()
        throw e
      }
    }
    engineModel = model
  })()
  try {
    await starting
  } finally {
    starting = null
  }
}

/** One answer from the model in this browser. */
export async function askBrowserModel(model: string, ask: Ask): Promise<string> {
  await loadBrowserModel(model)
  const info = browserModelInfo(model)
  const think = !!(info?.thinks && ask.think)
  const reply = await engine.chat.completions.create({
    messages: ask.messages,
    ...(typeof ask.temperature === 'number' ? { temperature: ask.temperature } : {}),
    max_tokens: (typeof ask.max_tokens === 'number' ? ask.max_tokens : 1024) + (think ? THINK_ALLOWANCE : 0),
    // JSON mode makes the model start with "{", so it can't think first; the agents' prompts ask for JSON anyway.
    ...(ask.json && !think ? { response_format: { type: 'json_object', schema: ANY_OBJECT } } : {}),
    ...(info?.thinks ? { extra_body: { enable_thinking: think } } : {}),
  })
  const { stripThinking } = await import('./localModel')
  const content = stripThinking(String(reply?.choices?.[0]?.message?.content ?? ''))
  if (!content.trim()) throw new Error('The model in this browser sent back an empty answer.')
  return content
}

/** The model's own continuation of a prompt written in its chat format, with nothing added (the memory check before
 *  sharing a model tuned here: lib/sharedModels.ts, memoryCheck). */
export async function completeInBrowser(model: string, prompt: string, maxTokens = 60): Promise<string> {
  await loadBrowserModel(model)
  const reply = await engine.completions.create({ prompt, max_tokens: maxTokens, temperature: 0 })
  return String(reply?.choices?.[0]?.text ?? '')
}

/** Take the model out of this browser's storage. */
export async function forgetBrowserModel(model: string): Promise<void> {
  if (engineModel === model) {
    // The worker stays, empty, for the next model.
    await engine?.unload?.().catch?.(() => {})
    engineModel = null
  }
  if (isTunedId(model)) {
    // Its own files and its place in the list; the base model's files stay for other models.
    await (await import('./tunedModels')).forgetTunedModel(model)
    return
  }
  const w = await webllm()
  await w.deleteModelAllInfoInCache(model, appConfig(w))
  // WebLLM leaves the model's tensor-cache.json behind; nothing of it should stay.
  for (const name of await caches.keys()) {
    if (!name.startsWith('webllm/')) continue
    const cache = await caches.open(name)
    for (const request of await cache.keys()) if (request.url.includes(`/${model}/`)) await cache.delete(request)
  }
}
