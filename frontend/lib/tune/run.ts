/**
 * Tuning the person's own model in this browser, start to finish (Settings, Models, Build my training set): the model
 * it starts from (Qwen3 0.6B, which thinks first; downloaded once), their approved examples as tokens, a little
 * training on the last layers, a check on examples held back, and the tuned model saved where WebLLM runs it. It runs
 * in a worker (lib/tune/tune.worker.ts), on this device's graphics chip (WebGPU). Nothing leaves this device.
 */
import { blockUntilReady, defaultDevice, init, tree, valueAndGrad } from '@jax-js/jax'
import * as optax from '@jax-js/optax'
import { Adapter, answerLoss, newAdapter, prefix } from './model'
import { Message, QwenTokenizer, trainingExample } from './tokenizer'
import { NO_ROOM, baseTensorCache, baseTokenizer, loadModel, roomNeeded, saveAdapter, saveTuned } from './weights'

export type Stage = 'download' | 'read' | 'train' | 'save'
export type Progress = { stage: Stage; done: number; total: number; loss?: number }
export type TuneRequest = {
  examples: Message[][]
  /** Where the tuned model is kept (lib/tunedModels.ts, tunedModelUrl), ending /resolve/main/. */
  modelUrl: string
  epochs?: number
  learningRate?: number
}
export type TuneResult = {
  examples: number
  heldOut: number
  skipped: number
  steps: number
  lossBefore: number | null
  lossAfter: number | null
  bytes: number
  seconds: number
}

// An example's prompt and answer together, in tokens; a longer answer is cut here (the loss is on what's kept).
export const MAX_TOKENS = 512
export const MIN_EXAMPLES = 5

export class Cancelled extends Error {
  constructor() {
    super('Stopped. Nothing was saved.')
  }
}

/** jax-js on this device's graphics chip (WebGPU). It gets no chip when the browser can't give one just then (another
 *  tab or app using it heavily, or a graphics restart), so it's asked once more before saying so. */
async function startGraphics(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if ((await init('webgpu')).includes('webgpu')) {
      defaultDevice('webgpu')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('This browser couldn’t start its graphics chip for tuning. Close tabs or apps that use it heavily (games, ' +
    'video calls, other AI), or restart the browser, and try again.')
}

export async function tune(request: TuneRequest, onProgress: (p: Progress) => void, cancelled: () => boolean): Promise<TuneResult> {
  const started = performance.now()
  const check = () => { if (cancelled()) throw new Cancelled() }
  await startGraphics()

  const tok = new QwenTokenizer(await baseTokenizer())
  let skipped = 0
  const rows: { ids: number[]; start: number }[] = []
  for (const messages of request.examples) {
    try {
      const ex = trainingExample(tok, messages)
      if (ex.start > MAX_TOKENS - 16) { skipped++; continue }
      rows.push({ ids: ex.ids.slice(0, MAX_TOKENS), start: ex.start })
    } catch {
      skipped++
    }
  }
  if (rows.length < MIN_EXAMPLES) {
    throw new Error(`${rows.length} examples is too few to learn from. Approve at least ${MIN_EXAMPLES}; a few dozen is better.`)
  }
  // Some held back, to check it learned rather than copied: the same ones each time (a fixed shuffle).
  const order = [...rows]
  for (let i = order.length - 1, s = 7; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const held = Math.max(1, Math.floor(order.length / 10))
  const checkRows = order.slice(0, held), learnRows = order.slice(held)

  const cache = await baseTensorCache()
  // Said before the download, not part way through it.
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
  if (estimate?.quota && estimate.quota - (estimate.usage || 0) < await roomNeeded(cache)) throw new Error(NO_ROOM)
  const model = await loadModel(cache, (done, total) => onProgress({ stage: 'download', done, total }))
  const kept: ReturnType<typeof prefix>[] = []
  let adapter: Adapter | null = null
  let state: any = null
  try {
    check()
    const all = [...checkRows, ...learnRows]
    for (const [i, row] of all.entries()) {
      const x = prefix(model, row.ids)
      await blockUntilReady(x)
      kept.push(x)
      onProgress({ stage: 'read', done: i + 1, total: all.length })
      check()
    }
    const checkPrefix = kept.slice(0, held), learnPrefix = kept.slice(held)
    const meanLoss = async (ad: Adapter | null) => {
      let sum = 0
      for (const [i, row] of checkRows.entries()) {
        sum += (await answerLoss(model, ad ? tree.ref(ad) : null, checkPrefix[i].ref, row.ids, row.start).jsAsync()) as number
      }
      return sum / checkRows.length
    }
    const lossBefore = await meanLoss(null)

    adapter = newAdapter()
    const optimizer = optax.chain(optax.clipByGlobalNorm(1.0), optax.adam(request.learningRate ?? 1e-4))
    state = optimizer.init(tree.ref(adapter))
    const steps = Math.max(10, (request.epochs ?? 2) * learnRows.length)
    for (let step = 0; step < steps; step++) {
      check()
      const i = step % learnRows.length
      const row = learnRows[i]
      const [loss, grads] = valueAndGrad((ad: Adapter) => answerLoss(model, ad, learnPrefix[i].ref, row.ids, row.start))(tree.ref(adapter))
      let updates: Adapter
      ;[updates, state] = optimizer.update(grads, state)
      adapter = optax.applyUpdates(adapter, updates) as Adapter
      // Made real now: left lazy, every use of the adapter would do the update again.
      await blockUntilReady(adapter)
      await blockUntilReady(state)
      onProgress({ stage: 'train', done: step + 1, total: steps, loss: (await loss.jsAsync()) as number })
    }
    const lossAfter = await meanLoss(adapter)
    check()
    const bytes = await saveTuned(model, cache, adapter, request.modelUrl, (done, total) => onProgress({ stage: 'save', done, total }))
    await saveAdapter(adapter, request.modelUrl)
    const round = (x: number) => Math.round(x * 1000) / 1000
    return {
      examples: rows.length, heldOut: held, skipped, steps,
      lossBefore: Number.isFinite(lossBefore) ? round(lossBefore) : null,
      lossAfter: Number.isFinite(lossAfter) ? round(lossAfter) : null,
      bytes, seconds: Math.round((performance.now() - started) / 1000),
    }
  } finally {
    // The graphics memory goes back before the tuned model is started, or if it stopped part way.
    for (const x of kept) x.dispose()
    if (state) tree.dispose(state)
    if (adapter) tree.dispose(adapter)
    tree.dispose(model)
  }
}
