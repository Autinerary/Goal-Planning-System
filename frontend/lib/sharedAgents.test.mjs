// Run from frontend/: node --experimental-strip-types lib/sharedAgents.test.mjs
//
// Shared agents (lib/sharedAgents.ts): sharing sends exactly the agent's own words and who may see it, and the shared
// agent it was made from; someone's shared agent becomes one of yours to change, remembering where it came from; a
// refusal carries the checks that refused it.
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { ' +
  'if (s.startsWith(".") && !/\\\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))
const { ShareError, agentLinkFor, changeSharedAgent, checkSharedAgent, fromShared, listSharedAgents, rateSharedAgent, shareAgent, shareRequest, takeDownSharedAgent } = await import('./sharedAgents.ts')
const { agentFile, cleanAgent, seesWords } = await import('./agents.ts')

const now = new Date('2026-11-01T12:00:00Z')
const mine = cleanAgent({ name: 'Sensory check', purpose: 'Spots noise.', instructions: 'Suggest the quietest time.', lens: ['autism'], sees: ['plan', 'step'], runsOn: 'cloud' }, now)

// Sharing sends the agent's words and who may see it, nothing else of the person's.
let req = shareRequest(mine, 'everyone', ['someone'])
assert.deepEqual(req, { name: 'Sensory check', purpose: 'Spots noise.', instructions: 'Suggest the quietest time.', lens: ['autism'], sees: ['plan', 'step'], visibility: 'everyone', people: [], builtOn: null })
assert.deepEqual(shareRequest(mine, 'people', ['a', 'b']).people, ['a', 'b'], 'people only when shared with people')
assert.ok(!('runsOn' in req) && !('id' in req) && !('sharedId' in req), 'where it runs for its owner, and its ids, stay here')

// Someone's shared agent becomes one of yours, remembering where it came from; sharing it again names that.
const theirs = { id: '2b9e8c70-aaaa-4bbb-8ccc-ddddeeeeffff', name: 'Quiet first', purpose: 'Calm starts.', instructions: 'Mornings first.', lens: ['autism', 'work'], sees: ['plan'] }
const adopted = fromShared(theirs, now)
assert.deepEqual([adopted.name, adopted.instructions, adopted.lens, adopted.sees, adopted.runsOn], ['Quiet first', 'Mornings first.', ['autism', 'work'], ['plan'], 'device'])
assert.deepEqual(adopted.from, { kind: 'community', id: theirs.id, name: 'Quiet first' })
assert.equal(adopted.sharedId, null)
adopted.lens.push('adhd')
assert.deepEqual(theirs.lens, ['autism', 'work'], 'a copy: changing yours leaves theirs alone')
assert.equal(shareRequest({ ...adopted, instructions: 'Mornings first, and a way out.' }, 'link', []).builtOn, theirs.id)

// Its shared copy is remembered here, but never put in a file.
const sharedOnce = cleanAgent({ ...mine, sharedId: '7f3c2a10-1111-4222-8333-444455556666' }, now)
assert.equal(sharedOnce.sharedId, '7f3c2a10-1111-4222-8333-444455556666')
assert.equal(cleanAgent({ ...mine, sharedId: 'not-an-id' }, now).sharedId, null)
assert.ok(!agentFile(sharedOnce).includes('sharedId'))

// What it sees, in words, to the person using it and about them.
assert.equal(seesWords(['plan', 'step'], 'yours'), 'your plan, the step you ask about')
assert.equal(seesWords(['norms', 'goals'], 'theirs'), 'their norms, their goals')
assert.equal(seesWords([], 'yours'), 'only what you write to it')

assert.equal(agentLinkFor('https://app.autinerary.ca/', 'k_Ab-12'), 'https://app.autinerary.ca/agents/community?key=k_Ab-12')

// The API: the right addresses and methods, the person's token, and a refusal with its checks.
const calls = []
const fake = (status, body) => async (url, init) => { calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : null }); return { ok: status < 400, status, json: async () => body } }
await shareAgent('http://api/', 'tok', req, fake(200, { id: 'x', status: 'approved', visibility: 'everyone', linkKey: null, checks: {} }))
await changeSharedAgent('http://api', 'tok', 'x', req, fake(200, {}))
await takeDownSharedAgent('http://api', 'tok', 'x', fake(200, { deleted: true }))
await rateSharedAgent('http://api', 'tok', 'x', 4, 'k_key', fake(200, {}))
await listSharedAgents('http://api', null, fake(200, { enabled: true, agents: [], sharedWithMe: [], forYou: false }))
assert.deepEqual(calls.map((c) => [c.method, c.url]), [
  ['POST', 'http://api/api/shared-agents'], ['PATCH', 'http://api/api/shared-agents/x'], ['DELETE', 'http://api/api/shared-agents/x'],
  ['POST', 'http://api/api/shared-agents/x/rating?key=k_key'], ['GET', 'http://api/api/shared-agents'],
])
assert.equal(calls[0].auth, 'Bearer tok')
assert.equal(calls[4].auth, undefined, 'listing works signed out')
const refused = await checkSharedAgent('http://api', 'tok', req, fake(422, { detail: { message: 'Not shared: a check didn’t pass.', checks: { words: { passed: false, why: 'A name.' } } } })).catch((e) => e)
assert.ok(refused instanceof ShareError)
assert.equal(refused.checks.words.why, 'A name.')
const plain = await takeDownSharedAgent('http://api', 'tok', 'x', fake(404, { detail: 'That isn’t one of your shared agents.' })).catch((e) => e)
assert.equal(plain.message, 'That isn’t one of your shared agents.')

console.log('shared agents: ok')
