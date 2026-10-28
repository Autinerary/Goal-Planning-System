// Run from servicehub-mvp/: node --experimental-strip-types lib/agents/validation-agent/spam-detector.test.mjs
//
// The Validation Agent's word checks decide what people can post: a comment that fails them is refused
// (app/api/resources/[id]/comments/route.ts). Tested 28 October 2026, after the 22 October review warned it might
// block how this community actually writes: acronyms, enthusiasm, plain talk about hard times.
import assert from 'node:assert/strict'
import { containsProfanity, detectSpam } from './spam-detector.ts'

const refused = (text) => containsProfanity(text) || detectSpam(text).isSpam

// What people here write, and must be able to post.
for (const text of [
  'The waitlist was hell, but the program was worth it.',
  'This program is 100% free!!!! We went every week.',
  'ADHD and OCD here. The OT got it.',
  'AuDHD, ASD, OCD, ODSP, OAP: they helped with all of it.',
  'Soooo helpful!!!! My son loved the swim instructor.',
  'Guaranteed spot if you register before August, which was a relief.',
  'Damn, I wish we had found this sooner.',
  'Yes!',
  'Their site is autismontario.com if you want the dates.',
  'Lessons are $15 a week, 1:1, with a 30-minute warm-up.',
  '10/10',
]) {
  assert.equal(refused(text), false, `refused a real community comment: "${text}"`)
}

// Spam must still be refused.
for (const text of [
  'BUY NOW!!!! Click here www.cheap-pills.example 100% free',
  'Make money fast, work from home, click here: www.get-rich.example',
  'casino casino casino casino lottery winner',
  'VIAGRA CHEAP!!! CLICK HERE NOW!!! www.pills.example',
]) {
  assert.equal(refused(text), true, `let spam through: "${text}"`)
}

// Slurs and the strongest swearing are still caught by the word check.
for (const text of ['what the fuck is this', 'you bitch']) {
  assert.equal(containsProfanity(text), true, `missed: "${text}"`)
}

console.log('spam-detector: ok')
