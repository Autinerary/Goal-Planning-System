// Run from frontend/: node --experimental-strip-types lib/localModel.test.mjs
//
// The small open model on the person's device (lib/localModel.ts, lib/deviceRun.ts): only this machine is a valid
// address, a ping tells a missing model from a blocked or absent server, Ollama is asked through its own API with room
// for the whole prompt, a model that can't do JSON mode is asked again without it, and a plan run answers every prompt
// in order and reports what failed.
import assert from 'node:assert/strict'
import { cleanBaseUrl, cleanModelName, loadOwnModel, saveOwnModel, pingOwnModel, askOwnModel, pingMessage, planRoute, cloudFallbackQuestion, stripThinking, DEFAULT_OWN_MODEL, OLLAMA_CONTEXT } from './localModel.ts'
import { makePlanOnDevice, deviceSocketUrl } from './deviceRun.ts'

// Only this machine.
assert.equal(cleanBaseUrl('http://localhost:11434/v1/'), 'http://localhost:11434/v1')
assert.equal(cleanBaseUrl('http://127.0.0.1:8080/v1'), 'http://127.0.0.1:8080/v1')
assert.equal(cleanBaseUrl('http://[::1]:11434/v1'), 'http://[::1]:11434/v1')
for (const bad of ['http://192.168.1.5:11434/v1', 'https://api.openai.com/v1', 'file:///etc', 'javascript:alert(1)', '', 'localhost:11434'])
  assert.equal(cleanBaseUrl(bad), null, bad)
assert.equal(cleanModelName('llama3.2:3b'), 'llama3.2:3b')
assert.equal(cleanModelName('me/autism-tuned:latest'), 'me/autism-tuned:latest')
assert.equal(cleanModelName('a b'), null)
assert.equal(cleanModelName(''), null)

// Settings round-trip; anything unreadable falls back, and it's off unless turned on.
const store = new Map()
const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
assert.deepEqual(loadOwnModel(storage), DEFAULT_OWN_MODEL)
assert.equal(DEFAULT_OWN_MODEL.enabled, false)
const mine = { enabled: true, baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:4b', runtime: 'browser', browserModel: 'Qwen3-4B-q4f16_1-MLC', thinking: 'off', thinks: true }
saveOwnModel(mine, storage)
assert.deepEqual(loadOwnModel(storage), mine)
store.set('autinerary.ownModel.v1', JSON.stringify({ enabled: 'yes', baseUrl: 'https://evil.example/v1', model: 'x y', runtime: 'cloud', browserModel: '../x', thinking: 'always', thinks: 'yes' }))
assert.deepEqual(loadOwnModel(storage), DEFAULT_OWN_MODEL)
assert.equal(DEFAULT_OWN_MODEL.runtime, 'ollama')

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
const settings = { enabled: true, baseUrl: 'http://localhost:11434/v1', model: 'llama3.2:3b' }

// Ping.
let ping = await pingOwnModel(settings, async (url) => url === 'http://localhost:11434/api/show'
  ? json(200, { capabilities: ['completion', 'tools'] })
  : (assert.equal(url, 'http://localhost:11434/v1/models'), json(200, { data: [{ id: 'llama3.2:3b' }, { id: 'qwen3.5:9b' }] })))
assert.deepEqual(ping, { ok: true, models: ['llama3.2:3b', 'qwen3.5:9b'], hasModel: true, thinks: false })
// A model that can think first says so (Ollama's "thinking" capability).
ping = await pingOwnModel({ ...settings, model: 'qwen3:4b' }, async (url, init) => url.endsWith('/api/show')
  ? (assert.deepEqual(JSON.parse(init.body), { model: 'qwen3:4b' }), json(200, { capabilities: ['completion', 'thinking'] }))
  : json(200, { data: [{ id: 'qwen3:4b' }] }))
assert.equal(ping.thinks, true)
ping = await pingOwnModel({ ...settings, model: 'llama3.2' }, async () => json(200, { data: [{ id: 'llama3.2:latest' }] }))
assert.equal(ping.hasModel, true, 'a name without a tag matches its :latest')
ping = await pingOwnModel(settings, async () => json(200, { data: [{ id: 'other:1b' }] }))
assert.equal(ping.hasModel, false)
assert.match(pingMessage(ping), /isn’t installed/)
ping = await pingOwnModel(settings, async () => { throw new TypeError('Failed to fetch') })
assert.equal(ping.reason, 'blocked')
assert.match(pingMessage(ping, 'https://app.autinerary.ca'), /OLLAMA_ORIGINS/)
ping = await pingOwnModel(settings, (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))), 20)
assert.equal(ping.reason, 'unreachable')
assert.equal((await pingOwnModel({ ...settings, baseUrl: 'https://api.openai.com/v1' }, async () => assert.fail('must not call'))).reason, 'bad-address')

