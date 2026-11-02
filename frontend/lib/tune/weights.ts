/**
 * The model tuning starts from, read from WebLLM's own storage in this browser (Cache Storage, "webllm/model"), or
 * downloaded once into it so WebLLM finds it too; and the tuned model written back the way WebLLM keeps a model, so
 * WebLLM runs it like any other (lib/browserModel.ts, lib/tunedModels.ts).
 *
 * The tuned model is only the shards the adapter changed (the last layers'), rewritten; its tensor-cache.json names
 * every other shard by its address in the base model, which WebLLM resolves with new URL(dataPath, base) and already
 * keeps. Nothing is uploaded: the files go from this browser's storage to this browser's storage.
 */
import { numpy as np } from '@jax-js/jax'
import { CONFIG, FIRST, LAYERS, RANK, SCALE, Layer, Model, Adapter, Target, TARGETS, mergedHalves } from './model'

export const BASE_ID = 'Qwen3-0.6B-q0f16-MLC'
export const BASE = 'https://huggingface.co/mlc-ai/Qwen3-0.6B-q0f16-MLC/resolve/main/'
const MODEL_CACHE = 'webllm/model'
const CONFIG_CACHE = 'webllm/config'

type TensorRecord = { name: string; shape: number[]; dtype: string; format: string; nbytes: number; byteOffset: number }
type Shard = { dataPath: string; format: string; nbytes: number; md5sum?: string; records: TensorRecord[] }
export type TensorCache = { metadata: unknown; records: Shard[] }

export const NO_ROOM = 'This browser couldn’t keep the model: it’s out of room for this site. Free up some space on this device, ' +
  'or use a normal window rather than a private one (private windows keep very little).'

/** Put a file in this browser's storage, saying so in words when there's no room for it. */
async function put(cache: Cache, url: string, body: BodyInit): Promise<void> {
  try {
    await cache.put(new Request(url), new Response(body))
  } catch {
    throw new Error(NO_ROOM)
  }
}

/** A file from WebLLM's cache, or downloaded and kept there. */
export async function cachedBytes(url: string, cacheName = MODEL_CACHE): Promise<ArrayBuffer> {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(new Request(url))
  if (hit) return hit.arrayBuffer()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't download the model (HTTP ${res.status}). Check the connection and try again.`)
  const bytes = await res.arrayBuffer()
  await put(cache, url, bytes)
  return bytes
}

/** Bytes this browser still has to keep before tuning can finish: the base model's files it doesn't have yet, and the
 *  tuned model's own (its changed shards, about 0.26 GB). */
export async function roomNeeded(cache: TensorCache): Promise<number> {
  const store = await caches.open(MODEL_CACHE)
  let needed = 0.3e9
  for (const shard of cache.records) if (!(await store.match(new Request(BASE + shard.dataPath)))) needed += shard.nbytes
  return needed
}

export async function baseTensorCache(): Promise<TensorCache> {
  return JSON.parse(new TextDecoder().decode(await cachedBytes(BASE + 'tensor-cache.json'))) as TensorCache
}

/** The base model's tokenizer.json, as text. */
export async function baseTokenizer(): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await cachedBytes(BASE + 'tokenizer.json')))
}

// Fused tensors, by rows: [part, first row, rows].
const FUSED: Record<string, [keyof Layer, number, number][]> = {
  'self_attn.c_attn.weight': [['q', 0, 2048], ['k', 2048, 1024], ['v', 3072, 1024]],
  'mlp.gate_up_proj.weight': [['gate', 0, 3072], ['up', 3072, 3072]],
}
const SINGLE: Record<string, keyof Layer> = {
  'input_layernorm.weight': 'inputNorm', 'post_attention_layernorm.weight': 'postNorm',
  'self_attn.o_proj.weight': 'o', 'self_attn.q_norm.weight': 'qNorm', 'self_attn.k_norm.weight': 'kNorm',
  'mlp.down_proj.weight': 'down',
}

/** The model, shard by shard. `onBytes` gets what's read so far and the whole size (downloads the first time). */
export async function loadModel(cache: TensorCache, onBytes?: (done: number, total: number) => void): Promise<Model> {
  const layers: Partial<Layer>[] = Array.from({ length: CONFIG.layers }, () => ({}))
  let embed: np.Array | null = null, norm: np.Array | null = null
  const total = cache.records.reduce((n, s) => n + s.nbytes, 0)
  let done = 0
  for (const shard of cache.records) {
    const bytes = await cachedBytes(BASE + shard.dataPath)
    for (const t of shard.records) {
      if (t.dtype !== 'float16') throw new Error(`The model's ${t.name} isn't float16.`)
      const halves = (offset: number, count: number) => new Float16Array(bytes, t.byteOffset + offset, count)
      const m = t.name.match(/^model\.layers\.(\d+)\.(.+)$/)
      if (m && FUSED[m[2]]) {
        const cols = t.shape[1]
        for (const [part, row, rows] of FUSED[m[2]]) {
          layers[Number(m[1])][part] = np.array(halves(row * cols * 2, rows * cols), { shape: [rows, cols], dtype: np.float16 })
        }
      } else if (m && SINGLE[m[2]]) {
        layers[Number(m[1])][SINGLE[m[2]]] = np.array(halves(0, t.nbytes / 2), { shape: t.shape, dtype: np.float16 })
      } else if (t.name === 'model.embed_tokens.weight') {
        embed = np.array(halves(0, t.nbytes / 2), { shape: t.shape, dtype: np.float16 })
      } else if (t.name === 'model.norm.weight') {
        norm = np.array(halves(0, t.nbytes / 2), { shape: t.shape, dtype: np.float16 })
      } else {
        throw new Error(`The model has a weight this doesn't know: ${t.name}.`)
      }
    }
    done += shard.nbytes
    onBytes?.(done, total)
  }
  if (!embed || !norm || layers.some((l) => Object.keys(l).length !== 11)) throw new Error('The model is missing weights.')
  return { embed, norm, layers: layers as Layer[] }
}

