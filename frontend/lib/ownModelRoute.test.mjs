// Run from frontend/: node --experimental-strip-types lib/ownModelRoute.test.mjs
//
// Work that writes with AI goes to the person's own device when "Use my own model" is on and their model is ready, to
// the cloud when it's off; when it's on but not ready, something they asked for asks first and work in the background
// isn't done, with why. Never the cloud without their yes. And a job on the device returns its endpoint's result.
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { ' +
  'if (s.startsWith(".") && !/\\\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))
const { chooseRoute, saidByServer, withOwnModel, withOwnModelOrRules, wordsFor } = await import('./ownModelRoute.ts')
const { runOnDevice, deviceRunUrl } = await import('./deviceRun.ts')

const ready = { ok: true, models: ['llama3.2:3b'], hasModel: true, thinks: false }
const notRunning = { ok: false, reason: 'blocked' }
const deps = (over = {}) => {
  const log = { runs: [], asked: [], cloud: 0 }
  const d = {
    settings: () => ({ enabled: true, baseUrl: 'http://localhost:11434/v1', model: 'llama3.2:3b', runtime: 'ollama', browserModel: 'x-MLC', thinking: 'main', thinks: false }),
    ping: async () => ready,
    token: async () => 'tok',
    run: async (job, request, settings, token) => { log.runs.push({ job, request, token, runtime: settings.runtime }); return { from: 'device' } },
    confirm: (q) => { log.asked.push(q); return false },
    cloudModel: () => 'gpt-4o-mini',
    ...over,
  }
  return { d, log }
}
const cloud = (log) => async () => { log.cloud += 1; return { from: 'cloud' } }

// Off: the cloud, as before, and nothing is asked.
let { d, log } = deps({ settings: () => ({ enabled: false }) })
assert.deepEqual(await withOwnModel('guidance', {}, cloud(log), { ask: true }, d), { from: 'cloud' })
assert.deepEqual([log.runs.length, log.asked.length], [0, 0])

// On and ready: the device, with the job and its request; never the cloud.
;({ d, log } = deps())
assert.deepEqual(await withOwnModel('goal-steps', { goal: 'Swim weekly' }, cloud(log), { ask: true }, d), { from: 'device' })
assert.deepEqual(log.runs, [{ job: 'goal-steps', request: { goal: 'Swim weekly' }, token: 'tok', runtime: 'ollama' }])
assert.equal(log.cloud, 0)

// On, not ready, something they asked for: asked first, naming why and the cloud model; "no" does nothing and says why.
;({ d, log } = deps({ ping: async () => notRunning }))
const refused = await withOwnModel('reflection', {}, cloud(log), { ask: true }, d).catch((e) => e)
assert.equal(log.asked.length, 1)
assert.match(log.asked[0], /Your own model isn't ready: Ollama isn’t running/)
assert.match(log.asked[0], /Do this with gpt-4o-mini instead\? That model runs in the cloud, so what it needs to read goes to that AI company\./)
assert.equal(log.cloud, 0)
assert.equal(refused.ownModel, true)
assert.match(refused.message, /^Not done, because your own model isn’t ready: Ollama isn’t running/)
// …and "yes" uses the cloud.
;({ d, log } = deps({ ping: async () => notRunning, confirm: (q) => { log.asked.push(q); return true } }))
assert.deepEqual(await withOwnModel('assistant', {}, cloud(log), { ask: true }, d), { from: 'cloud' })

// On, not ready, in the background (step guidance): nothing asked, nothing done, and why.
;({ d, log } = deps({ ping: async () => notRunning }))
const quiet = await withOwnModel('guidance', {}, cloud(log), { ask: false }, d).catch((e) => e)
assert.deepEqual([log.asked.length, log.cloud, log.runs.length], [0, 0, 0])
assert.match(quiet.message, /^Your own model isn’t ready, so this wasn’t written: Ollama isn’t running/)

// A journal entry: on the device when ready; when not, saved without AI, never asked about the cloud; off, the cloud.
const withoutAI = (log) => async () => { log.rules = (log.rules || 0) + 1; return { from: 'rules' } }
;({ d, log } = deps())
let where = await chooseRoute({ ask: false }, d)
assert.deepEqual(await withOwnModelOrRules(where, 'reflection', { contextType: 'path' }, cloud(log), withoutAI(log), d), { from: 'device' })
assert.deepEqual(log.runs.map((r) => [r.job, r.request]), [['reflection', { contextType: 'path' }]])
;({ d, log } = deps({ ping: async () => notRunning }))
where = await chooseRoute({ ask: false }, d)
assert.match(where.why, /^Ollama isn’t running/)
assert.deepEqual(await withOwnModelOrRules(where, 'reflection', {}, cloud(log), withoutAI(log), d), { from: 'rules' })
assert.deepEqual([log.asked.length, log.cloud, log.runs.length, log.rules], [0, 0, 0, 1])
;({ d, log } = deps({ settings: () => ({ enabled: false }) }))
where = await chooseRoute({ ask: false }, d)
assert.deepEqual(await withOwnModelOrRules(where, 'reflection', {}, cloud(log), withoutAI(log), d), { from: 'cloud' })
// The assistant can say its reply is being written on their device.
;({ d, log } = deps())
let told = 0
await withOwnModel('assistant', {}, cloud(log), { ask: true, onDevice: () => { told += 1 } }, d)
assert.equal(told, 1)

// Signed out: their own model needs their sign-in to run the agents.
;({ d, log } = deps({ token: async () => null }))
assert.deepEqual(await chooseRoute({ ask: false }, d), { route: 'none', why: 'you need to be signed in to use it.' })

// A job on the device: the start message, each prompt answered by the model here, and the endpoint's own result back.
assert.equal(deviceRunUrl('https://api.example.com/'), 'wss://api.example.com/api/device/run')
function fakeSocket(script) {
  const sent = []
  const socket = { sent, send: (m) => sent.push(JSON.parse(m)), close: () => {}, onopen: null, onmessage: null, onerror: null, onclose: null }
  setTimeout(async () => {
    socket.onopen()
    for (const step of script) {
      await new Promise((r) => setTimeout(r, 5))
      socket.onmessage({ data: JSON.stringify(typeof step === 'function' ? step(sent) : step) })
    }
  }, 0)
  return socket
}
let socket
const result = await runOnDevice({
  apiUrl: 'http://localhost:8000', token: 'tok', settings: { enabled: true }, job: 'guidance', request: { languageStyle: 'person' },
  openSocket: () => (socket = fakeSocket([
    { type: 'prompt', id: 'p1', messages: [{ role: 'user', content: 'What helps?' }], max_tokens: 100, json: true },
    () => ({ type: 'done', result: { guidance: { m1: { tips: ['Go early.'] } }, pathId: 'path_1' }, answered: 1, failed: 0 }),
  ])),
  ask: async (_s, a) => (a.json ? '{"tips": ["Go early."]}' : 'x'),
})
assert.deepEqual(result, { guidance: { m1: { tips: ['Go early.'] } }, pathId: 'path_1' })
assert.deepEqual(socket.sent[0], { type: 'start', job: 'guidance', request: { languageStyle: 'person' }, token: 'tok' })
assert.deepEqual(socket.sent[1], { type: 'answer', id: 'p1', content: '{"tips": ["Go early."]}' })
const failed = await runOnDevice({
  apiUrl: 'http://localhost:8000', token: 'tok', settings: { enabled: true }, job: 'assistant', request: {},
  openSocket: () => fakeSocket([{ type: 'error', message: 'That didn’t work on your device. Please try again.' }]),
}).catch((e) => e)
assert.equal(failed.ownModel, true)
assert.equal(failed.message, 'That didn’t work on your device. Please try again.')

// What they're told: their own model's reason or the endpoint's words, never a raw network error.
assert.equal(wordsFor(refused, 'usual'), refused.message)
assert.equal(wordsFor(saidByServer('You have reached the usage limit for now.'), 'usual'), 'You have reached the usage limit for now.')
assert.equal(wordsFor(new TypeError('Failed to fetch'), 'usual'), 'usual')
assert.equal(wordsFor(undefined, 'usual'), 'usual')

console.log('own model route: ok')
