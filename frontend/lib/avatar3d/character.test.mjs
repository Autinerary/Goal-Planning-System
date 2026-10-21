// Run from frontend/: node --experimental-strip-types lib/avatar3d/character.test.mjs
import assert from 'node:assert/strict'
import { DEFAULT_CHARACTER, HAIRS, OUTFITS, FACE_SLIDERS, describe, sanitize, sliderWords } from './character.ts'

// Nothing saved yet: the default, whole.
assert.deepEqual(sanitize(undefined), DEFAULT_CHARACTER)
assert.deepEqual(sanitize(null), DEFAULT_CHARACTER)
assert.deepEqual(sanitize('a string'), DEFAULT_CHARACTER)

// A good save comes back as it was.
const good = {
  ...DEFAULT_CHARACTER,
  hair: 'afro', hairColor: '#8c3a20', brows: 'none', lips: '#b5485d',
  features: ['freckles', 'scar'], facePaint: 'star', tattoo: 'vine', glasses: 'round',
  outfit: 'suit', attire: 'basics', face: { noseWidth: 0.4, earPoint: 1 }, body: { bodyShape: -0.6 },
  height: 0.25, smile: true, pose: 'wave', environment: 'night',
}
assert.deepEqual(sanitize(good), good)

// Unknown or unsafe parts fall back, part by part.
const bad = sanitize({
  hair: 'mohawk', hairColor: 'red', skin: 'url(javascript:1)', eyes: 'purple', lips: 'shiny',
  outfit: 'basics', attire: 'nothing', pose: 'dab', environment: 'moon', glasses: 42,
})
assert.equal(bad.hair, DEFAULT_CHARACTER.hair)
assert.equal(bad.hairColor, DEFAULT_CHARACTER.hairColor)
assert.equal(bad.skin, DEFAULT_CHARACTER.skin)
assert.equal(bad.eyes, DEFAULT_CHARACTER.eyes)
assert.equal(bad.lips, DEFAULT_CHARACTER.lips)
assert.equal(bad.outfit, DEFAULT_CHARACTER.outfit, "'basics' is the attire, not an outfit")
assert.equal(bad.attire, 'outfit')
assert.equal(bad.pose, 'standing')
assert.equal(bad.environment, 'studio')
assert.equal(bad.glasses, 'none')

// Facial hair: known ids, or none.
assert.equal(sanitize({ beard: 'goatee' }).beard, 'goatee')
assert.equal(sanitize({ beard: 'handlebar' }).beard, 'none')
assert.match(describe({ ...DEFAULT_CHARACTER, beard: 'goatee' }), /natural eyebrows and a goatee\./)

// Colours are kept lower case; 'none' is allowed where nothing is a choice.
assert.equal(sanitize({ hairColor: '#AABBCC' }).hairColor, '#aabbcc')
assert.equal(sanitize({ hair: 'none', facePaint: 'none', tattoo: 'none' }).hair, 'none')
assert.equal(sanitize({ eyes: 'none' }).eyes, DEFAULT_CHARACTER.eyes, 'eyes are never none')

// Sliders: clamped to -1..1, rounded, unknown ones dropped, one-way ones never negative.
const s = sanitize({ face: { noseWidth: 3, jaw: -0.123456, made_up: 1, earPoint: -1, chin: 'x' }, height: -9 })
assert.deepEqual(s.face, { noseWidth: 1, jaw: -0.12 })
assert.equal(s.height, -1)
assert.ok(FACE_SLIDERS.find((f) => f.id === 'earPoint').twoWay === false)

// Features: known only, once each, in the catalogue's order.
assert.deepEqual(sanitize({ features: ['scar', 'freckles', 'scar', 'tan-lines', 7] }).features, ['freckles', 'scar'])

// The catalogue: ids are unique, and the default's choices exist.
for (const list of [HAIRS, OUTFITS, FACE_SLIDERS]) {
  assert.equal(new Set(list.map((x) => x.id)).size, list.length)
}
assert.ok(HAIRS.some((h) => h.id === DEFAULT_CHARACTER.hair))
assert.ok(OUTFITS.some((o) => o.id === DEFAULT_CHARACTER.outfit))
assert.ok(!OUTFITS.some((o) => o.id === 'basics'), 'Basics is the Attire toggle')

// The description reads as one plain sentence.
const d = describe(good)
assert.match(d, /^Your character: /)
assert.match(d, /afro hair in auburn/)
assert.match(d, /no eyebrows/)
assert.match(d, /freckles and scar/)
assert.match(d, /star face paint in blue/)
assert.match(d, /Outfit: Basics \(a plain tee and shorts\)\. Pose: wave\. Backdrop: night\.$/)
assert.match(describe(DEFAULT_CHARACTER), /short and tousled hair in dark brown/)
assert.match(describe(DEFAULT_CHARACTER), /Outfit: T-shirt and jeans\./, 'keeps the capital T')
assert.match(describe({ ...DEFAULT_CHARACTER, hairColor: '#123456' }), /hair in a colour close to /)

// Slider values in words.
assert.equal(sliderWords(0, 'Narrower', 'Wider'), 'Middle')
assert.equal(sliderWords(0.2, 'Narrower', 'Wider'), 'A little wider')
assert.equal(sliderWords(-0.5, 'Narrower', 'Wider'), 'Quite a bit narrower')
assert.equal(sliderWords(0.9, 'Narrower', 'Wider'), 'A lot wider')

console.log('character.test.mjs: all passed')
