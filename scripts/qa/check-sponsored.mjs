// Code kept the same in both apps. Sponsored listings are chosen and counted the same way in both apps
// (servicehub-mvp/lib/sponsored.ts for searches and Tidbits, and its copy in
// frontend/lib/sponsored.ts for Paths). Apart from their opening comment and
// the hub-only PAYMENTS_ON line, they must be the same: run in CI.
//   node scripts/qa/check-sponsored.mjs
import { readFileSync } from 'fs'
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
// Drop the first doc comment (each says where it lives) and the hub-only lines.
const body = (s) =>
  s
    .replace(/\/\*\*[\s\S]*?\*\/\n/, '')
    .replace(/\/\*\* Shown under a sponsored listing when paying[^\n]*\nexport const PAYMENTS_ON[^\n]*\n/, '')
    .trim()
// Info Mode (lib/infoMode.ts) is kept the same in both apps too, and so are
// ResourceHub's tags (lib/filters/tags.ts), which the app uses to label a
// milestone's tools, and its norms and filter lists (lib/norms/taxonomy.ts,
// lib/filters/taxonomy.ts), which the Path Market's filters use.
let failed = false
for (const file of ['sponsored.ts', 'infoMode.ts', 'filters/tags.ts', 'filters/taxonomy.ts', 'norms/taxonomy.ts']) {
  const a = body(read(`servicehub-mvp/lib/${file}`))
  const b = body(read(`frontend/lib/${file}`))
  if (a !== b) {
    const al = a.split('\n')
    const bl = b.split('\n')
    const i = al.findIndex((line, n) => line !== bl[n])
    console.error(`The two ${file} files differ from line ${i + 1} of the code:\n  hub: ${al[i]}\n  app: ${bl[i]}`)
    failed = true
  } else console.log(`${file}: ok (the two copies match)`)
}
if (failed) process.exit(1)
