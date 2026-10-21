// Accessibility check: the first-session pages of both apps, at desktop and
// phone widths, with axe-core's WCAG 2.1 A and AA rules and WCAG 2.2's touch
// target size (Group 36: "large touch targets"). Riipen Labs' cohort
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
// the signed-in pages (ResourceHub's too, through the app's link), and ALL=1 for every page of the app rather than the
// first session (Group 34: "text too light"). Nothing is submitted, and funnel
// events are not sent
// (Global Privacy Control is on). Exits 1 when a serious or critical problem
// is found; moderate and minor ones are listed too.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const APP = (process.env.APP || 'https://app.autinerary.ca').replace(/\/$/, '')
const HUB = (process.env.HUB || 'https://servicehub-six.vercel.app').replace(/\/$/, '')
// Chrome, with its network service in-process: see chrome.mjs.
import { chromeOptions } from './chrome.mjs'
const EMAIL = process.env.QA_EMAIL, PASSWORD = process.env.QA_PASSWORD
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 900 },
]
// Start here's pathway is opened with a link to a list (no utm_source), as
// "Send this list to yourself" makes.
const SIGNED_OUT = [
  APP + '/', APP + '/start', APP + '/start?for=self&need=services', APP + '/signup', APP + '/login',
  APP + '/privacy', APP + '/help', APP + '/forgot-password', APP + '/emails/weekly-stop', HUB + '/', HUB + '/search?q=autism',
  // Riipen Labs, Groups 20 to 24: the starter kits, a reminder's choices, ResourceHub's sign-in.
  APP + '/kits', APP + '/kits/assessment', APP + '/kits/school', APP + '/emails/setup-reminder?a=snooze3', HUB + '/login',
  // The planning note, October 2026: a search read the way it was said, with
  // "Add to my team" on each result, and the campus pages.
  HUB + '/search?ai=1&q=' + encodeURIComponent('a quiet pool for my son near Kitchener'), HUB + '/campus',
  // Goals 2 and 5: the terms, the newsletter's sign-up and Community's Choice.
  APP + '/terms', APP + '/newsletter', APP + '/community-choice',
  // Goals 6 to 11: how Autinerary is paid for, #FundAutinerary, the Spot
  // Guides program, Help us rate, and a service page with the 2D/3D map
  // switch and the claim card (a checked listing with a map point).
  APP + '/pricing', APP + '/petition', APP + '/spot-guides', HUB + '/help-us-rate', HUB + '/resources/47d371eb-1a92-4df7-b1d6-acc0e286dc29',
]
const ALL = process.env.ALL === '1'
if (ALL) SIGNED_OUT.push(HUB + '/community', HUB + '/shop')
const SIGNED_IN = (ALL
  ? ['/onboarding-confirmation', '/path', '/calendar', '/tasks', '/races', '/milestones', '/pit-stop', '/hare-world', '/reflection', '/stats',
     '/tools', '/family', '/path-market', '/ideal-self', '/paths/compare', '/gamification', '/assistant', '/reels', '/profile', '/profile/settings']
  : ['/onboarding-confirmation', '/path', '/profile', '/profile/settings']).concat(['/billing', '/free-access', '/business', '/profile/accessibility',
    // The Tidbits round: the resources for each path, before choosing one.
    '/path-market',
    // The All Apps round: personality (optional), norms with how
    // communication works, the Dream Self, suggestions free first, Family.
    '/profile/personality', '/profile/diagnostic', '/ideal-self', '/recommend-choices', '/family',
    // The Race, Milestone and Path Market round: Races and its Avoidance
    // view, the Milestone view, and one milestone with its tools and Top 5.
    '/races', '/races?newview=avoidance', '/milestones', '/milestones/milestone_g0_education_0',
    // The 3D character creator (October 2026), on its own page while the team tries it.
    '/character']).map((p) => APP + p)
