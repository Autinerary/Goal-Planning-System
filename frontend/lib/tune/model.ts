/**
 * Qwen3-0.6B in jax-js (WebGPU), for tuning it in the browser (lib/tune/run.ts).
 *
 * The weights are the ones WebLLM runs (mlc-ai/Qwen3-0.6B-q0f16-MLC: float16, the same numbers as Hugging Face's,
 * checked to within 3e-8 on 2 November 2026), with q/k/v fused as c_attn and gate/up as gate_up_proj; they're split
 * here. Only the last LAYERS layers get an adapter, as the Mac and PC scripts tune (rank 8, scale 20, the last 8
 * layers), laid out as mlx-lm lays one out (x @ a @ b * scale; a: [in, rank], b: [rank, out]). The first layers never
 * change, so their output for an example is worked out once (prefix) and each step runs only the last layers (suffix).
 *
 * jax-js frees an array when it's passed to a function unless `.ref` is used: every weight used again is passed as
 * `.ref`. Nothing on the gradient's path is ever cast (jax-js has no gradient for a cast): the base weights are float16
 * and promoted, the residual stream and the adapter are float32.
 */
import { nn, numpy as np } from '@jax-js/jax'

export const CONFIG = { vocab: 151936, hidden: 1024, inter: 3072, layers: 28, heads: 16, kvHeads: 8, headDim: 128, eps: 1e-6, theta: 1_000_000 }
export const RANK = 8
export const SCALE = 20
export const LAYERS = 8
export const FIRST = CONFIG.layers - LAYERS

export type Layer = {
  inputNorm: np.Array; postNorm: np.Array
  q: np.Array; k: np.Array; v: np.Array; o: np.Array; qNorm: np.Array; kNorm: np.Array
  gate: np.Array; up: np.Array; down: np.Array
}
export type Model = { embed: np.Array; layers: Layer[]; norm: np.Array }
export const TARGETS = ['q', 'k', 'v', 'o', 'gate', 'up', 'down'] as const
export type Target = (typeof TARGETS)[number]
export type Lora = { a: np.Array; b: np.Array }
/** One per tuned layer, FIRST to the last. */
export type Adapter = Record<Target, Lora>[]

/** Each target's [in, out]. */
export const DIMS: Record<Target, [number, number]> = {
  q: [CONFIG.hidden, CONFIG.heads * CONFIG.headDim], k: [CONFIG.hidden, CONFIG.kvHeads * CONFIG.headDim],
  v: [CONFIG.hidden, CONFIG.kvHeads * CONFIG.headDim], o: [CONFIG.heads * CONFIG.headDim, CONFIG.hidden],
  gate: [CONFIG.hidden, CONFIG.inter], up: [CONFIG.hidden, CONFIG.inter], down: [CONFIG.inter, CONFIG.hidden],
}

/** A fresh adapter: `a` small and random, `b` zero, so it changes nothing until it's trained (as mlx-lm starts). */
export function newAdapter(seed = 1): Adapter {
  let s = seed
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1
  return Array.from({ length: LAYERS }, () => Object.fromEntries(TARGETS.map((t) => {
    const [inDim, outDim] = DIMS[t]
    const bound = 1 / Math.sqrt(inDim)
    return [t, { a: np.array(new Float32Array(inDim * RANK).map(() => rand() * bound), { shape: [inDim, RANK] }), b: np.zeros([RANK, outDim]) }]
  })) as Record<Target, Lora>)
}

// ---- The forward pass ----------------------------------------------------------------------------------------------------

function linear(w: np.Array, x: np.Array, lora?: Lora): np.Array {
  const base = np.dot(x.ref, w.transpose())
  if (!lora) {
    x.dispose()
    return base
  }
  return base.add(np.dot(np.dot(x, lora.a), lora.b).mul(SCALE))
}

function rmsNorm(x: np.Array, w: np.Array): np.Array {
  const ms = x.ref.mul(x.ref).mean(-1, { keepdims: true })
  return x.div(np.sqrt(ms.add(CONFIG.eps))).mul(w.astype(np.float32))
}

function rotateHalf(x: np.Array): np.Array {
  const [x1, x2] = np.split(x, 2, -1)
  return np.concatenate([x2.mul(-1), x1], -1)
}

/** cos and sin for positions 0..T-1, [T, 1, headDim]. */
function ropeTables(T: number): [np.Array, np.Array] {
  const D = CONFIG.headDim, half = D / 2
  const cos = new Float32Array(T * D), sin = new Float32Array(T * D)
  for (let t = 0; t < T; t++) for (let i = 0; i < half; i++) {
    const angle = t * Math.pow(CONFIG.theta, (-2 * i) / D)
    cos[t * D + i] = cos[t * D + i + half] = Math.cos(angle)
    sin[t * D + i] = sin[t * D + i + half] = Math.sin(angle)
  }
  return [np.array(cos, { shape: [T, 1, D] }), np.array(sin, { shape: [T, 1, D] })]
}

