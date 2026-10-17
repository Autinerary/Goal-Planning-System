// Builds the colour themes for both apps (the team's planning note, October
// 2026: "Colors & Theme: Earthy (Earthy Green & Watery Blue)", and an option in
// Settings to change the colours). Writes frontend/app/themes.css and
// servicehub-mvp/app/themes.css.
//
// Both apps write their colours as Tailwind classes, about 4,000 of them
// (bg-indigo-700, text-blue-600, ...), so a theme gives each colour family
// that carries the brand (indigo, violet, purple, fuchsia, pink, blue, sky,
// cyan) a new hue, through CSS variables the Tailwind configs point at.
// Greens, ambers, reds and greys keep their meaning (done, warning, error,
// text) and are not themed.
//
// Every new shade has the same lightness (WCAG relative luminance) as the
// shade it replaces, rounded towards more contrast: shades 50 to 400 never
// get darker and 500 to 950 never get lighter. So every pairing that passes
// the contrast checks in Classic, the original colours, passes in every
// theme. The script prints the check.
//
//   node scripts/themes/build-themes.mjs
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Tailwind 3.4's own palettes (tailwindcss/colors): the Classic theme.
const CLASSIC = {
  indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' },
  purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764' },
  fuchsia: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e' },
  pink: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
  sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
  cyan: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344' },
}
export const FAMILIES = Object.keys(CLASSIC)
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

// Each theme: a hue (OKLCH degrees) and a top chroma for each family. Low
// chroma is what makes a colour earthy rather than bright.
const THEMES = {
  earthy: {
    label: 'Earthy',
    // indigo carries the app's buttons; blue carries ResourceHub's.
    indigo: [150, 0.105], // forest green
    violet: [140, 0.095], // moss
    purple: [132, 0.085], // sage
    fuchsia: [52, 0.075], // clay
    pink: [45, 0.075], // clay
    blue: [238, 0.105], // watery blue
    sky: [228, 0.095], // lake
    cyan: [208, 0.085], // river
  },
  ocean: {
    label: 'Ocean',
    indigo: [255, 0.13], // deep sea
    violet: [245, 0.12],
    purple: [265, 0.10],
    fuchsia: [30, 0.10], // coral
    pink: [25, 0.10],
    blue: [222, 0.11], // open water
    sky: [215, 0.10],
    cyan: [195, 0.09], // shallows
  },
  sand: {
    label: 'Sand',
    indigo: [60, 0.07], // umber
    violet: [50, 0.065],
    purple: [70, 0.06],
    fuchsia: [35, 0.07], // clay
    pink: [35, 0.07],
    blue: [232, 0.05], // dusty blue
    sky: [225, 0.05],
    cyan: [200, 0.05],
  },
}

// Chroma along the scale: pale and deep shades carry less colour.
const PROFILE = { 50: 0.22, 100: 0.38, 200: 0.58, 300: 0.78, 400: 0.94, 500: 1, 600: 1, 700: 0.95, 800: 0.86, 900: 0.76, 950: 0.6 }

// ── colour maths ──
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
export const contrast = (y1, y2) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05)

function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
const inGamut = (rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6)
const encode = (c) => { c = Math.min(1, Math.max(0, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)) }

// The most colourful in-gamut sRGB colour at lightness L, hue h, up to C.
function colourAt(L, C, h) {
  let lo = 0, hi = C
  if (!inGamut(oklchToLinear(L, C, h))) {
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLinear(L, mid, h))) lo = mid; else hi = mid }
    C = lo
  }
  return oklchToLinear(L, C, h).map(encode)
}

// The shade at hue h with the target luminance, rounded towards contrast.
function matchShade(targetY, C, h, light) {
  let lo = 0, hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (luminance(colourAt(mid, C, h)) < targetY) lo = mid; else hi = mid
  }
  let L = (lo + hi) / 2, rgb = colourAt(L, C, h)
  // Light shades may not end up darker, dark shades not lighter.
  for (let i = 0; i < 200; i++) {
    const y = luminance(rgb)
    if (light ? y >= targetY : y <= targetY) break
    L += light ? 0.0005 : -0.0005
    rgb = colourAt(L, C, h)
  }
  return rgb
}

const toHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('')

export function buildPalettes() {
  const out = { classic: {} }
  for (const f of FAMILIES) out.classic[f] = Object.fromEntries(SHADES.map((s) => [s, hexToRgb(CLASSIC[f][s])]))
  for (const [id, theme] of Object.entries(THEMES)) {
    out[id] = {}
    for (const f of FAMILIES) {
      const [h, top] = theme[f]
      out[id][f] = {}
      for (const s of SHADES) {
        const y = luminance(hexToRgb(CLASSIC[f][s]))
        out[id][f][s] = matchShade(y, top * PROFILE[s], h, s <= 400)
      }
    }
  }
  return out
}