// ResourceHub signed in, through the app's hand-off: its account menu and its
// profile had problems only a signed-in check could see (found 15 October
// 2026, Riipen Labs Groups 8 to 14).
// The products round: the shop, a group with its quality filters,
// suggesting a product, the cart and orders (and a product page, found once
// signed in, since products come and go).
const HUB_SIGNED_IN = (ALL
  ? ['/', '/profile', '/settings/accessibility', '/my-resources', '/notifications', '/search?ai=1&q=' + encodeURIComponent('swimming near Toronto')]
  : ['/profile', '/settings/accessibility']).concat(['/shop', '/shop?group=sensory', '/shop/new', '/shop/cart', '/orders',
    // The Tidbits round: the home page's "Help that's hard to find", Tidbits,
    // writing one, My Tidbits, the groups, a search for support for parents.
    '/', '/community', '/community/write', '/community/mine', '/community/groups', '/search?tags=parent_support']).map((p) => HUB + p)
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
  // And ResourceHub, the way people get there: the app's link signs them in.
  await page.goto(APP + '/go/servicehub?next=/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForFunction((hub) => location.href.startsWith(hub), { timeout: 30000 }, HUB).catch(() => {})
  await wait(2000)
  await page.close()
  return at
}

// The first product in the shop, by name, through the app's link (straight
// after signing in, ResourceHub can still send a direct visit to its own
// sign-in page).
async function firstProduct(context) {
  const page = await context.newPage()
  await page.evaluateOnNewDocument(quiet)
  try {
    await page.goto(APP + '/go/servicehub?next=' + encodeURIComponent('/shop?sort=name'), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction((hub) => location.href.startsWith(hub + '/shop'), { timeout: 30000 }, HUB)
    const link = 'main a[href^="/shop/"]:not([href="/shop/new"])'
    await page.waitForSelector(link, { timeout: 30000 })
    return HUB + (await page.$eval(link, (a) => a.getAttribute('href')))
  } catch {
    return null
  } finally {
    await page.close()
  }
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
      window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }))
    const problems = result.violations.map((v) => ({
      rule: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
      where: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }))
    // Where it ended up, when that isn't the page asked for (a sign-in page, say).
    const asked = new URL(url), at = new URL(page.url())
    if (at.origin + at.pathname !== asked.origin + asked.pathname) problems.landed = page.url()
    return problems
  } catch (e) {
    return [{ rule: 'page-error', impact: 'serious', help: String(e.message || e).slice(0, 160), count: 1, where: [] }]
  } finally {
    await page.close()
  }
}

const browser = await puppeteer.launch(chromeOptions())
// Signed-out pages in a fresh context first, so no sign-in leaks into them;
// then the signed-in ones in another. One context at a time: with two open,
// Chrome lost the first one's tabs after a few pages ("Session with given id
// not found", 18 October 2026).
const runs = [{ signedIn: false }]
if (EMAIL && PASSWORD) runs.push({ signedIn: true })
else console.log('QA_EMAIL and QA_PASSWORD not set: signed-out pages only.')

let serious = 0
for (const { signedIn } of runs) {
  const context = await browser.createBrowserContext()
  let pages = SIGNED_OUT
  if (signedIn) {
    console.log('signed in, landed on', await signIn(context))
    const product = await firstProduct(context)
    pages = [...SIGNED_IN, ...HUB_SIGNED_IN, ...(product ? [product] : [])]
  }
  for (const url of pages) {
    for (const viewport of VIEWPORTS) {
      const problems = await audit(context, url, viewport)
      const bad = problems.filter((p) => SERIOUS.has(p.impact))
      serious += bad.length
      console.log(`${bad.length ? 'FAIL' : problems.length ? 'note' : 'ok  '}  ${viewport.name.padEnd(7)} ${url}${problems.landed ? `  (ended on ${problems.landed})` : ''}`)
      for (const p of problems) console.log(`        ${p.impact.padEnd(8)} ${p.rule}: ${p.help} (${p.count})${p.where.length ? `  e.g. ${p.where.join(' | ')}` : ''}`)
    }
  }
  await context.close()
}
await browser.close()
console.log(serious ? `\n${serious} serious or critical problem(s).` : '\nNo serious or critical problems.')
process.exit(serious ? 1 : 0)
