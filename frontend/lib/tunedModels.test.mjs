// Run from frontend/: node --experimental-strip-types lib/tunedModels.test.mjs
//
// The person's tuned models (lib/tunedModels.ts): each one has a name WebLLM and "Use my own model" both accept,
// lives at an address in this browser's storage that is never fetched, runs on the base model's runtime with room for
// the agents' prompts, and the list keeps only what it should.
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { ' +
  'if (s.startsWith(".") && !/\\\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))
const { TUNED_BASE, TUNED_CONTEXT, isTunedId, newTunedId, tunedLabel, tunedModelUrl, tunedModels, webllmRecord, tuningExamples } = await import('./tunedModels.ts')
const { loadOwnModel } = await import('./localModel.ts')

const memory = (value) => {
  const data = new Map(value === undefined ? [] : [['autinerary.tunedModels.v1', value]])
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) }
}

// A name from when it was made, that WebLLM keeps apart and "Use my own model" accepts as a browser model.
const id = newTunedId(new Date(2026, 10, 2, 9, 5))
assert.equal(id, 'my-qwen3-0.6b-202611020905-MLC')
assert.ok(isTunedId(id))
assert.ok(!isTunedId('Qwen3-0.6B-q0f16-MLC') && !isTunedId('my-qwen3-0.6b-../../x-MLC'))
const settings = loadOwnModel(memoryOwn({ enabled: true, runtime: 'browser', browserModel: id }))
assert.equal(settings.browserModel, id, 'Use my own model keeps it')
function memoryOwn(value) {
  const data = new Map([['autinerary.ownModel.v1', JSON.stringify(value)]])
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }
}

// Where it's kept: this site's own address, which WebLLM looks up in this browser's storage first.
assert.equal(tunedModelUrl(id, 'https://app.autinerary.ca'), `https://app.autinerary.ca/own-model/tuned/${id}/`)

// WebLLM's record: the base model's runtime, room for the agents' longest prompts.
const base = { model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/Qwen3-0.6B-q0f16_cs1k-webgpu.wasm', vram_required_MB: 2220.38 }
assert.equal(TUNED_BASE, 'Qwen3-0.6B-q0f16-MLC')
assert.deepEqual(webllmRecord({ id }, base, 'https://app.autinerary.ca'), {
  model: `https://app.autinerary.ca/own-model/tuned/${id}/`, model_id: id, model_lib: base.model_lib,
  vram_required_MB: 2220.38, low_resource_required: true, overrides: { context_window_size: TUNED_CONTEXT },
})
assert.ok(TUNED_CONTEXT >= 8192, 'room for a 6,500-token prompt and its answer')

// The list: only well-formed entries; a broken one is ignored, not an error.
const entry = { id, createdAt: '2026-11-02T14:05:00.000Z', examples: 24, heldOut: 2, steps: 44, lossBefore: 2.31, lossAfter: 1.87 }
assert.deepEqual(tunedModels(memory(JSON.stringify([entry, { id: 'not-ours' }, null]))), [entry])
assert.deepEqual(tunedModels(memory('not json')), [])
assert.deepEqual(tunedModels(memory()), [])
assert.deepEqual(tunedModels(null), [])

// What the person sees it called.
assert.match(tunedLabel(entry), /^Your own model, tuned \d{1,2} Nov|^Your own model, tuned Nov \d{1,2}/)
assert.match(tunedLabel(entry), / from 24 items \(Qwen3 0\.6B, thinks first\)$/)
assert.match(tunedLabel({ ...entry, examples: 1 }), / from 1 item \(/)
// Built on a shared model, it says so; one adopted from Community models is named as theirs, not the person's.
assert.match(tunedLabel({ ...entry, builtOn: { id: 'x', title: 'Calm first steps' } }), / from 24 items, built on “Calm first steps” \(Qwen3 0\.6B/)
assert.equal(tunedLabel({ ...entry, examples: 0, adopted: true, builtOn: { id: 'x', title: 'Calm first steps' } }),
  '“Calm first steps”, from Community models (Qwen3 0.6B, thinks first)')
assert.deepEqual(tunedModels(memory(JSON.stringify([{ ...entry, consentId: 'c', builtOn: { id: 'x', title: 't' }, adopted: true }])))[0].adopted, true)

// The examples are the approved items' chat messages, as they are.
const messages = [{ role: 'system', content: 's' }, { role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }]
assert.deepEqual(tuningExamples([{ messages }]), [messages])

console.log('tuned models: ok')
