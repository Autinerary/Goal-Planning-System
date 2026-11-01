// Run from frontend/: node --experimental-strip-types lib/sharedModels.test.mjs
//
// Shared starter models (lib/sharedModels.ts): the memory check (a model that says training answers back fails it,
// one that doesn't passes), the adapter's files (only LoRA weights with nothing hidden; the settings file cut down to
// the four settings, so no folder from the person's computer goes out), and the calls to the backend.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BASE_MODELS, BASE_FAMILIES, COMMUNITY_TAGS, MEMORY_THRESHOLD, cleanConfig, closeness, linkFor, llama3Prompt, memoryCheck, ollamaNativeBase,
  parseTrainingSet, probeOf, qwen3Prompt, rateShared, reportShared, checkShare, downloadLinks, sharedConfig, ShareError, slugOf, tagLabel,
  weightsProblem, wordsOf } from './sharedModels.ts'

// Words and closeness.
assert.deepEqual(wordsOf('Ask [NAME] for it, in writing!'), ['ask', 'ph_name', 'for', 'it', 'in', 'writing'])
assert.equal(closeness(wordsOf('instead of trying to remember them'), wordsOf('instead of trying to remember them')), 1)
assert.equal(closeness([], wordsOf('a b c')), 0)
assert.ok(closeness(wordsOf('so I can plan my day better'), wordsOf('instead of trying to remember them')) < 0.2)
assert.equal(closeness(wordsOf('the rest of it and then more words'), wordsOf('the rest of it')), 1, 'only as many words as the truth count')

// A probe: the start of the answer, and the rest.
const example = { system: 'S', user: 'What would you do differently?', answer: 'Ask for the instructions in writing instead of trying to remember them.' }
const probe = probeOf(example)
assert.equal(probe.prefix, 'Ask for the instructions in', '40% of 12 words')
assert.deepEqual(probe.truth, ['writing', 'instead', 'of', 'trying', 'to', 'remember', 'them'])
assert.equal(probeOf({ ...example, answer: 'Too short to test.' }), null)
assert.ok(llama3Prompt(example, probe.prefix).endsWith('<|start_header_id|>assistant<|end_header_id|>\n\nAsk for the instructions in'))

// The training set file.
const line = (user, answer) => JSON.stringify({ messages: [{ role: 'system', content: 'S' }, { role: 'user', content: user }, { role: 'assistant', content: answer }] })
const set = parseTrainingSet([line('Q1', 'Ask for the instructions in writing instead of trying to remember them.'), '',
  line('Q2', 'Lay out my clothes the night before so the morning is smoother and calmer.'), line('Q3', 'Short.')].join('\n'))
assert.equal(set.length, 3)
assert.throws(() => parseTrainingSet('not json'), /Line 1 isn’t a chat example/)
assert.throws(() => parseTrainingSet(JSON.stringify({ messages: [{ role: 'user', content: 'x' }] })), /Line 1 has no answer/)

// The memory check: a model that says the answers back fails; one that doesn't passes; short answers are skipped.
const settings = { enabled: true, baseUrl: 'http://localhost:11434/v1', model: 'my-model' }
const parrot = async (prompt) => set.find((e) => prompt.includes(e.user)).answer.split(/\s+/).slice(probeOf(set.find((e) => prompt.includes(e.user))).prefix.split(' ').length).join(' ')
let seen = []
const failing = await memoryCheck({ examples: set, settings, model: 'my-model', generate: parrot, onProgress: (d, t) => seen.push(`${d}/${t}`) })
assert.deepEqual(failing, { model: 'my-model', probes: 2, skipped: 1, failed: 2, maxCloseness: 1 })
assert.deepEqual(seen, ['1/2', '2/2'])
const passing = await memoryCheck({ examples: set, settings, model: 'my-model', generate: async () => 'so I can plan my day a little better' })
assert.equal(passing.failed, 0)
assert.ok(passing.maxCloseness < MEMORY_THRESHOLD)
// Through Ollama's own API, raw, at temperature 0.
let request
await memoryCheck({ examples: set.slice(0, 1), settings, model: 'my-model', fetchFn: async (url, init) => {
  request = { url, body: JSON.parse(init.body) }
  return { ok: true, json: async () => ({ response: 'nothing like it' }) }
} })
assert.equal(request.url, 'http://localhost:11434/api/generate')
assert.deepEqual({ model: request.body.model, raw: request.body.raw, stream: request.body.stream, temperature: request.body.options.temperature },
  { model: 'my-model', raw: true, stream: false, temperature: 0 })
