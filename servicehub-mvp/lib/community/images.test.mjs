// Run from servicehub-mvp/: node --experimental-strip-types lib/community/images.test.mjs
import assert from 'node:assert/strict'
import { isOwnImageUrl, keptImageUrls, ownImagePrefix, sniffImage } from './images.ts'

const BASE = 'https://abc.supabase.co'
const own = `${BASE}/storage/v1/object/public/resource-images/community/u1/1_a.png`

assert.equal(ownImagePrefix(BASE + '/'), `${BASE}/storage/v1/object/public/resource-images/`)
assert.equal(ownImagePrefix(''), null)

// Our own storage only.
assert.equal(isOwnImageUrl(own, BASE), true)
for (const bad of [
  'https://evil.example/x.png',
  'javascript:alert(1)',
  `${BASE}.evil.example/storage/v1/object/public/resource-images/x.png`,
  `${BASE}/storage/v1/object/public/other-bucket/x.png`,
  `${BASE}/storage/v1/object/public/resource-images/../other-bucket/x.png`,
  `${BASE}/storage/v1/object/public/resource-images/%2e%2e/other-bucket/x.png`,
  `${BASE}/storage/v1/object/public/resource-images/`,
  null,
  42,
]) {
  assert.equal(isOwnImageUrl(bad, BASE), false, String(bad))
}

// Kept: our own, plus what the item already had; no repeats; at most max.
assert.deepEqual(keptImageUrls([own, 'https://evil.example/x.png', own], [], 6, BASE), [own])
assert.deepEqual(keptImageUrls(['https://old.example/x.png', own], ['https://old.example/x.png'], 6, BASE), ['https://old.example/x.png', own])
assert.deepEqual(keptImageUrls('not a list', [], 6, BASE), [])
assert.equal(keptImageUrls(Array.from({ length: 9 }, (_, i) => `${own}?v=${i}`), [], 6, BASE).length, 6)

// The kind comes from the bytes.
const bytes = (...xs) => new Uint8Array(xs)
const text = (s) => new TextEncoder().encode(s)
assert.deepEqual(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)), { contentType: 'image/jpeg', ext: 'jpg' })
assert.deepEqual(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), { contentType: 'image/png', ext: 'png' })
assert.deepEqual(sniffImage(text('GIF89a....')), { contentType: 'image/gif', ext: 'gif' })
assert.deepEqual(sniffImage(text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')), { contentType: 'image/webp', ext: 'webp' })
assert.deepEqual(sniffImage(text('\u0000\u0000\u0000\u001cftypavif')), { contentType: 'image/avif', ext: 'avif' })
for (const s of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', '<?xml version="1.0"?><svg/>', '<html>', '\u0000\u0000\u0000\u0018ftypheic', '']) {
  assert.equal(sniffImage(text(s)), null, s)
}

console.log('community images: ok')
