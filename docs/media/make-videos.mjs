// Builds the explainer videos in frontend/public/media/ from videos.json:
// one slide per scene (a phone screenshot and a short title), narrated by an
// AI voice, with WebVTT captions and a poster image (Riipen Labs, Group 11;
// the rules are in docs/voice.md: captions on, calm pacing, 60-90 seconds).
//
// Needs Node 18+, puppeteer-core (installed where you run it) and Google Chrome (to draw the slides),
// ffmpeg, and an OpenAI API key (narration). Screenshots are phone-sized PNGs
// (390 x 700 at 2x) named as in videos.json; docs/first-visit-to-return.md
// says how to take them.
//
//   SHOTS=/path/to/screens FFMPEG=/path/to/ffmpeg OPENAI_API_KEY=... \
//     node docs/media/make-videos.mjs [video-id]
//
// Narration is cached by its text in $SHOTS/.voice, so changing one line
// re-records only that line.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { spawnSync } from 'child_process'
import { createHash } from 'crypto'
import path from 'path'
import { createRequire } from 'module'

// puppeteer-core is not a dependency of the app: run this from a folder where
// it is installed (npm i puppeteer-core), and it is found there.
const { default: puppeteer } = await import(createRequire(path.join(process.cwd(), 'x.js')).resolve('puppeteer-core'))

const HERE = path.dirname(new URL(import.meta.url).pathname)
const OUT = path.resolve(HERE, '../../frontend/public/media')
const SHOTS = process.env.SHOTS
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const KEY = process.env.OPENAI_API_KEY
if (!SHOTS || !KEY) throw new Error('Set SHOTS (the screenshots folder) and OPENAI_API_KEY.')

const config = JSON.parse(readFileSync(path.join(HERE, 'videos.json'), 'utf8'))
const only = process.argv[2]
const W = 1280, H = 720, FADE = 0.4, LEAD = 0.5, TAIL = 0.6
const CACHE = path.join(SHOTS, '.voice')
mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

const ff = (args) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`)
}

// Narration for one line: 24 kHz, 16-bit mono PCM from OpenAI's speech API.
async function voice(text) {
  const v = config.voice
  const id = createHash('sha1').update(JSON.stringify([v, text])).digest('hex').slice(0, 16)
  const file = path.join(CACHE, `${id}.pcm`)
  if (!existsSync(file)) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: v.model, voice: v.voice, instructions: v.instructions, input: text, response_format: 'pcm' }),
    })
    if (!res.ok) throw new Error(`speech failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  const bytes = readFileSync(file).length
  return { file, seconds: bytes / (24000 * 2) }
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
function slideHtml(scene) {
  const font = `-apple-system, 'Helvetica Neue', Arial, sans-serif`
  const shell = (inner) => `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;font-family:${font};background:linear-gradient(135deg,#eef2ff 0%,#f8fafc 55%,#ecfeff 100%);color:#0f172a;overflow:hidden">
    <div style="position:absolute;left:48px;top:32px;font-size:22px;font-weight:700">Autinerary</div>${inner}</body></html>`
  if (!scene.image) {
    return shell(`<div style="position:absolute;inset:0 120px 150px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
      <div style="font-size:64px;font-weight:800;letter-spacing:-1px">${esc(scene.title)}</div>
      ${scene.subtitle ? `<div style="margin-top:22px;font-size:32px;line-height:1.35;color:#334155;max-width:900px">${esc(scene.subtitle)}</div>` : ''}
      ${scene.note ? `<div style="margin-top:40px;font-size:20px;color:#475569">${esc(scene.note)}</div>` : ''}</div>`)
  }
  const img = readFileSync(path.join(SHOTS, `${scene.image}.png`)).toString('base64')
  const phoneH = 560, phoneW = Math.round(phoneH * 390 / 700)
  return shell(`<div style="position:absolute;left:150px;top:70px;width:${phoneW}px;height:${phoneH}px;border-radius:34px;padding:10px;background:#0f172a;box-shadow:0 24px 60px rgba(15,23,42,.25)">
      <img src="data:image/png;base64,${img}" style="width:100%;height:100%;border-radius:26px;display:block;object-fit:cover;object-position:top"></div>
    <div style="position:absolute;left:${150 + phoneW + 110}px;right:80px;top:150px;height:330px;display:flex;align-items:center">
      <div style="font-size:52px;font-weight:800;line-height:1.15;letter-spacing:-0.5px">${esc(scene.title)}</div></div>`)
}