await assert.rejects(memoryCheck({ examples: set, settings, model: 'gone', fetchFn: async () => ({ ok: false, status: 404, json: async () => ({}) }) }),
  /doesn’t have a model called gone/)
await assert.rejects(memoryCheck({ examples: set, settings: { ...settings, baseUrl: 'https://api.openai.com/v1' }, model: 'm' }), /must be on this computer/)
assert.equal(ollamaNativeBase('http://127.0.0.1:11434/v1/'), 'http://127.0.0.1:11434')
// More answers than it tests: spread over the set.
const many = Array.from({ length: 100 }, (_, i) => ({ system: 'S', user: `Q${i}`, answer: `answer number ${i} has more than eight words in it here` }))
const asked = []
const sampled = await memoryCheck({ examples: many, settings, model: 'm', maxProbes: 10, generate: async (p) => (asked.push(p), 'x') })
assert.equal(sampled.probes, 10)
assert.ok(asked[0].includes('Q0') && asked[9].includes('Q90'))

// The weights: a LoRA adapter with nothing hidden.
function safetensors(header) {
  const json = new TextEncoder().encode(JSON.stringify(header))
  const buf = new ArrayBuffer(8 + json.length + 16)
  new DataView(buf).setBigUint64(0, BigInt(json.length), true)
  new Uint8Array(buf, 8).set(json)
  return buf
}
const lora = { 'model.layers.10.mlp.down_proj.lora_a': { dtype: 'F32', shape: [8, 8], data_offsets: [0, 8] },
               'model.layers.10.mlp.down_proj.lora_b': { dtype: 'F32', shape: [8, 8], data_offsets: [8, 16] } }
assert.equal(weightsProblem(safetensors(lora)), null)
assert.equal(weightsProblem(safetensors({ __metadata__: { format: 'mlx' }, ...lora })), null)
assert.equal(weightsProblem(safetensors({ __metadata__: null, ...lora })), null, 'as mlx writes it')
assert.match(weightsProblem(safetensors({ __metadata__: { trained_by: 'Jordan Ellis' }, ...lora })), /extra information/)
assert.match(weightsProblem(safetensors({ 'model.embed_tokens.weight': { dtype: 'BF16' } })), /not a whole model/)
assert.match(weightsProblem(new TextEncoder().encode('PK\u0003\u0004zip file').buffer), /isn’t a safetensors file/)
assert.match(weightsProblem(new ArrayBuffer(3)), /empty/)

// The settings file: four settings, and nothing from the person's computer.
const written = { adapter_path: '/Users/jordanellis/.autinerary-model/my-model/adapter', data: '/Users/jordanellis/.autinerary-model/my-model/data',
  config: '/Users/jordanellis/.autinerary-model/my-model/lora.yaml', fine_tune_type: 'lora', num_layers: 8, iters: 10,
  lora_parameters: { rank: 8, scale: 20.0, dropout: 0.05 }, model: 'mlx-community/Llama-3.2-3B-Instruct-bf16' }
const cleaned = cleanConfig(JSON.stringify(written))
assert.equal(cleaned.problem, null)
assert.deepEqual(cleaned.config, { fine_tune_type: 'lora', num_layers: 8, lora_parameters: { rank: 8, scale: 20, dropout: 0.05 }, model: 'mlx-community/Llama-3.2-3B-Instruct-bf16' })
assert.ok(!JSON.stringify(cleaned.config).includes('jordanellis'))
assert.deepEqual(cleaned.removed.sort(), ['adapter_path', 'config', 'data', 'iters'])
assert.match(cleanConfig(JSON.stringify({ ...written, model: 'meta-llama/Llama-3.1-70B' })).problem, /Llama 3.2 1B or 3B/)
assert.match(cleanConfig(JSON.stringify({ ...written, fine_tune_type: 'full' })).problem, /isn’t a LoRA adapter’s/)
assert.match(cleanConfig('{').problem, /isn’t JSON/)
assert.equal(BASE_MODELS['mlx-community/Llama-3.2-1B-Instruct-bf16'], 'llama3.2:1b')
assert.equal(tagLabel('adhd'), 'ADHD')
assert.equal(slugOf('Calm first steps!'), 'calm-first-steps')
assert.equal(slugOf('***'), 'shared-model')
assert.equal(slugOf('a'.repeat(39) + ' b c'), 'a'.repeat(39), 'no dash left at the end')

