// Accessibility check: the first-session pages of both apps, at desktop and
// phone widths, with axe-core's WCAG 2.1 A and AA rules. Riipen Labs' cohort
// report warned against treating accessibility as "a one-time checklist":
// "repeat the review as the product changes". Run this before a release that
// changes these pages. It finds what a machine can (contrast, names, labels,
// structure); it does not replace testing with people (docs/beta).
//
// Run from the repository root (needs Chrome):
//   npm i --no-save puppeteer-core axe-core
//   node scripts/qa/check-accessibility.mjs
// Optional: APP, HUB (base URLs, default production), CHROME_PATH, and
// QA_EMAIL with QA_PASSWORD (a QA account, test.account+...@test.com) to add
// the signed-in pages. Nothing is submitted, and funnel events are not sent
// (Global Privacy Control is on). Exits 1 when a serious or critical problem
// is found; moderate and minor ones are listed too.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const APP = (process.env.APP || 'https://app.autinerary.ca').replace(/\/$/, '')
const HUB = (process.env.HUB || 'https://servicehub-six.vercel.app').replace(/\/$/, '')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const EMAIL = process.env.QA_EMAIL, PASSWORD = process.env.QA_PASSWORD
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 900 },
]
// Start here's pathway is opened with a link to a list (no utm_source), as
// "Send this list to yourself" makes.
const SIGNED_OUT = [
  APP + '/', APP + '/start', APP + '/start?for=self&need=services', APP + '/signup', APP + '/login',
  APP + '/privacy', APP + '/emails/weekly-stop', HUB + '/', HUB + '/search?q=autism',
]
const SIGNED_IN = [APP + '/onboarding-confirmation', APP + '/path', APP + '/profile/settings']
const SERIOUS = new Set(['serious', 'critical'])
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const quiet = () => {
  Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })
  try {
    localStorage.setItem('autinerary_demo_seen_v1', '1')
    localStorage.setItem('autinerary_install_dismissed', '1')
    localStorage.setItem('autinerary_feedback_completed_v1', 'true')
  } catch {}
}

async function signIn(context) {
  const page = await context.newPage()
  await page.evaluateOnNewDocument(quiet)
  await page.goto(APP + '/login', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.type('input[type="email"]', EMAIL)
  await page.type('input[type="password"]', PASSWORD)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')])
  await wait(2000)
  const at = new URL(page.url()).pathname
  await page.close()
  return at
}

async function audit(context, url, viewport) {
  const page = await context.newPage()
  await page.evaluateOnNewDocument(quiet)
  await page.setViewport(viewport)
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await wait(1000)
    await page.evaluate(AXE)
    const result = await page.evaluate(() =>
      window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
    return result.violations.map((v) => ({
      rule: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
      where: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }))
  } catch (e) {
    return [{ rule: 'page-error', impact: 'serious', help: String(e.message || e).slice(0, 160), count: 1, where: [] }]
  } finally {
    await page.close()
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
// Signed-out pages in a fresh context first, so no sign-in leaks into them.
const runs = [{ context: await browser.createBrowserContext(), pages: SIGNED_OUT }]
if (EMAIL && PASSWORD) {
  const context = await browser.createBrowserContext()
  console.log('signed in, landed on', await signIn(context))
  runs.push({ context, pages: SIGNED_IN })
} else console.log('QA_EMAIL and QA_PASSWORD not set: signed-out pages only.')

let serious = 0
for (const { context, pages } of runs) for (const url of pages) {
  for (const viewport of VIEWPORTS) {
    const problems = await audit(context, url, viewport)
    const bad = problems.filter((p) => SERIOUS.has(p.impact))
    serious += bad.length
    console.log(`${bad.length ? 'FAIL' : problems.length ? 'note' : 'ok  '}  ${viewport.name.padEnd(7)} ${url}`)
    for (const p of problems) console.log(`        ${p.impact.padEnd(8)} ${p.rule}: ${p.help} (${p.count})${p.where.length ? `  e.g. ${p.where.join(' | ')}` : ''}`)
  }
}
await browser.close()
console.log(serious ? `\n${serious} serious or critical problem(s).` : '\nNo serious or critical problems.')
process.exit(serious ? 1 : 0)
