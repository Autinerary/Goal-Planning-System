// QR codes for the campaign short links in frontend/lib/campaign.ts, one SVG
// per link, in docs/campaign/qr/. Riipen Labs, Group 5: "connect the October
// campaign (merch, comic, research) directly to actual app sign-ups".
//
// From the repository root:
//   npm i --no-save qrcode
//   node scripts/campaign/make-qr-codes.mjs                       # the app's current address
//   node scripts/campaign/make-qr-codes.mjs https://app.example   # another address
//
// Printed codes cannot be changed, so print them for the address the app
// will keep (see docs/campaign/README.md).
import QRCode from 'qrcode'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const base = (process.argv[2] || 'https://goal-planning-app.vercel.app').replace(/\/$/, '')
const source = readFileSync('frontend/lib/campaign.ts', 'utf8')
const block = source.slice(source.indexOf('CAMPAIGN_LINKS'), source.indexOf('\n}\n', source.indexOf('CAMPAIGN_LINKS')))
const codes = [...block.matchAll(/^ {2}([a-z0-9-]+): \{/gm)].map((m) => m[1])
if (codes.length === 0) throw new Error('No links found in frontend/lib/campaign.ts')

mkdirSync('docs/campaign/qr', { recursive: true })
for (const code of codes) {
  const url = `${base}/c/${code}`
  // High error correction, so a code still scans when printed small, on
  // fabric, or partly covered. Dark on white, with the quiet zone around it.
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, color: { dark: '#000000', light: '#ffffff' } })
  writeFileSync(`docs/campaign/qr/${code}.svg`, svg)
  console.log(`docs/campaign/qr/${code}.svg  ->  ${url}`)
}