// The page behind the main app's cards (frontend only): text, colour, the
// wash under the clouds, and the clouds (scripts/themes/build-clouds.mjs).
const PAGE = {
  earthy: { fg: '#1f2e25', bg: '#e2ebe1', wash: 'linear-gradient(135deg, #c3dbe6 0%, #cfe0cf 30%, #e3e6cc 55%, #e8dfcb 75%, #cfdde3 100%)', clouds: "url('/cloud-bg-earthy.jpg')" },
  ocean: { fg: '#16283d', bg: '#dde9f3', wash: 'linear-gradient(135deg, #b9d6ee 0%, #bfdde6 30%, #c9e6e2 55%, #e9ddd6 75%, #cfdcef 100%)', clouds: "url('/cloud-bg-ocean.jpg')" },
  sand: { fg: '#2e2620', bg: '#eee6dc', wash: 'linear-gradient(135deg, #d6dde3 0%, #e3dccd 30%, #ecdccb 55%, #eedbcf 75%, #dcdde0 100%)', clouds: "url('/cloud-bg-sand.jpg')" },
  classic: { fg: '#2d1b4e', bg: '#e8dff5', wash: 'linear-gradient(135deg, #b8d4f0 0%, #c9b8e8 30%, #e8c4d8 55%, #f0c8d0 75%, #d0d8f0 100%)', clouds: "url('/cloud-bg.png')" },
}

function css(palettes, withPage) {
  const order = ['earthy', 'ocean', 'sand', 'classic'] // earthy first: :root is the default, later blocks win
  const lines = [
    '/* Generated by scripts/themes/build-themes.mjs; edit that, not this file.',
    '   The colour themes: Earthy (the default), Ocean, Sand and Classic (the',
    '   original colours). <html data-theme> picks one; any element with',
    '   data-theme shows that theme inside it (the pickers\' samples). */',
  ]
  for (const id of order) {
    const sel = id === 'earthy' ? ':root,\n[data-theme="earthy"]' : `[data-theme="${id}"]`
    lines.push(`${sel} {`)
    for (const f of FAMILIES) {
      lines.push('  ' + SHADES.map((s) => `--c-${f}-${s}: ${palettes[id][f][s].join(' ')};`).join(' '))
    }
    if (withPage) {
      const p = PAGE[id]
      lines.push(`  --page-fg: ${p.fg}; --page-bg: ${p.bg};`)
      lines.push(`  --page-wash: ${p.wash};`)
      lines.push(`  --page-clouds: ${p.clouds};`)
    }
    lines.push('}')
  }
  return lines.join('\n') + '\n'
}

// ── the check ──
// The pairings text and pictures use, as a share of Classic's contrast: a
// deep shade (500 to 950) on white or on a pale shade, a pale shade (50 to
// 400) on black or on a deep shade.
function check(palettes) {
  let worst = Infinity, where = ''
  const note = (ratio, label) => { if (ratio < worst) { worst = ratio; where = label } }
  for (const id of ['earthy', 'ocean', 'sand']) {
    for (const f of FAMILIES) {
      const ys = SHADES.map((s) => luminance(palettes[id][f][s]))
      const cs = SHADES.map((s) => luminance(palettes.classic[f][s]))
      SHADES.forEach((s, i) => {
        if (s >= 500) note(contrast(ys[i], 1) / contrast(cs[i], 1), `${id} ${f}-${s} on white`)
        else note(contrast(ys[i], 0) / contrast(cs[i], 0), `${id} ${f}-${s} on black`)
        SHADES.forEach((t, j) => {
          if (s >= 500 && t <= 400) note(contrast(ys[i], ys[j]) / contrast(cs[i], cs[j]), `${id} ${f}-${s} on ${f}-${t}`)
        })
      })
    }
  }
  return { worst, where }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const palettes = buildPalettes()
  writeFileSync(join(ROOT, 'frontend/app/themes.css'), css(palettes, true))
  writeFileSync(join(ROOT, 'servicehub-mvp/app/themes.css'), css(palettes, false))
  const { worst, where } = check(palettes)
  console.log('wrote frontend/app/themes.css and servicehub-mvp/app/themes.css')
  console.log(`contrast kept: worst pairing is ${(worst * 100).toFixed(2)}% of Classic's (${where})`)
  for (const id of ['earthy', 'ocean', 'sand']) {
    console.log(id.padEnd(7), FAMILIES.map((f) => `${f} ${toHex(palettes[id][f][600])}/${toHex(palettes[id][f][700])}`).join('  '))
  }
}