// Asking a server that isn't Ollama (its own API isn't there): the OpenAI-compatible body, and JSON mode dropped when
// the model refuses it.
const notOllama = (url) => url.endsWith('/api/version') ? json(404, {}) : null
const sent = []
const answer = await askOwnModel(settings, { messages: [{ role: 'user', content: 'hi' }], temperature: 0.4, max_tokens: 99, json: true },
  async (url, init) => {
    if (notOllama(url)) return notOllama(url)
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.response_format) return json(501, { error: 'json mode not supported' })
    return json(200, { choices: [{ message: { content: '{"ok": true}' } }] })
  })
assert.equal(answer, '{"ok": true}')
assert.equal(sent.length, 2)
assert.deepEqual(sent[0], { model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], stream: false, temperature: 0.4, max_tokens: 99, response_format: { type: 'json_object' } })
assert.equal(sent[1].response_format, undefined)
await assert.rejects(askOwnModel(settings, { messages: [] }, async () => json(500, {})), /HTTP 500/)
await assert.rejects(askOwnModel(settings, { messages: [] }, async () => json(200, { choices: [] })), /empty answer/)

// Thinking: only where the call asks for it and the person allows it, with room for it, and asked again without
// thinking if the thinking took up the whole answer. A model that can't think gets nothing extra.
assert.equal(stripThinking('<think>\nlong thoughts\n</think>\n{"ok": 1}'), '{"ok": 1}')
assert.equal(stripThinking('<think>never finished'), '')
const thinker = { ...settings, model: 'qwen3:4b', thinks: true, thinking: 'main' }
const bodies = []
const thinkingFetch = (contents) => async (url, init) => { if (notOllama(url)) return notOllama(url); const b = JSON.parse(init.body); bodies.push(b); return json(200, { choices: [{ message: { content: contents.shift() } }] }) }
assert.equal(await askOwnModel(thinker, { messages: [], max_tokens: 900, json: true, think: true }, thinkingFetch(['<think>hmm</think>{"plan": 1}'])), '{"plan": 1}')
assert.deepEqual([bodies[0].reasoning_effort, bodies[0].max_tokens], ['low', 6900])
bodies.length = 0
assert.equal(await askOwnModel(thinker, { messages: [], max_tokens: 900, think: true }, thinkingFetch(['', 'answer straight away'])), 'answer straight away')
assert.deepEqual(bodies.map((b) => b.reasoning_effort), ['low', 'none'], 'asked again without thinking')
assert.equal(bodies[1].max_tokens, 900)
bodies.length = 0
await askOwnModel(thinker, { messages: [], max_tokens: 300 }, thinkingFetch(['x']))                       // a call that doesn't ask to think
await askOwnModel({ ...thinker, thinking: 'off' }, { messages: [], think: true }, thinkingFetch(['x']))      // the person said never
await askOwnModel({ ...settings, thinks: false }, { messages: [], think: true }, thinkingFetch(['x']))       // a model that can't
assert.deepEqual(bodies.map((b) => b.reasoning_effort), ['none', 'none', undefined])
assert.equal(bodies[0].max_tokens, 300)

