// Run from frontend/: node --experimental-strip-types lib/agents.test.mjs
//
// My agents (lib/agents.ts): an agent is kept only as it may be (limits, known norms and scopes); it is kept in this
// browser and moved by file; it sees only what its owner allowed; our rules come before its instructions; answers from
// small models are read even when wrapped in words; and it runs on the device or the cloud as its owner chose.
import assert from 'node:assert/strict'
import { register } from 'node:module'

// lib/agents.ts imports its neighbours without ".ts", as the app does; Node needs the extension, so add it here.
register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { ' +
  'if (s.startsWith(".") && !/\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))
const {
  LIMITS, STARTERS, SAFETY, agentFile, agentFromFile, agentFromStarter, cleanAgent, cloudRunner, contextFor, deviceRunner,
  firstJson, loadAgents, personData, readPlanReview, readStepReview, saveAgents, systemFor, withAgent,
} = await import('./agents.ts')

const now = new Date('2026-11-01T12:00:00Z')

// Kept only as it may be.
assert.equal(cleanAgent({ name: 'x' }), null, 'a name is needed')
assert.equal(cleanAgent(null), null)
const a = cleanAgent({ name: '  Calm   coach ', purpose: 'p'.repeat(500), instructions: 'line one\n\n\n\nline two\u0007',
  lens: ['autism', 'not-a-tag', 'autism', 'adhd'], sees: ['norms', 'diary', 'step'], runsOn: 'mars' }, now)
assert.equal(a.name, 'Calm coach')
assert.equal(a.purpose.length, LIMITS.purpose)
assert.equal(a.instructions, 'line one\n\nline two')
assert.deepEqual(a.lens, ['autism', 'adhd'])
assert.deepEqual(a.sees, ['norms', 'step'])
assert.equal(a.runsOn, 'device', 'on the device unless the owner chose the cloud')
assert.match(a.id, /^[A-Za-z0-9-]{6,64}$/)
assert.equal(cleanAgent({ name: 'Cloud one', runsOn: 'cloud' }).runsOn, 'cloud')
assert.equal(cleanAgent({ name: 'Too many', lens: ['autism', 'adhd', 'dyslexia', 'ocd', 'anxiety', 'depression', 'work'] }).lens.length, LIMITS.lens)

// Kept in this browser.
const store = new Map()
const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
assert.deepEqual(loadAgents(storage), [])
let agents = withAgent([], a, now)
agents = withAgent(agents, cleanAgent({ name: 'Second' }, now), now)
saveAgents(agents, storage)
assert.deepEqual(loadAgents(storage).map((x) => x.name), ['Second', 'Calm coach'], 'newest change first')
agents = withAgent(agents, { ...a, name: 'Calm coach, edited' }, now)
assert.deepEqual(agents.map((x) => x.name), ['Calm coach, edited', 'Second'], 'an edit replaces, by id')
store.set('autinerary.agents.v1', '{not json')
assert.deepEqual(loadAgents(storage), [], 'anything unreadable is nothing, not an error')
let many = []
for (let i = 0; i < 40; i++) many = withAgent(many, cleanAgent({ name: `Agent ${i}` }, now), now)
assert.equal(many.length, LIMITS.agents)

// Moved between devices by file: a new id there, everything else the same.
const file = agentFile(a)
assert.ok(!file.includes(a.id), 'the file carries no id')
const moved = agentFromFile(file, now)
assert.notEqual(moved.id, a.id)
assert.deepEqual([moved.name, moved.instructions, moved.lens, moved.sees, moved.runsOn], [a.name, a.instructions, a.lens, a.sees, a.runsOn])
assert.deepEqual(moved.from, { kind: 'file', id: '', name: a.name })
assert.match(agentFromFile('{"format":"something-else"}').error, /isn’t an agent file/)
assert.match(agentFromFile('not json').error, /isn’t an agent file/)
assert.match(agentFromFile(JSON.stringify({ format: 'autinerary-agent', version: 1, agent: { name: '' } })).error, /no name/)

// Our starters are valid agents, and say they're ours.
for (const s of STARTERS) {
  const made = agentFromStarter(s, now)
  assert.equal(made.name, s.name)
  assert.deepEqual(made.lens, s.lens, `${s.id}: every lens tag is a real one`)
  assert.deepEqual(made.sees, s.sees)
  assert.deepEqual(made.from, { kind: 'starter', id: s.id, name: s.name })
  assert.ok(made.instructions.length > 40 && made.instructions.length <= LIMITS.instructions)
}

// It sees only what its owner allowed.
const data = personData(
  { userProfile: { barrierTypes: ['ADHD', 'Autism'], goals: ['Swim once a week'], dreams: ['Feel calm'], currentChallenges: ['Crowds'] } },
  { milestones: [{ id: 'm1', name: 'Check pool hours', description: 'Find quiet times.', goal: 'Swim once a week' }, { id: 'm2', name: 'Buy goggles' }, { name: 'no id' }] },
)
assert.deepEqual(data.steps.map((s) => s.id), ['m1', 'm2'])
const step = data.steps[0]
assert.equal(contextFor({ sees: [] }, data, step), '', 'nothing, when it may see nothing')
const normsOnly = contextFor({ sees: ['norms'] }, data, step)
assert.equal(normsOnly, 'Norms they navigate: ADHD, Autism')
const planOnly = contextFor({ sees: ['plan'] }, data, step)
assert.match(planOnly, /1\. Check pool hours: Find quiet times\.\n2\. Buy goggles/)
assert.ok(!/ADHD|Swim once|Crowds|asking about/.test(planOnly), 'no norms, goals or step when it may only see the plan')
assert.ok(!/asking about/.test(contextFor({ sees: ['norms', 'goals', 'plan'] }, data, step)), 'the step only with "step"')
assert.match(contextFor({ sees: ['step'] }, data, step), /The step they're asking about: Check pool hours\. Find quiet times\. \(for the goal: Swim once a week\)/)
assert.match(contextFor({ sees: ['goals'] }, data), /Goals: Swim once a week\n\nDreams: Feel calm\n\nWhat gets in the way: Crowds/)

// Our rules first; its instructions fenced after them; what it knows marked as information.
const system = systemFor({ name: 'Sensory check', purpose: 'Spots noise.', instructions: 'Be calm.', lens: ['autism'] }, 'Norms they navigate: ADHD')
assert.ok(system.startsWith(SAFETY))
assert.ok(system.indexOf('<agent_instructions>\nBe calm.\n</agent_instructions>') > system.indexOf('You are "Sensory check"'))
assert.match(system, /through these norms: Autism\./)
assert.ok(system.indexOf('<about_them>\nNorms they navigate: ADHD\n</about_them>') > system.indexOf('</agent_instructions>'))
assert.ok(!systemFor({ name: 'Bare', purpose: '', instructions: '', lens: [] }, '').includes('<'), 'nothing fenced when there is nothing')

// Answers from small models: JSON wrapped in words or fences, braces inside strings.
assert.deepEqual(firstJson('Sure! ```json\n{"note": "a {b} c", "n": {"x": 1}}\n``` hope that helps'), { note: 'a {b} c', n: { x: 1 } })
assert.equal(firstJson('no json here'), null)
assert.deepEqual(firstJson('{broken {"ok": true}'), { ok: true })
let review = readStepReview('{"note": "Mornings are quieter.", "rewrite": {"name": "Swim at 7am on Tuesday", "description": "The pool is calm then."}}')
assert.deepEqual(review, { note: 'Mornings are quieter.', rewrite: { name: 'Swim at 7am on Tuesday', description: 'The pool is calm then.' } })
assert.equal(readStepReview('{"note": "It is fine.", "rewrite": null}').rewrite, null)
assert.deepEqual(readStepReview('Just go early, it is quieter.'), { note: 'Just go early, it is quieter.', rewrite: null }, 'plain words are the note')
assert.equal(readStepReview('{"note": "x", "rewrite": {"name": "a"}}').rewrite, null, 'a one-letter rewrite is no rewrite')
const notes = readPlanReview('{"notes": [{"step": 2, "note": "Try them on first."}, {"step": 9, "note": "no such step"}, {"step": 2, "note": "again"}, {"step": 1, "note": ""}]}', data.steps)
assert.deepEqual(notes.map((n) => [n.step.id, n.note]), [['m2', 'Try them on first.']])
assert.deepEqual(readPlanReview('nothing useful', data.steps), [])

// Runs where its owner chose.
const asked = []
const device = deviceRunner(a, 'Norms they navigate: ADHD', { enabled: true }, async (settings, ask) => { asked.push(ask); return 'answer' })
assert.equal(await device([{ role: 'user', content: 'hi' }], { json: true, maxTokens: 400 }), 'answer')
assert.equal(asked[0].messages[0].role, 'system')
assert.ok(asked[0].messages[0].content.startsWith(SAFETY))
assert.deepEqual(asked[0].messages.slice(1), [{ role: 'user', content: 'hi' }])
assert.deepEqual([asked[0].json, asked[0].max_tokens, asked[0].think, asked[0].agent], [true, 400, false, 'my_agent'])

const posted = []
const fakeFetch = (reply) => async (url, init) => { posted.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => reply } }
const cloud = cloudRunner({ ...a, lens: ['autism'] }, 'Norms they navigate: ADHD', { model: 'gpt-4o-mini' }, fakeFetch({ configured: true, reply: 'from the cloud' }))
assert.equal(await cloud([{ role: 'user', content: 'hi' }], {}), 'from the cloud')
assert.equal(posted[0].url, '/api/assistant/chat')
assert.deepEqual(posted[0].body.agent, { name: a.name, purpose: a.purpose, instructions: a.instructions, lens: ['Autism'] })
assert.equal(posted[0].body.context, 'Norms they navigate: ADHD')
assert.deepEqual(posted[0].body.llm_config, { model: 'gpt-4o-mini' })
assert.ok(!('system' in posted[0].body) && posted[0].body.messages.every((m) => m.role !== 'system'), 'the server writes the system prompt, not the browser')
// What the safety check did reaches the answer's label (lib/aiSafety.ts): from the server for the cloud, and from the
// browser's own check on the device, where someone who may be at risk is answered with care.
const infos = []
const checked = cloudRunner(a, '', null, fakeFetch({ configured: true, reply: 'r', modelLabel: 'GPT-4o mini', safety: { by: 'openai', care: false, hidden: ['phone'] } }))
await checked([{ role: 'user', content: 'call me at [PHONE]' }], { onAnswer: (i) => infos.push(i) })
assert.deepEqual(infos[0], { safety: { by: 'openai', care: false, hidden: ['phone'], rewritten: false, dropped: false }, model: 'GPT-4o mini', onDevice: false })
const carefully = []
const onDevice = deviceRunner(a, '', { enabled: true }, async (settings, ask) => { carefully.push(ask); return 'here for you' })
await onDevice([{ role: 'user', content: 'I don’t want to be alive anymore' }], { onAnswer: (i) => infos.push(i) })
assert.match(carefully[0].messages[0].content, /9-8-8/, 'the device model is asked to answer with care')
assert.deepEqual(infos[1], { safety: { by: 'rules', care: true }, model: null, onDevice: true })
await onDevice([{ role: 'user', content: 'this deadline is killing me' }], { onAnswer: (i) => infos.push(i) })
assert.doesNotMatch(carefully[1].messages[0].content, /9-8-8/)
assert.equal(infos[2].safety.care, false)

await assert.rejects(cloudRunner(a, '', null, fakeFetch({ reply: 'You have reached the usage limit.', rateLimited: true, failed: true }))([{ role: 'user', content: 'hi' }], {}), /usage limit/)
await assert.rejects(cloudRunner(a, '', null, fakeFetch({ configured: false, reply: 'not set up' }))([{ role: 'user', content: 'hi' }], {}), /isn’t set up/)

console.log('agents: ok')
