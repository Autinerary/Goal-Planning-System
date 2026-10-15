// The home page's four screenshots ("A look inside", frontend/public/preview/),
// retaken whenever those screens change (docs/first-visit-to-return.md).
//
// First, in the app, sign up a test account (test.account+...@test.com) with
// the name Sam, choose "Myself" and the goal "Learn a new language" in setup,
// and let the plan be made. Then, from the repository root (needs Chrome):
//   npm i --no-save puppeteer-core
//   QA_EMAIL=... QA_PASSWORD=... node scripts/qa/preview-shots.mjs
// Optional: APP and HUB (base URLs, default production), CHROME_PATH.
//
// Each is a phone-sized window (390 by 650) saved as a 600 by 1000 JPEG: the
// Path, its first step, the calendar on Low Energy, and ResourceHub's home
// page signed out. Cards that are not part of the screen (the install banner,
// the tour, check-ins, the checklist) are put away in this browser only, and
// usage events are not sent. Then update each description in PREVIEW
// (frontend/app/page.tsx).
import puppeteer from 'puppeteer-core'
import path from 'path'
import { chromeOptions } from './chrome.mjs'

const APP = (process.env.APP || 'https://app.autinerary.ca').replace(/\/$/, '')
const HUB = (process.env.HUB || 'https://servicehub-six.vercel.app').replace(/\/$/, '')
const EMAIL = process.env.QA_EMAIL, PASSWORD = process.env.QA_PASSWORD
if (!EMAIL || !PASSWORD) throw new Error('Set QA_EMAIL and QA_PASSWORD (the account with the sample plan).')
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../frontend/public/preview')
// 390 by 650 on screen, drawn at 600 by 1000.
const VIEWPORT = { width: 390, height: 650, isMobile: true, hasTouch: true, deviceScaleFactor: 600 / 390 }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch(chromeOptions())
async function fresh() {
  const page = await (await browser.createBrowserContext()).newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['autinerary_demo_seen_v1', 'autinerary_install_dismissed', 'autinerary_starter_checklist_hidden']) localStorage.setItem(k, '1')
      localStorage.setItem('autinerary_feedback_completed_v1', 'true')
    } catch {}
  })
  await page.setRequestInterception(true)
  page.on('request', (r) => (/\/api\/(events|checkin)/.test(r.url()) ? r.respond({ status: 204, body: '' }) : r.continue()))
  await page.setViewport(VIEWPORT)
  return page
}
// Scrolls so `el` sits `gap` pixels below the top bar, which stays on screen.
const scrollBelowBar = (page, selector, gap) => page.evaluate((sel, g) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : null
  const target = el || [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Low Energy'))
  const bar = document.querySelector('nav')?.getBoundingClientRect().height || 0
  if (target) window.scrollTo(0, target.getBoundingClientRect().top + scrollY - bar - g)
}, selector, gap)
const shoot = async (page, name) => { await wait(800); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 85 }); console.log('saved', `${name}.jpg`) }

try {
  const page = await fresh()
  await page.goto(APP + '/login', { waitUntil: 'networkidle2' })
  await page.type('#login-email', EMAIL)
  await page.type('#login-password', PASSWORD)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.keyboard.press('Enter')])
  await page.goto(APP + '/path', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('section[aria-labelledby="next-step-heading"] a[href^="/milestones/"]', { timeout: 30000 })
  await wait(2000)
  await shoot(page, 'path')

  // The first step, from its title down.
  const step = await page.evaluate(() => document.querySelector('section[aria-labelledby="next-step-heading"] a[href^="/milestones/"]').getAttribute('href'))
  await page.goto(APP + step, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1', { timeout: 30000 })
  await wait(3000)
  await scrollBelowBar(page, 'h1', 56)
  await shoot(page, 'step')

  // The calendar on Low Energy, from the energy buttons down.
  await page.goto(APP + '/calendar', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Low Energy')), { timeout: 30000 })
  await wait(2000)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Low Energy')).click())
  await wait(2000)
  await scrollBelowBar(page, null, 10)
  await shoot(page, 'calendar')

  // ResourceHub as a visitor sees it, signed out.
  const hub = await fresh()
  await hub.goto(HUB + '/', { waitUntil: 'networkidle2' })
  await wait(1500)
  await shoot(hub, 'resourcehub')
} finally {
  await browser.close()
}