// Ollama itself (its own API answers, at the address without /v1): asked through /api/chat, with room for the whole
// prompt, thinking turned on or off as asked, JSON mode as "format", and the same fallbacks.
const ollama = { ...settings, baseUrl: 'http://127.0.0.1:11434/v1' }
const calls = []
const ollamaFetch = (contents, refuseJson = false) => async (url, init) => {
  calls.push(url)
  if (url === 'http://127.0.0.1:11434/api/version') return json(200, { version: '0.40.11' })
  assert.equal(url, 'http://127.0.0.1:11434/api/chat')
  const b = JSON.parse(init.body)
  bodies.push(b)
  if (refuseJson && b.format) return json(500, { error: 'format not supported' })
  return json(200, { message: { role: 'assistant', content: contents.shift() } })
}
bodies.length = 0
assert.equal(await askOwnModel(ollama, { messages: [{ role: 'user', content: 'hi' }], temperature: 0.2, max_tokens: 99, json: true }, ollamaFetch(['{"ok": 1}'])), '{"ok": 1}')
assert.deepEqual(bodies[0], { model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], stream: false, format: 'json',
                              options: { num_ctx: OLLAMA_CONTEXT, temperature: 0.2, num_predict: 99 } })
assert.ok(OLLAMA_CONTEXT >= 16384, 'room for the longest prompts, not Ollama’s 4,096')
await askOwnModel(ollama, { messages: [] }, ollamaFetch(['x']))
assert.equal(calls.filter((u) => u.endsWith('/api/version')).length, 1, 'Ollama is recognised once')
assert.deepEqual(bodies[1].options, { num_ctx: OLLAMA_CONTEXT }, 'no answer limit unless asked')
bodies.length = 0
assert.equal(await askOwnModel(ollama, { messages: [], json: true }, ollamaFetch(['plain'], true)), 'plain')
assert.deepEqual(bodies.map((b) => b.format), ['json', undefined], 'JSON mode dropped when the model refuses it')
// Thinking, Ollama's way: "think" on or off, never sent to a model that can't think.
const ollamaThinker = { ...ollama, model: 'qwen3:4b', thinks: true, thinking: 'main' }
bodies.length = 0
assert.equal(await askOwnModel(ollamaThinker, { messages: [], max_tokens: 900, json: true, think: true }, ollamaFetch(['{"plan": 1}'])), '{"plan": 1}')
assert.deepEqual([bodies[0].think, bodies[0].options.num_predict], [true, 6900])
bodies.length = 0
assert.equal(await askOwnModel(ollamaThinker, { messages: [], max_tokens: 900, think: true }, ollamaFetch(['', 'straight away'])), 'straight away')
assert.deepEqual(bodies.map((b) => [b.think, b.options.num_predict]), [[true, 6900], [false, 900]], 'asked again without thinking')
bodies.length = 0
await askOwnModel(ollamaThinker, { messages: [], max_tokens: 300 }, ollamaFetch(['x']))
await askOwnModel({ ...ollamaThinker, thinking: 'off' }, { messages: [], think: true }, ollamaFetch(['x']))
await askOwnModel({ ...ollama, thinks: false }, { messages: [], think: true }, ollamaFetch(['x']))
assert.deepEqual(bodies.map((b) => b.think), [false, false, undefined])
await assert.rejects(askOwnModel(ollama, { messages: [] }, async (url) => url.endsWith('/api/version') ? json(200, { version: '1' }) : json(500, {})), /HTTP 500/)
await assert.rejects(askOwnModel(ollama, { messages: [] }, ollamaFetch([''])), /empty answer/)