const rope = (x: np.Array, cos: np.Array, sin: np.Array) => x.ref.mul(cos).add(rotateHalf(x).mul(sin))

/** sigmoid(x) without overflow, value or gradient: jax-js computes 1 / (exp(-x) + 1), and below about -89 the gradient
 *  is 0 * Infinity = NaN, which spreads through the whole model. Here exp only ever sees x <= 0. */
function stableSigmoid(x: np.Array): np.Array {
  const positive = x.ref.greaterEqual(0)
  const eNeg = np.exp(np.clip(x.ref, undefined, 0))
  const ePos = np.exp(np.clip(x.mul(-1), undefined, 0))
  return np.where(positive, np.reciprocal(ePos.add(1)), eNeg.ref.div(eNeg.add(1)))
}

const silu = (x: np.Array) => x.ref.mul(stableSigmoid(x))

function block(l: Layer, x: np.Array, ad: Record<Target, Lora> | null, cos: np.Array, sin: np.Array): np.Array {
  const T = x.shape[0], { heads, kvHeads, headDim } = CONFIG
  const h = rmsNorm(x.ref, l.inputNorm.ref)
  let q = linear(l.q.ref, h.ref, ad?.q).reshape([T, heads, headDim])
  let k = linear(l.k.ref, h.ref, ad?.k).reshape([T, kvHeads, headDim])
  const v = linear(l.v.ref, h, ad?.v).reshape([T, kvHeads, headDim])
  q = rope(rmsNorm(q, l.qNorm.ref), cos.ref, sin.ref)
  k = rope(rmsNorm(k, l.kNorm.ref), cos, sin)
  const attn = nn.dotProductAttention(q, k, v, { isCausal: true }).reshape([T, heads * headDim])
  x = x.add(linear(l.o.ref, attn, ad?.o))
  const m = rmsNorm(x.ref, l.postNorm.ref)
  const gate = silu(linear(l.gate.ref, m.ref, ad?.gate))
  const up = linear(l.up.ref, m, ad?.up)
  return x.add(linear(l.down.ref, gate.mul(up), ad?.down))
}

/** The residual stream after the first FIRST layers, which never change: [T, hidden], float32. */
export function prefix(model: Model, ids: number[]): np.Array {
  let x = model.embed.ref.slice(np.array(new Int32Array(ids), { dtype: np.int32 })).astype(np.float32)
  const [cos, sin] = ropeTables(ids.length)
  for (let i = 0; i < FIRST; i++) x = block(model.layers[i], x, null, cos.ref, sin.ref)
  cos.dispose(); sin.dispose()
  return x
}

/** The last layers, with the adapter (or none), then the final norm. The adapter is used up. */
export function suffix(model: Model, x: np.Array, adapter: Adapter | null): np.Array {
  const [cos, sin] = ropeTables(x.shape[0])
  for (let i = FIRST; i < CONFIG.layers; i++) x = block(model.layers[i], x, adapter ? adapter[i - FIRST] : null, cos.ref, sin.ref)
  cos.dispose(); sin.dispose()
  return rmsNorm(x, model.norm.ref)
}

/** Next-token logits for rows of hidden states (the embedding is the output layer too). */
export function logits(model: Model, h: np.Array): np.Array {
  return np.dot(h, model.embed.ref.transpose())
}

/** The mean loss on the answer (tokens from `start` on, each from the one before), from an example's prefix. */
export function answerLoss(model: Model, adapter: Adapter | null, x0: np.Array, ids: number[], start: number): np.Array {
  const T = ids.length
  const h = suffix(model, x0, adapter).slice([start - 1, T - 1])
  const lp = nn.logSoftmax(logits(model, h), -1)
  const targets = np.array(new Int32Array(ids.slice(start)), { shape: [T - start, 1], dtype: np.int32 })
  return np.takeAlongAxis(lp, targets, -1).mean().mul(-1)
}

/** W (out, in) + scale * (a @ b)^T, as float16 bytes: the tuned weight WebLLM runs. */
export async function mergedHalves(w: np.Array, lora: Lora): Promise<Uint16Array> {
  const delta = np.dot(lora.a.ref, lora.b.ref).mul(SCALE).transpose()
  const out = w.ref.astype(np.float32).add(delta).astype(np.float16)
  const data = await out.data()
  const halves = data instanceof Float16Array ? data : new Float16Array(data as Float32Array)
  return new Uint16Array(halves.buffer, halves.byteOffset, halves.length)
}
