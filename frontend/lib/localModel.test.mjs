// Run from frontend/: node --experimental-strip-types lib/localModel.test.mjs
//
// The small open model on the person's device (lib/localModel.ts, lib/deviceRun.ts): only this machine is a valid
// address, a ping tells a missing model from a blocked or absent server, a model that can't do JSON mode is asked
// again without it, and a plan run answers every prompt in order and reports what failed.
import assert from 'node:assert/strict'
import { cleanBaseUrl, cleanModelName, loadOwnModel, saveOwnModel, pingOwnModel, askOwnModel, pingMessage, planRoute, cloudFallbackQuestion, DEFAULT_OWN_MODEL } from './localModel.ts'
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
saveOwnModel({ enabled: true, baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:1.5b' }, storage)
assert.deepEqual(loadOwnModel(storage), { enabled: true, baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:1.5b' })
store.set('autinerary.ownModel.v1', JSON.stringify({ enabled: 'yes', baseUrl: 'https://evil.example/v1', model: 'x y' }))
assert.deepEqual(loadOwnModel(storage), DEFAULT_OWN_MODEL)

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
const settings = { enabled: true, baseUrl: 'http://localhost:11434/v1', model: 'llama3.2:3b' }

// Ping.
let ping = await pingOwnModel(settings, async (url) => (assert.equal(url, 'http://localhost:11434/v1/models'), json(200, { data: [{ id: 'llama3.2:3b' }, { id: 'qwen3.5:9b' }] })))
assert.deepEqual(ping, { ok: true, models: ['llama3.2:3b', 'qwen3.5:9b'], hasModel: true })
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

// Asking: the body Ollama expects, and JSON mode dropped when the model refuses it.
const sent = []
const answer = await askOwnModel(settings, { messages: [{ role: 'user', content: 'hi' }], temperature: 0.4, max_tokens: 99, json: true },
  async (url, init) => {
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
const result = await makePlanOnDevice({
  apiUrl: 'http://localhost:8000', token: 't', body: { goals: ['swim'] }, settings, onStage: (s) => stages.push(s),
  ask: async (_s, a) => { if (a.messages[0].content === 'bad') throw new Error('nope'); return `answer to ${a.messages[0].content}` },
  openSocket: () => (theSocket = fakeSocket((socket, message) => {
    if (message.type === 'start') {
      push(socket, { type: 'stage', stage: 'Mapping out your milestones' })
      push(socket, { type: 'prompt', id: '1', messages: [{ role: 'user', content: 'one' }], json: true })
      push(socket, { type: 'prompt', id: '2', messages: [{ role: 'user', content: 'bad' }] })
      push(socket, { type: 'prompt', id: '3', messages: [{ role: 'user', content: 'three' }] })
    }
    if (message.type === 'answer' && message.id === '3') push(socket, { type: 'done', pathId: 'path_1', answered: 2, failed: 1 })
  })),
})
assert.deepEqual(result, { pathId: 'path_1', answered: 2, failed: 1 })
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
