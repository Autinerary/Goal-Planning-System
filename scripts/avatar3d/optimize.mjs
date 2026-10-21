// Compress build.py's raw models for the web.
//
//   node optimize.mjs <build dir> <public dir>
//   (defaults: ~/autinerary-3d/build and ../../frontend/public/avatar3d)
//
// For each GLB: textures become WebP at the size they're seen at, hair,
// eyebrow and eyelash textures become grey (the page multiplies in the colour
// someone picks), and the geometry is quantised and meshopt-compressed
// (EXT_meshopt_compression, decoded in the browser by three.js's MeshoptDecoder).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { dedup, prune, quantize, meshopt, sparse } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const SRC = process.argv[2] || path.join(os.homedir(), 'autinerary-3d', 'build')
const OUT = process.argv[3] || path.join(here, '..', '..', 'frontend', 'public', 'avatar3d')
const MODE = process.env.MODE || 'meshopt' // meshopt | sparse | both, for comparing sizes
const LEVEL = process.env.LEVEL || 'high'
const FACE_NORMALS = process.env.FACE_NORMALS === '1'

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

// Largest texture side, by what the material is for (the name build.py gave it).
function plan(materialName, slot) {
  const kind = materialName.split('__')[0]
  if (kind === 'hair') return { max: 1024, grey: true }
  if (kind === 'beard') return { max: 512, grey: true }
  if (kind === 'brow') return { max: 512, grey: true }
  if (materialName === 'part__eyelashes') return { max: 256, grey: true }
  if (materialName === 'part__eyes') return { max: 512 }
  if (kind === 'part') return { max: 256 }
  if (kind === 'glasses') return { max: 512 }
  if (kind === 'outfit') return { max: slot === 'normal' ? 512 : 1024 }
  return { max: 512 }
}

// Grey, from dark strands at 0.3 to the lightest at 1.0, keeping the alpha.
// The 5th and 95th percentiles of the visible pixels set the range, so a black
// hair texture and a blond one both come out tintable to any colour.
async function grey(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const L = new Float32Array(info.width * info.height)
  const seen = []
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    L[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
    if (data[p + 3] > 128) seen.push(L[i])
  }
  seen.sort((a, b) => a - b)
  const lo = seen.length ? seen[Math.floor(seen.length * 0.05)] : 0
  const hi = seen.length ? seen[Math.floor(seen.length * 0.95)] : 255
  const span = Math.max(1, hi - lo)
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    const t = Math.min(1, Math.max(0, (L[i] - lo) / span))
    const v = Math.round(255 * (0.3 + 0.7 * t))
    data[p] = data[p + 1] = data[p + 2] = v
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
}

async function processTextures(doc) {
  doc.createExtension(EXTTextureWebP).setRequired(true)
  const done = new Set()
  for (const mat of doc.getRoot().listMaterials()) {
    const slots = [['base', mat.getBaseColorTexture()], ['normal', mat.getNormalTexture()]]
    for (const [slot, tex] of slots) {
      if (!tex || done.has(tex)) continue
      done.add(tex)
      const { max, grey: makeGrey } = plan(mat.getName(), slot)
      let img = makeGrey ? await grey(tex.getImage()) : sharp(tex.getImage())
      const meta = await sharp(tex.getImage()).metadata()
      if (Math.max(meta.width, meta.height) > max) img = img.resize(max, max, { fit: 'inside' })
      const webp = await img.webp({ quality: slot === 'normal' ? 90 : 82, alphaQuality: 90, effort: 5 }).toBuffer()
      tex.setImage(new Uint8Array(webp)).setMimeType('image/webp').setURI(`${mat.getName()}_${slot}.webp`)
    }
  }
}