// Captions: one or two short cues per scene, split at sentence ends.
function cues(text, start, seconds) {
  const parts = text.length <= 90 ? [text] : text.match(/[^.?!]+[.?!]+(\s|$)/g)?.map((s) => s.trim()) || [text]
  const merged = []
  for (const p of parts) {
    if (merged.length && (merged[merged.length - 1] + ' ' + p).length <= 90) merged[merged.length - 1] += ' ' + p
    else merged.push(p)
  }
  const total = merged.reduce((n, p) => n + p.length, 0)
  let t = start
  return merged.map((p) => {
    const d = seconds * (p.length / total)
    const cue = [t, t + d, p]
    t += d
    return cue
  })
}
const stamp = (s) => {
  const ms = Math.round(s * 1000)
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0')
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}`
}

// What the page shows beside each video: its length and transcript
// (frontend/lib/media.ts reads this file).
const TRANSCRIPTS = path.resolve(HERE, '../../frontend/lib/mediaTranscripts.json')
const transcripts = existsSync(TRANSCRIPTS) ? JSON.parse(readFileSync(TRANSCRIPTS, 'utf8')) : {}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
for (const video of config.videos) {
  if (only && video.id !== only) continue
  const work = path.join(SHOTS, '.build', video.id)
  mkdirSync(work, { recursive: true })
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })

  const scenes = []
  for (const [i, scene] of video.scenes.entries()) {
    await page.setContent(slideHtml(scene), { waitUntil: 'load' })
    const png = path.join(work, `slide-${i}.png`)
    await page.screenshot({ path: png })
    const said = await voice(scene.narration)
    scenes.push({ ...scene, png, said, seconds: LEAD + said.seconds + TAIL })
  }
  await page.close()

  // Audio: each scene's block is silence, the line, silence, to the scene's length.
  const blocks = scenes.map((s, i) => {
    const wav = path.join(work, `voice-${i}.wav`)
    ff(['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', s.said.file, '-af', `adelay=${Math.round(LEAD * 1000)},apad`, '-t', s.seconds.toFixed(3), '-ar', '48000', wav])
    return wav
  })
  const listFile = path.join(work, 'audio.txt')
  writeFileSync(listFile, blocks.map((b) => `file '${b}'`).join('\n'))
  const audio = path.join(work, 'voice.wav')
  ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', audio])

  // Video: still slides, cross-faded; each but the last is longer by the fade.
  const inputs = scenes.flatMap((s, i) => ['-loop', '1', '-framerate', '25', '-t', (s.seconds + (i < scenes.length - 1 ? FADE : 0)).toFixed(3), '-i', s.png])
  let graph = '', last = '[0:v]', offset = 0
  for (let i = 1; i < scenes.length; i++) {
    offset += scenes[i - 1].seconds
    graph += `${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[v${i}];`
    last = `[v${i}]`
  }
  graph += `${last}format=yuv420p[out]`
  const mp4 = path.join(OUT, `${video.id}.mp4`)
  ff([...inputs, '-i', audio, '-filter_complex', graph, '-map', '[out]', '-map', `${scenes.length}:a`,
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'stillimage', '-crf', '28', '-r', '25',
    '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-shortest', '-movflags', '+faststart', mp4])
  ff(['-i', scenes[0].png, '-q:v', '4', path.join(OUT, `${video.id}.jpg`)])

  // Captions, and the transcript the page shows beside the video.
  let t = 0
  const vtt = ['WEBVTT', '']
  for (const s of scenes) {
    for (const [a, b, text] of cues(s.narration, t + LEAD, s.said.seconds)) vtt.push(`${stamp(a)} --> ${stamp(b)}`, text, '')
    t += s.seconds
  }
  writeFileSync(path.join(OUT, `${video.id}.vtt`), vtt.join('\n'))
  transcripts[video.id] = { title: video.title, seconds: Math.round(t), transcript: scenes.map((s) => s.narration) }
  console.log(`${video.id}: ${t.toFixed(1)} s, ${scenes.length} scenes -> ${path.relative(process.cwd(), mp4)}`)
}
await browser.close()
writeFileSync(TRANSCRIPTS, JSON.stringify(transcripts, null, 2) + '\n')
