// Run from frontend/: node --experimental-strip-types lib/publicUrl.test.mjs (needs DNS for the public names)
import assert from 'node:assert/strict'
import { publicHost } from './publicUrl.ts'

const no = ['http://localhost:3000/', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://metadata.google.internal/', 'http://printer.local/', 'file:///etc/passwd', 'ftp://example.com/', 'http://localtest.me/']
for (const u of no) assert.equal(await publicHost(new URL(u)), false, u)
assert.equal(await publicHost(new URL('https://example.com/contact')), true, 'a public site')
process.env.CONTACT_LOOKUP_ALLOW_PRIVATE = 'on'
assert.equal(await publicHost(new URL('http://localhost:4685/site')), true, 'local tests only')
console.log('publicUrl: all passed')