// Face and expression shapes are small and local: their normals barely change,
// so only the body shapes keep morph normals. (three.js treats a target with no
// normals as leaving the normal alone.)
function dropFaceNormals(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    const names = (mesh.getExtras()?.targetNames) || []
    for (const prim of mesh.listPrimitives()) {
      prim.listTargets().forEach((t, i) => {
        const n = names[i] || ''
        if (!/^(bodyShape|build|muscle|age)_/.test(n)) {
          const a = t.getAttribute('NORMAL')
          if (a) t.setAttribute('NORMAL', null)
        }
      })
    }
  }
}

async function optimizeFile(rel) {
  const doc = await io.read(path.join(SRC, rel))
  await processTextures(doc)
  if (!FACE_NORMALS) dropFaceNormals(doc)
  await doc.transform(dedup(), prune({ keepAttributes: true, keepLeaves: true }))
  if (MODE === 'sparse' || MODE === 'both') await doc.transform(sparse({ ratio: 1 / 3 }))
  if (MODE === 'meshopt' || MODE === 'both') {
    await doc.transform(
      // _HIDE (which outfits cover each vertex) holds whole numbers: never quantised.
      quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8, pattern: /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|JOINTS_\d+|WEIGHTS_\d+|COLOR_\d+)$/ }),
      meshopt({ encoder: MeshoptEncoder, level: LEVEL }),
    )
  }
  const out = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await io.write(out, doc)
  const before = fs.statSync(path.join(SRC, rel)).size
  const after = fs.statSync(out).size
  console.log(`${rel.padEnd(28)} ${(before / 1024).toFixed(0).padStart(7)} KB -> ${(after / 1024).toFixed(0).padStart(6)} KB`)
  return after
}

// Textures the page paints and shows: WebP, alpha kept.
async function copyImages() {
  const jobs = [
    ['skin', (f) => f === 'detail.png' ? { quality: 88 } : { lossless: true }],
    ['eyes', () => ({ quality: 85, max: 512 })],
    ['icons', () => ({ lossless: true })],
    ['thumbs', () => ({ quality: 82, alphaQuality: 90 })],
  ]
  let total = 0
  for (const [dir, opts] of jobs) {
    const root = path.join(SRC, dir)
    if (!fs.existsSync(root)) continue
    for (const rel of fs.readdirSync(root, { recursive: true })) {
      const from = path.join(root, rel)
      if (fs.statSync(from).isDirectory()) continue
      const to = path.join(OUT, dir, rel)
      fs.mkdirSync(path.dirname(to), { recursive: true })
      if (!rel.endsWith('.png')) { fs.copyFileSync(from, to); total += fs.statSync(to).size; continue }
      const o = opts(path.basename(rel))
      let img = sharp(from)
      if (o.max) img = img.resize(o.max, o.max, { fit: 'inside', withoutEnlargement: true })
      const out = to.replace(/\.png$/, '.webp')
      await img.webp({ quality: o.quality || 90, alphaQuality: o.alphaQuality || 100, lossless: Boolean(o.lossless), effort: 6 }).toFile(out)
      total += fs.statSync(out).size
    }
  }
  // Published as backdrops/: the repository's .gitignore leaves out any folder called env.
  const env = path.join(SRC, 'env')
  if (fs.existsSync(env)) {
    fs.mkdirSync(path.join(OUT, 'backdrops'), { recursive: true })
    for (const f of fs.readdirSync(env)) {
      fs.copyFileSync(path.join(env, f), path.join(OUT, 'backdrops', f))
      total += fs.statSync(path.join(OUT, 'backdrops', f)).size
    }
  }
  console.log(`images ${(total / 1024 / 1024).toFixed(2)} MB`)
  return total
}

const files = []
for (const sub of ['', 'hair', 'brows', 'beard', 'outfit', 'glasses']) {
  const dir = path.join(SRC, sub)
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.glb')) files.push(path.join(sub, f))
}
let total = 0
for (const f of files.sort()) total += await optimizeFile(f)
fs.copyFileSync(path.join(SRC, 'meta.json'), path.join(OUT, 'meta.json'))
fs.copyFileSync(path.join(SRC, 'credits.json'), path.join(OUT, 'credits.json'))
total += await copyImages()
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB in ${OUT}`)
