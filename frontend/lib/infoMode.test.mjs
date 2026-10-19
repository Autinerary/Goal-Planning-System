// Run from frontend/: node --experimental-strip-types lib/infoMode.test.mjs
import assert from 'node:assert/strict'
import { INFO_MODE_ORDER, INFO_MODE_META, nextInfoMode } from './infoMode.ts'

// Action first; the ? cycles Info, Info + Action, Action, and back to Info.
assert.deepEqual(INFO_MODE_ORDER, ['action', 'info', 'infoAction'])
assert.equal(nextInfoMode('action'), 'info')
assert.equal(nextInfoMode('info'), 'infoAction')
assert.equal(nextInfoMode('infoAction'), 'action')
// The two help modes say how they differ.
assert.notEqual(INFO_MODE_META.info.description, INFO_MODE_META.infoAction.description)
assert.match(INFO_MODE_META.infoAction.description, /once/)
console.log('infoMode: ok')
