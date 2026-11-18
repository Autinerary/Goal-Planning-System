// Run from frontend/: node --experimental-strip-types lib/personalData.test.mjs
//
// A shared browser (bug audit, 17 November 2026, item 8): the last person's setup draft, plan answers and preferences
// are cleared at sign-out, and everything of theirs before another account is used; the device's accessibility
// settings stay, and so do a visitor's answers from before they sign up. And a reminders change replaces the stored
// reminders, as the account does, so a removed end date stays removed.
import assert from 'node:assert/strict'

function fakeStorage() {
  const map = new Map()
  return {
    get length() { return map.size },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    clear: () => map.clear(),
  }
}
const local = fakeStorage()
const session = fakeStorage()
const events = []
Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true })
globalThis.window = { localStorage: local, sessionStorage: session, dispatchEvent: (e) => { events.push(e.type); return true } }

const { claimBrowserFor, releaseBrowser, noSessionHere, clearPersonalData, browserOwner, ownLocalProfile, OWNER_KEY } = await import('./personalData.ts')
const { savePreferences, loadPreferences } = await import('./preferences.ts')

const SENSITIVE = ['autinerary_onboarding_draft', 'autinerary_path_seed', 'autinerary_profile', 'autinerary_onboarding_choices', 'autinerary_generation_job', 'raceExtraBarriers']
const KEPT = ['autinerary_active_days', 'autinerary_path_snapshots', 'calendarAddedTasks:user-a']
const fill = () => {
  local.setItem('autinerary_onboarding_draft', JSON.stringify({ step: 1, data: { goals: ['A’s goal'] } }))
  local.setItem('autinerary_path_seed', '{}')
  local.setItem('autinerary_profile', JSON.stringify({ goals: ['A’s goal'], barrierTypes: ['ADHD'] }))
  local.setItem('autinerary_onboarding_choices', '{}')
  local.setItem('autinerary_generation_job', 'job-1')
  local.setItem('raceExtraBarriers', '["Anxiety"]')
  local.setItem('autinerary_active_days', '["2026-11-17"]')
  local.setItem('autinerary_path_snapshots', '[]')
  local.setItem('calendarAddedTasks:user-a', '[]')
  local.setItem('autinerary_preferences', JSON.stringify({
    accessibility: { fontScale: 'large', darkMode: true },
    reminders: { enabled: true, contact: 'a@example.com' },
    aboutMe: { sections: { hard: 'phone calls' } },
  }))
  // The device's own: always kept.
  local.setItem('autinerary_cookie_consent', 'all')
  local.setItem('autinerary_visitor_id', 'v1')
  session.setItem('autinerary_has_norms', '1')
}
const gone = (keys) => keys.every((k) => local.getItem(k) === null)
const kept = (keys) => keys.every((k) => local.getItem(k) !== null)

// Signing out clears the person's words and answers, keeps the device's accessibility, and keeps their streak and
// saved copies for when they come back.
local.clear()
fill()
local.setItem(OWNER_KEY, 'user-a')
releaseBrowser()
assert.ok(gone(SENSITIVE), 'words and answers go at sign-out')
assert.ok(kept(KEPT), 'a streak and saved copies wait for the same person')
assert.equal(session.getItem('autinerary_has_norms'), null)
assert.deepEqual(JSON.parse(local.getItem('autinerary_preferences')), { accessibility: { fontScale: 'large', darkMode: true } })
assert.equal(loadPreferences().reminders.contact, '', 'no reminder email is left for the next person')
assert.equal(local.getItem('autinerary_cookie_consent'), 'all')
assert.equal(local.getItem('autinerary_visitor_id'), 'v1')
assert.ok(events.includes('autinerary:prefs'), 'open pages read the preferences again')
assert.ok(events.includes('autinerary:personal-cleared'), 'saves still on their way are dropped')

// The same person signs in again: their streak is still here.
assert.equal(claimBrowserFor('user-a'), false)
assert.ok(kept(KEPT))

// Signed out, then a visitor answers Start here and makes an account: the last person's kept things go, the
// visitor's answers stay.
releaseBrowser()
local.setItem('autinerary_start_for', 'parent')
assert.equal(claimBrowserFor('user-b'), true)
assert.ok(gone(KEPT), 'the last person’s streak and copies go before another account')
assert.equal(local.getItem('autinerary_start_for'), 'parent')
assert.equal(browserOwner(), 'user-b')

// Another account signs in on a browser that is still someone else's (no sign-out): everything of theirs goes.
local.clear()
fill()
local.setItem(OWNER_KEY, 'user-a')
assert.equal(claimBrowserFor('user-c'), true)
assert.ok(gone(SENSITIVE) && gone(KEPT))
assert.equal(local.getItem('autinerary_visitor_id'), 'v1')

// Before the owner was kept: the last account's copy (app_user), or the account that last opened a page here.
local.clear()
fill()
local.setItem('app_user', JSON.stringify({ id: 'user-a' }))
assert.equal(claimBrowserFor('user-c'), true)
assert.ok(gone(SENSITIVE))
local.clear()
fill()
local.setItem('autinerary_last_place', JSON.stringify({ path: '/path', at: 1, user: 'user-a' }))
assert.equal(claimBrowserFor('user-c'), true)
assert.ok(gone(SENSITIVE) && gone(KEPT))

// A browser nobody has used: nothing to clear.
local.clear()
local.setItem('autinerary_start_for', 'self')
assert.equal(claimBrowserFor('user-d'), false)
assert.equal(local.getItem('autinerary_start_for'), 'self')

// A page opened after the session ran out: cleared as at sign-out, once; after that a visitor's answers stay.
local.clear()
fill()
local.setItem(OWNER_KEY, 'user-a')
noSessionHere()
assert.ok(gone(SENSITIVE))
local.setItem('autinerary_start_for', 'friend')
noSessionHere()
assert.equal(local.getItem('autinerary_start_for'), 'friend')

// The assistant reads the local plan answers only when they are this person's.
local.clear()
local.setItem(OWNER_KEY, 'user-d')
local.setItem('autinerary_profile', JSON.stringify({ userId: 'user-d', goals: ['mine'] }))
assert.deepEqual(ownLocalProfile('user-d')?.goals, ['mine'])
assert.equal(ownLocalProfile('user-e'), null)
local.setItem('autinerary_profile', JSON.stringify({ goals: ['untagged'] }))
assert.deepEqual(ownLocalProfile('user-d')?.goals, ['untagged'], 'untagged, on the owner’s browser')
assert.equal(ownLocalProfile('user-e'), null, 'untagged, on someone else’s browser')
assert.equal(ownLocalProfile(null), null)

// A reminders change replaces them: "Keep sending after that" takes the end date away for good.
clearPersonalData()
savePreferences({ reminders: { enabled: true, channel: 'email', contact: 'd@example.com', time: '09:00', consent: true, until: '2026-12-01' } })
assert.equal(loadPreferences().reminders.until, '2026-12-01')
const { until, ...rest } = loadPreferences().reminders
void until
savePreferences({ reminders: rest })
assert.equal(loadPreferences().reminders.until, undefined)
assert.equal(loadPreferences().reminders.contact, 'd@example.com')
// Other changes leave the reminders as they are.
savePreferences({ language: 'fr' })
assert.equal(loadPreferences().reminders.contact, 'd@example.com')

console.log('personalData: ok')
