// Run from servicehub-mvp/: node --experimental-strip-types lib/visuals/aiCheck.test.mjs
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { checkForAiMarks, imageKind } from './aiCheck.ts'

// A real 1x1 PNG, with or without a tEXt chunk.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const png = (text) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2
  const idat = deflateSync(Buffer.from([0, 255, 255, 255]))
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(text ? [chunk('tEXt', Buffer.from(text, 'latin1'))] : []),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

assert.equal(imageKind(png()), 'png')
assert.equal(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'jpg')
assert.equal(imageKind(new Uint8Array(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))), 'webp')
assert.equal(imageKind(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))), null)

// A plain image passes.
assert.deepEqual(checkForAiMarks(png()), { ai: false, found: [] })
// Stable Diffusion's saved settings (AUTOMATIC1111 writes a "parameters" text chunk).
const sd = checkForAiMarks(png('parameters\0a castle\nNegative prompt: blurry\nSteps: 20, Sampler: Euler a, CFG scale: 7'))
assert.equal(sd.ai, true)
assert.deepEqual(sd.found, ['Stable Diffusion settings are saved in it'])
// Content Credentials' source type, as XMP or C2PA write it.
assert.equal(checkForAiMarks(new Uint8Array(Buffer.from('<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>'))).ai, true)
// A tool's name in the metadata, in any case.
assert.equal(checkForAiMarks(png('Software\0MidJourney v6')).ai, true)
assert.equal(checkForAiMarks(png('Software\0GIMP 2.10')).ai, false)
console.log('aiCheck: ok')