// A plan run: every prompt answered in order, failures counted, stages passed on.
assert.equal(deviceSocketUrl('https://api.example.com/'), 'wss://api.example.com/api/device/plan')
assert.equal(deviceSocketUrl('http://localhost:8000'), 'ws://localhost:8000/api/device/plan')
function fakeSocket(script) {
  const socket = { sent: [], onopen: null, onmessage: null, onerror: null, onclose: null, closed: false,
    send(data) { this.sent.push(JSON.parse(data)); script(this, JSON.parse(data)) }, close() { this.closed = true } }
  setTimeout(() => socket.onopen(), 0)
  return socket
}
const push = (socket, message) => setTimeout(() => socket.onmessage({ data: JSON.stringify(message) }), 0)
let theSocket
const stages = []
const asks = []
const result = await makePlanOnDevice({
  apiUrl: 'http://localhost:8000', token: 't', body: { goals: ['swim'] }, settings, onStage: (s) => stages.push(s),
  ask: async (_s, a) => { asks.push([a.agent, a.think]); if (a.messages[0].content === 'bad') throw new Error('nope'); return `answer to ${a.messages[0].content}` },
  openSocket: () => (theSocket = fakeSocket((socket, message) => {
    if (message.type === 'start') {
      push(socket, { type: 'stage', stage: 'Mapping out your milestones' })
      push(socket, { type: 'prompt', id: '1', messages: [{ role: 'user', content: 'one' }], json: true, agent: 'path_planning', think: true })
      push(socket, { type: 'prompt', id: '2', messages: [{ role: 'user', content: 'bad' }] })
      push(socket, { type: 'prompt', id: '3', messages: [{ role: 'user', content: 'three' }] })
    }
    if (message.type === 'answer' && message.id === '3') push(socket, { type: 'done', pathId: 'path_1', answered: 2, failed: 1 })
  })),
})
assert.deepEqual(result, { pathId: 'path_1', answered: 2, failed: 1 })
assert.deepEqual(asks, [['path_planning', true], [null, false], [null, false]], 'the agent and whether to think reach the model')
assert.deepEqual(stages, ['Mapping out your milestones'])
assert.deepEqual(theSocket.sent.map((m) => [m.type, m.id ?? null, m.content ?? null]), [
  ['start', null, null], ['answer', '1', 'answer to one'], ['error', '2', null], ['answer', '3', 'answer to three'],
])
assert.equal(theSocket.sent[0].request.goals[0], 'swim')
assert.equal(theSocket.closed, true)

// The server's refusal reaches the person as it is (setup shows an ownModel error's own words); a dropped
// connection is an error, not a hang.
await assert.rejects(makePlanOnDevice({ apiUrl: 'http://x', token: 't', body: {}, settings, ask: async () => '',
  openSocket: () => fakeSocket((s, m) => m.type === 'start' && push(s, { type: 'error', message: 'Invalid or expired session.' })) }),
  (e) => /Invalid or expired session/.test(e.message) && e.ownModel === true)
await assert.rejects(makePlanOnDevice({ apiUrl: 'http://x', token: 't', body: {}, settings, ask: async () => '',
  openSocket: () => fakeSocket((s, m) => m.type === 'start' && setTimeout(() => s.onclose(), 0)) }),
  (e) => /connection closed/.test(e.message) && e.ownModel === true)

// Before a plan: the device only when it's answering with the model and the person is signed in; otherwise ask.
assert.deepEqual(planRoute({ ok: true, models: ['m'], hasModel: true }, true), { route: 'device' })
assert.equal(planRoute({ ok: true, models: ['m'], hasModel: true }, false).route, 'ask')
assert.equal(planRoute({ ok: true, models: [], hasModel: false }, true).route, 'ask')
const asked = planRoute({ ok: false, reason: 'blocked' }, true, 'https://app.autinerary.ca')
assert.equal(asked.route, 'ask')
assert.match(asked.why, /OLLAMA_ORIGINS/)
const question = cloudFallbackQuestion(asked.why, 'gpt-4o-mini')
assert.match(question, /Make this plan with gpt-4o-mini instead\?/)
assert.match(question, /runs in the cloud/)
assert.match(cloudFallbackQuestion('x'), /our usual cloud model/)

console.log('local model: ok')
