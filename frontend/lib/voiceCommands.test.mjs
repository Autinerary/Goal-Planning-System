// Run from frontend/: node --experimental-strip-types lib/voiceCommands.test.mjs
import assert from 'node:assert/strict'
import { parseVoiceCommand as p, bestMatch } from './voiceCommands.ts'

assert.deepEqual(p('Go to calendar'), { kind: 'go', to: '/calendar', label: 'the Calendar' })
assert.deepEqual(p('open my calendar please'), { kind: 'go', to: '/calendar', label: 'the Calendar' })
assert.deepEqual(p('Calendar.'), { kind: 'go', to: '/calendar', label: 'the Calendar' })
assert.equal(p('go to my next step').to, 'next-step')
assert.equal(p('open resource hub').to, 'hub:/')
assert.equal(p('take me to Tidbits').to, 'hub:/community')
assert.deepEqual(p('go back'), { kind: 'back' })
assert.deepEqual(p('Scroll down'), { kind: 'scroll', dir: 'down' })
assert.deepEqual(p('scroll to the top'), { kind: 'scroll', dir: 'top' })
assert.deepEqual(p('read this page'), { kind: 'read' })
assert.deepEqual(p('Stop.'), { kind: 'stop' })
assert.deepEqual(p('what can I say'), { kind: 'help' })
assert.deepEqual(p('where am I'), { kind: 'where' })
assert.deepEqual(p('click save changes'), { kind: 'click', name: 'save changes' })
assert.deepEqual(p('press the next button'), { kind: 'click', name: 'next' })
assert.deepEqual(p('search for speech therapy near Guelph'), { kind: 'search', query: 'speech therapy near guelph' })
assert.deepEqual(p('find a quiet pool'), { kind: 'search', query: 'a quiet pool' })
// "find resources" is a place, not a search.
assert.equal(p('find resources').kind, 'go')
assert.deepEqual(p('Ask what is a milestone?'), { kind: 'ask', question: 'what is a milestone?' })
assert.equal(p('blah blah').kind, 'unknown')
assert.equal(p('').kind, 'unknown')

// The control a spoken name means.
const opts = [{ name: 'Save changes' }, { name: 'Save as a draft' }, { name: 'Open this step' }]
assert.equal(bestMatch('save changes', opts)?.name, 'Save changes')
assert.equal(bestMatch('save', opts)?.name, 'Save changes')
assert.equal(bestMatch('draft', opts)?.name, 'Save as a draft')
assert.equal(bestMatch('nothing like it', opts), null)
console.log('voiceCommands: ok')
