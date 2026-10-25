// Packages the Autinerary extension (chrome-extension/) for the Chrome Web
// Store: the same files without the manifest's "key" (the store gives the
// extension its own ID; set it as NEXT_PUBLIC_SIGNUP_EXTENSION_ID afterwards),
// without Chrome's own caches, after checking the sign-up kit copy is current.
//   node --experimental-strip-types scripts/package-extension.mjs
//   → chrome-extension/dist/autinerary-<version>.zip
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'chrome-extension')
execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/build-signup-kit.mjs'), '--check'], { stdio: 'inherit' })

const manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'))
delete manifest.key
// The store package talks to the real Autinerary only, never a developer's localhost.
manifest.externally_connectable = { matches: manifest.externally_connectable.matches.filter((m) => !m.startsWith('http://localhost')) }

const stage = mkdtempSync(join(tmpdir(), 'autinerary-ext-'))
cpSync(src, stage, { recursive: true, filter: (p) => !/(\/_metadata|\/dist|\.DS_Store)(\/|$)/.test(p) })
writeFileSync(join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
const outDir = join(src, 'dist')
if (!existsSync(outDir)) mkdirSync(outDir)
const out = join(outDir, `autinerary-${manifest.version}.zip`)
rmSync(out, { force: true })
execFileSync('zip', ['-r', '-X', out, '.'], { cwd: stage, stdio: 'ignore' })
rmSync(stage, { recursive: true, force: true })
console.log(`wrote ${out.replace(root, '')} (version ${manifest.version}; no key; ${manifest.externally_connectable.matches.length} Autinerary addresses)`)
