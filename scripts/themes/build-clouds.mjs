// The main app's cloud picture (frontend/public/cloud-bg.png, a pastel blue
// and pink watercolour), recoloured for each theme in
// scripts/themes/build-themes.mjs: the blue sky and the pink clouds each
// moved to the theme's two colours, lightness kept. Writes
// frontend/public/cloud-bg-<theme>.jpg. Uses sharp, from ResourceHub's
// packages:
//
//   node scripts/themes/build-clouds.mjs
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(ROOT, 'servicehub-mvp/package.json'))('sharp')

// HSL hue (degrees) and a saturation factor for the sky and for the clouds.
const THEMES = {
  earthy: { sky: [200, 0.75], clouds: [95, 0.45] }, // watery blue, sage
  ocean: { sky: [208, 0.9], clouds: [178, 0.55] }, // blue, aqua
  sand: { sky: [210, 0.4], clouds: [32, 0.5] }, // dusty blue, sand
  warm: { sky: [24, 0.55], clouds: [36, 0.5] }, // peach, apricot
  cool: { sky: [262, 0.45], clouds: [290, 0.4] }, // periwinkle, lilac
  bakery: { sky: [38, 0.5], clouds: [30, 0.42] }, // golden, light brown
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255))
}

const src = join(ROOT, 'frontend/public/cloud-bg.png')
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
for (const [id, t] of Object.entries(THEMES)) {
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    // The picture's sky is about 200-250 degrees, its clouds 280-360 and 0-30.
    // Between them the two are blended, so the edges stay soft.
    const skyness = h >= 170 && h <= 260 ? 1 : h > 260 && h < 300 ? (300 - h) / 40 : 0
    const sky = hslToRgb(t.sky[0], s * t.sky[1], l)
    const cloud = hslToRgb(t.clouds[0], s * t.clouds[1], l)
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(sky[c] * skyness + cloud[c] * (1 - skyness))
  }
  const file = join(ROOT, `frontend/public/cloud-bg-${id}.jpg`)
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 82, mozjpeg: true }).toFile(file)
  console.log('wrote', file.replace(ROOT + '/', ''))
}