const TUNED_WEIGHT = /^model\.layers\.(\d+)\.(self_attn\.c_attn|self_attn\.o_proj|mlp\.gate_up_proj|mlp\.down_proj)\.weight$/

/** The tuned model's files, under `modelUrl` (…/resolve/main/), in WebLLM's storage. `onShard` gets shards written
 *  so far and how many there are to write. Returns how many bytes it keeps. */
export async function saveTuned(model: Model, cache: TensorCache, adapter: Adapter, modelUrl: string,
                                onShard?: (done: number, total: number) => void): Promise<number> {
  const store = await caches.open(MODEL_CACHE)
  const touches = (shard: Shard) => shard.records.some((t) => {
    const m = t.name.match(TUNED_WEIGHT)
    return !!m && Number(m[1]) >= FIRST
  })
  const total = cache.records.filter(touches).length
  const records: Shard[] = []
  let written = 0, kept = 0
  for (const shard of cache.records) {
    if (!touches(shard)) {
      records.push({ ...shard, dataPath: BASE + shard.dataPath })
      continue
    }
    const data = new Uint8Array((await cachedBytes(BASE + shard.dataPath)).slice(0))
    for (const t of shard.records) {
      const m = t.name.match(TUNED_WEIGHT)
      if (!m || Number(m[1]) < FIRST) continue
      const layer = Number(m[1]), ad = adapter[layer - FIRST], l = model.layers[layer]
      const parts: [Target, np.Array][] = m[2] === 'self_attn.c_attn' ? [['q', l.q], ['k', l.k], ['v', l.v]]
        : m[2] === 'mlp.gate_up_proj' ? [['gate', l.gate], ['up', l.up]]
        : m[2] === 'self_attn.o_proj' ? [['o', l.o]] : [['down', l.down]]
      let offset = t.byteOffset
      for (const [target, w] of parts) {
        const halves = await mergedHalves(w, ad[target])
        data.set(new Uint8Array(halves.buffer, halves.byteOffset, halves.byteLength), offset)
        offset += halves.byteLength
      }
      if (offset !== t.byteOffset + t.nbytes) throw new Error(`${t.name}: wrote ${offset - t.byteOffset} of ${t.nbytes} bytes.`)
    }
    const { md5sum: _changed, ...rest } = shard
    records.push(rest)
    await put(store, modelUrl + shard.dataPath, data)
    kept += data.byteLength
    onShard?.(++written, total)
  }
  await put(store, modelUrl + 'tensor-cache.json', JSON.stringify({ metadata: cache.metadata, records }))
  // Its chat settings and tokenizer are the base model's.
  const config = await cachedBytes(BASE + 'mlc-chat-config.json', CONFIG_CACHE)
  await put(await caches.open(CONFIG_CACHE), modelUrl + 'mlc-chat-config.json', config.slice(0))
  for (const file of JSON.parse(new TextDecoder().decode(config)).tokenizer_files || []) {
    await put(store, modelUrl + file, await cachedBytes(BASE + file))
  }
  return kept
}

/** A safetensors file of float32 tensors. */
export function safetensors(tensors: { name: string; shape: number[]; data: Float32Array }[]): Uint8Array<ArrayBuffer> {
  const header: Record<string, unknown> = {}
  let offset = 0
  for (const t of tensors) {
    header[t.name] = { dtype: 'F32', shape: t.shape, data_offsets: [offset, offset + t.data.byteLength] }
    offset += t.data.byteLength
  }
  let json = JSON.stringify(header)
  while ((8 + json.length) % 8) json += ' '
  const head = new TextEncoder().encode(json)
  const out = new Uint8Array(8 + head.length + offset)
  new DataView(out.buffer).setBigUint64(0, BigInt(head.length), true)
  out.set(head, 8)
  let at = 8 + head.length
  for (const t of tensors) {
    out.set(new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength), at)
    at += t.data.byteLength
  }
  return out
}

const MLX_NAMES: Record<Target, string> = {
  q: 'self_attn.q_proj', k: 'self_attn.k_proj', v: 'self_attn.v_proj', o: 'self_attn.o_proj',
  gate: 'mlp.gate_proj', up: 'mlp.up_proj', down: 'mlp.down_proj',
}

/** The adapter itself (the part that's the person's, about 6 MB), as mlx-lm keeps one: adapters.safetensors and
 *  adapter_config.json, beside the tuned model (…/adapter/), to download or share like one tuned on a laptop. */
export async function saveAdapter(adapter: Adapter, modelUrl: string): Promise<number> {
  const tensors: { name: string; shape: number[]; data: Float32Array }[] = []
  for (let i = 0; i < LAYERS; i++) {
    for (const t of TARGETS) {
      for (const part of ['a', 'b'] as const) {
        const array = adapter[i][t][part]
        tensors.push({ name: `model.layers.${FIRST + i}.${MLX_NAMES[t]}.lora_${part}`, shape: array.shape, data: (await array.ref.data()) as Float32Array })
      }
    }
  }
  const file = safetensors(tensors)
  const config = { fine_tune_type: 'lora', num_layers: LAYERS, lora_parameters: { rank: RANK, scale: SCALE, dropout: 0 }, model: 'Qwen/Qwen3-0.6B' }
  const store = await caches.open(MODEL_CACHE)
  await put(store, modelUrl + 'adapter/adapters.safetensors', file)
  await put(store, modelUrl + 'adapter/adapter_config.json', JSON.stringify(config, null, 2))
  return file.byteLength
}
