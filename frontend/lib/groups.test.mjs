// Run from frontend/: node --experimental-strip-types lib/groups.test.mjs
//
// Groups (lib/groups.ts, STEP 102): a group's crisis lines are kept only as they may be, the browser gets a join code
// only for groups it leads, and the crisis card's links put text first (lib/crisis.ts).
import assert from 'node:assert/strict'
import { cleanCrisisLines, countWords, newJoinCode, readGroups, slugFor, MAX_LINES } from './groups.ts'
import { CRISIS_LINES, reachOutMailHref, reachOutSmsHref, smsHref } from './crisis.ts'

// Crisis lines: a name, what to do, and a number to call or text.
assert.deepEqual(cleanCrisisLines([
  { name: '  Campus  counselling ', how: 'call 416-978-8070, weekdays 9 to 5.', tel: '(416) 978-8070', extra: 'x' },
  { name: 'Peer support text line', how: 'text HELLO to 12345', sms: '12345', smsBody: 'HELLO!!' },
  { name: 'No number', how: 'none' },
  { name: '', how: 'no name', tel: '911' },
  'not a line',
]), [
  { name: 'Campus counselling', how: 'call 416-978-8070, weekdays 9 to 5.', tel: '4169788070' },
  { name: 'Peer support text line', how: 'text HELLO to 12345', sms: '12345', smsBody: 'HELLO' },
])
assert.equal(cleanCrisisLines(Array.from({ length: 9 }, (_, i) => ({ name: `L${i}`, how: 'call', tel: '4160000000' }))).length, MAX_LINES)
assert.deepEqual(cleanCrisisLines(null), [])

// The browser's groups: a join code only for a group it leads.
const groups = readGroups({ groups: [
  { id: 'g1', name: 'Student group at U of T', role: 'leader', joinCode: 'ABCD-EFGH-JKMN', lines: [] },
  { id: 'g2', name: 'A service', role: 'member', joinCode: 'LEAKED', lines: [{ name: 'Line', how: 'call', tel: '911' }] },
  { name: 'no id' },
] })
assert.deepEqual(groups.map((g) => [g.id, g.role, g.joinCode]), [['g1', 'leader', 'ABCD-EFGH-JKMN'], ['g2', 'member', undefined]])
assert.equal(groups[1].lines.length, 1)

assert.equal(slugFor('Student group at U of T!'), 'student-group-at-u-of-t')
const code = newJoinCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 7))
assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
assert.equal(countWords(null), 'fewer than 3')
assert.equal(countWords(0), '0')
assert.equal(countWords(7), '7')

// The crisis card: text first where a line takes texts, with the word to send; and the message to someone trusted.
const nineEightEight = CRISIS_LINES.find((l) => l.tel === '988' && !l.outsideCanada)
assert.equal(nineEightEight.sms, '988')
assert.match(nineEightEight.how, /^text or call/)
const good2talk = CRISIS_LINES.find((l) => l.name.startsWith('Good2Talk'))
assert.equal(smsHref(good2talk.sms, good2talk.smsBody), 'sms:686868?&body=GOOD2TALKON')
assert.equal(good2talk.tel, '18669255454')
assert.equal(reachOutSmsHref('Can you call me?'), 'sms:?&body=Can%20you%20call%20me%3F')
assert.equal(reachOutMailHref('Hi'), 'mailto:?subject=Can%20we%20talk%3F&body=Hi')

console.log('groups: ok')
