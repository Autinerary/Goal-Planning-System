// Run from frontend/: node --experimental-strip-types lib/signupExtension.test.mjs
import assert from 'node:assert/strict'
import { canAddExtension, extensionStore } from './signupExtension.ts'

// Which store the extension is listed in (NEXT_PUBLIC_SIGNUP_EXTENSION_URL).
assert.equal(extensionStore(''), null, 'not listed anywhere yet')
assert.equal(extensionStore('https://microsoftedge.microsoft.com/addons/detail/autinerary/abcdefghijklmnopabcdefghijklmnop'), 'edge')
assert.equal(extensionStore('https://chromewebstore.google.com/detail/autinerary/abcdefghijklmnopabcdefghijklmnop'), 'chrome')
assert.equal(extensionStore('https://chrome.google.com/webstore/detail/x'), 'chrome')
assert.equal(extensionStore('https://example.com/autinerary.zip'), null, 'never a download from anywhere else')
assert.equal(extensionStore('not a url'), null)

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0'
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

// Not listed: nobody is sent to get it.
for (const ua of [CHROME, EDGE, FIREFOX, SAFARI]) assert.equal(canAddExtension(null, ua), false)
// Edge Add-ons: Edge only.
assert.equal(canAddExtension('edge', EDGE), true)
assert.equal(canAddExtension('edge', CHROME), false, 'Chrome can’t add from Edge’s store')
assert.equal(canAddExtension('edge', FIREFOX), false)
// The Chrome Web Store: Chrome, and Edge (which takes its extensions); not Firefox, Safari or a phone.
assert.equal(canAddExtension('chrome', CHROME), true)
assert.equal(canAddExtension('chrome', EDGE), true)
assert.equal(canAddExtension('chrome', FIREFOX), false)
assert.equal(canAddExtension('chrome', SAFARI), false)
assert.equal(canAddExtension('chrome', ANDROID_CHROME), false, 'never on a phone')

console.log('signupExtension: all passed')