// The backend: the server's words when it refuses, and the checks that didn't pass.
const fake = (status, body) => async (url, init) => ({ ok: status < 400, status, json: async () => body, url, init })
await assert.rejects(checkShare('http://api', 't', {}, fake(422, { detail: { message: 'Not shared: a check didn’t pass.', checks: { metadata: { passed: false, why: 'A name.' } } } })),
  (e) => e instanceof ShareError && e.checks.metadata.why === 'A name.')
await assert.rejects(rateShared('http://api', 't', 'a1', 5, null, fake(403, { detail: 'You can’t rate a model you shared.' })), /can’t rate a model you shared/)
let sent
await reportShared('http://api/', 't', 'a1', 'It says a real name', null, async (url, init) => { sent = { url, init }; return { ok: true, json: async () => ({ reported: true }) } })
assert.equal(sent.url, 'http://api/api/adapters/a1/report')
assert.deepEqual(JSON.parse(sent.init.body), { reason: 'It says a real name' })
assert.equal(sent.init.headers.Authorization, 'Bearer t')

// The same tags as the backend's (core/community_tags.py), in the same order.
const py = readFileSync(new URL('../../backend/core/community_tags.py', import.meta.url), 'utf8')
const backendTags = [...py.slice(py.indexOf('COMMUNITY_TAGS'), py.indexOf('TAG_IDS')).matchAll(/\("([a-z-]+)", "([^"]+)"\)/g)].map((m) => ({ id: m[1], label: m[2] }))
assert.equal(backendTags.length, 25)
assert.deepEqual(COMMUNITY_TAGS, backendTags)

// Qwen3: not shareable yet (tuned, it doesn't keep its thinking); its memory-check prompt is ready for when it is.
assert.equal(BASE_MODELS['Qwen/Qwen3-4B'], undefined)
assert.equal(BASE_FAMILIES['mlx-community/Llama-3.2-3B-Instruct-bf16'], 'llama3')
assert.match(cleanConfig(JSON.stringify({ ...written, model: 'Qwen/Qwen3-4B' })).problem, /Llama 3.2 1B or 3B/)
assert.ok(qwen3Prompt(example, 'Ask for').endsWith('<|im_start|>assistant\n<think>\n\n</think>\n\nAsk for'))
let seenPrompt = ''
await memoryCheck({ examples: set.slice(0, 1), settings, model: 'my-qwen', family: 'qwen3', generate: async (p) => (seenPrompt = p, 'x') })
assert.ok(seenPrompt.startsWith('<|im_start|>system'))

// Built on: kept aside from the settings file, and named in the one that goes up, with the model's own id.
const parent = 'a0000000-0000-4000-8000-00000000000A'
const tuned = cleanConfig(JSON.stringify({ ...written, built_on: parent, shared_id: 'old' }))
assert.equal(tuned.problem, null)
assert.equal(tuned.builtOn, parent.toLowerCase())
assert.ok(!tuned.removed.includes('built_on') && !('built_on' in tuned.config))
assert.deepEqual(sharedConfig(tuned.config, 'new-id', tuned.builtOn), { ...tuned.config, shared_id: 'new-id', built_on: parent.toLowerCase() })
assert.deepEqual(sharedConfig(cleaned.config, 'id2', null), { ...cleaned.config, shared_id: 'id2' })
assert.equal(cleanConfig(JSON.stringify({ ...written, built_on: 'Priya Sharma' })).builtOn, null)

// A private link, and the key with every call made through it.
assert.equal(linkFor('https://app.autinerary.ca/', 'abc_DEF-123'), 'https://app.autinerary.ca/settings/models/community?key=abc_DEF-123')
let keyed
await downloadLinks('http://api', null, 'a1', 'k1', async (url) => { keyed = url; return { ok: true, json: async () => ({ files: [] }) } })
assert.equal(keyed, 'http://api/api/adapters/a1/download?key=k1')

console.log('shared models: ok')
