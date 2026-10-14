// Run from frontend/: node --experimental-strip-types lib/campaign.test.mjs
import assert from 'node:assert/strict'
import { CAMPAIGN_LINKS, campaignTarget, entryLine, sharedListUrl } from './campaign.ts'

// Group 15's five doors: each channel's greeting does what its visitors look for.
assert.equal(entryLine('facebook').lead, 'share')
assert.equal(entryLine('parent-group').lead, 'share')
assert.equal(entryLine('reddit').lead, 'sources')
assert.equal(entryLine('x').lead, 'preview')
assert.equal(entryLine('Twitter').lead, 'preview')
assert.equal(entryLine('tiktok').lead, undefined)
assert.match(entryLine('tiktok').line, /No forms/)
assert.equal(entryLine('in-person').welcome, 'Welcome. Someone you met in person shared this.')
assert.equal(entryLine('facebook').welcome, 'Welcome from Facebook.')
assert.equal(entryLine('share').welcome, 'Someone shared this list with you.')
assert.equal(entryLine('nope'), null)
assert.equal(entryLine(null), null)
// No invented numbers or claims in any line.
for (const code of ['facebook', 'parent-group', 'tiktok', 'instagram', 'reddit', 'x', 'linkedin', 'school', 'in-person', 'share']) {
  assert.doesNotMatch(entryLine(code).line, /\d/, code)
}

// Short links, new ones included, open Start here with their tracking.
assert.ok(CAMPAIGN_LINKS.x && CAMPAIGN_LINKS['in-person'])
assert.equal(campaignTarget('x'), '/start?utm_source=x&utm_campaign=beta-oct-2026')
assert.equal(campaignTarget('in-person'), '/start?utm_source=in-person&utm_campaign=beta-oct-2026')
assert.equal(campaignTarget('typo'), '/start')

// A shared list opens on the list, and says it was shared.
assert.equal(sharedListUrl('https://app.autinerary.ca/', 'child', 'services'),
  'https://app.autinerary.ca/start?for=child&need=services&utm_source=share')
console.log('campaign: ok')
