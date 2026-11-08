// The compliance checklist (November 2026; docs/compliance-2026-11.md), checked in a real browser, signed out: nothing
// counted before Allow (app and ResourceHub), the banner's two equal choices, Essential only, Cookie settings, Global
// Privacy Control, the new pages open to anyone, the footer links, the skip link, the stop links refusing bad
// signatures, and ResourceHub's redirects to the app's policies. Usage counting requests (/api/events,
// /api/me/movement) and Google Analytics are counted and BLOCKED, so nothing is written anywhere. Run it after a
// release that changes the banner, the footer, the policies or the emails' stop links.
//
// Run from the repository root (needs Chrome):
//   npm i --no-save puppeteer-core
//   node scripts/qa/check-compliance.mjs
// Optional: APP, HUB (base URLs, default production), CHROME_PATH. Exits 1 when a check fails.
import puppeteer from 'puppeteer-core'
import { chromeOptions } from './chrome.mjs'

const APP = (process.env.APP || 'https://app.autinerary.ca').replace(/\/$/, '')
const HUB = (process.env.HUB || 'https://servicehub-six.vercel.app').replace(/\/$/, '')
const COUNTING = ['autinerary_visitor_id', 'autinerary_first_touch', 'autinerary_area_days', 'autinerary_last_open_day', 'autinerary_movement']
const HUB_COUNTING = ['rh_visitor_id', 'rh_visit_at', 'rh_visit_day', 'rh_first_resource_at']
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let passed = 0, failed = 0
const check = (name, ok, detail = '') => {
  ok ? passed++ : failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}

const browser = await puppeteer.launch(chromeOptions())

/** A fresh, signed-out browser whose counting requests are counted and blocked. */
async function fresh({ gpc = false } = {}) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  if (gpc) await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }))
  const sent = { events: 0, movement: 0, ga: 0 }
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/api/events')) { sent.events++; return req.abort() }
    if (url.includes('/api/me/movement') && req.method() === 'POST') { sent.movement++; return req.abort() }
    if (/googletagmanager\.com|google-analytics\.com/.test(url)) { sent.ga++; return req.abort() }
    req.continue()
  })
  return { ctx, page, sent }
}
const keys = (page) => page.evaluate(() => Object.keys(localStorage))
const cookies = async (page) => (await (await page.target().createCDPSession()).send('Network.getAllCookies')).cookies.map((c) => c.name)
const go = async (page, url) => { await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}); await wait(1500) }
// offsetParent is always null for a fixed element like the banner, so look at its box instead.
const bannerShown = (page) => page.$eval('[data-cookie-consent]', (el) => {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el)
  return r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'
}).catch(() => false)
const clickText = (page, text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && x.offsetParent !== null)
  if (b) b.click()
  return !!b
}, text)

try {
  // 1. The app, first visit: asked, nothing counted, nothing sent.
  {
    const { ctx, page, sent } = await fresh()
    await go(page, APP + '/')
    check('app: the cookie question shows on a first visit', await bannerShown(page))
    await go(page, APP + '/start'); await go(page, APP + '/help')
    const k = await keys(page)
    check('app: no counting kept before an answer (three pages)', !k.some((x) => COUNTING.includes(x)), k)
    check('app: no usage counts sent before an answer', sent.events === 0 && sent.movement === 0, sent)
    check('app: Google Analytics not loaded before an answer', sent.ga === 0, sent)
    check('app: no _ga cookie', !(await cookies(page)).some((c) => c.startsWith('_ga')))

    // The two choices look the same (no nudge).
    const looks = await page.evaluate(() => {
      const find = (t) => [...document.querySelectorAll('[data-cookie-consent] button')].find((b) => b.textContent.trim() === t)
      const a = find('Essential only'), b = find('Allow counting')
      return a && b ? [a.className, b.className] : null
    })
    check('app: "Essential only" and "Allow counting" look the same', !!looks && looks[0] === looks[1], looks)

    // Essential only: nothing counted, and the question goes away.
    await clickText(page, 'Essential only'); await wait(500)
    check('app: Essential only closes the question', !(await bannerShown(page)))
    await go(page, APP + '/start'); await go(page, APP + '/help')
    const k2 = await keys(page)
    check('app: after Essential only, still nothing counted or sent', !k2.some((x) => COUNTING.includes(x)) && sent.events === 0 && sent.movement === 0, { k2, sent })
    check('app: the answer is kept as no', (await page.evaluate(() => localStorage.getItem('autinerary_cookie_consent'))) === 'no')

    // Cookie settings (the footer) asks again; Allow counts.
    const reopened = await clickText(page, 'Cookie settings'); await wait(500)
    check('app: "Cookie settings" in the footer asks again', reopened && (await bannerShown(page)))
    await clickText(page, 'Allow counting'); await wait(500)
    await go(page, APP + '/start'); await go(page, APP + '/help')
    const k3 = await keys(page)
    check('app: after Allow, this browser is counted', k3.includes('autinerary_visitor_id') && sent.events > 0, { k3, sent })

    // Saying no again removes what counting kept.
    await clickText(page, 'Cookie settings'); await wait(300); await clickText(page, 'Essential only'); await wait(500)
    const k4 = await keys(page)
    check('app: saying no later removes what counting kept', !k4.some((x) => COUNTING.includes(x)), k4)
    await ctx.close()
  }

  // 2. Global Privacy Control is a no, whatever is pressed.
  {
    const { ctx, page, sent } = await fresh({ gpc: true })
    await go(page, APP + '/')
    await clickText(page, 'Allow counting'); await wait(500)
    await go(page, APP + '/start'); await go(page, APP + '/help')
    const k = await keys(page)
    check('app: with Global Privacy Control, Allow still counts nothing', !k.some((x) => COUNTING.includes(x)) && sent.events === 0, { k, sent })
    await ctx.close()
  }

  // 3. ResourceHub, first visit.
  {
    const { ctx, page, sent } = await fresh()
    await go(page, HUB + '/')
    check('ResourceHub: the cookie question shows on a first visit', await bannerShown(page))
    // Only real people's ratings count (STEP 99), and few services have enough yet: a "Highest Ratings" heading is
    // shown only over services, never over nothing.
    const rated = await page.evaluate(() => [...document.querySelectorAll('h2')].filter((h) => /^Highest Ratings/.test(h.textContent.trim())).map((h) => {
      const box = h.closest('section')
      return { heading: h.textContent.trim(), cards: box ? new Set([...box.querySelectorAll('a[href^="/resources/"]')].map((a) => a.getAttribute('href'))).size : 0 }
    }))
    check('ResourceHub: no "Highest Ratings" heading over an empty list', rated.every((r) => r.cards > 0), rated)
    await go(page, HUB + '/search?q=autism')
    const k = await keys(page)
    check('ResourceHub: no visit counting kept before an answer', !k.some((x) => HUB_COUNTING.includes(x)), k)
    await clickText(page, 'Essential only'); await wait(500)
    await go(page, HUB + '/'); await go(page, HUB + '/search?q=swimming')
    const k2 = await keys(page)
    check('ResourceHub: after Essential only, still nothing', !k2.some((x) => HUB_COUNTING.includes(x)) && !(await bannerShown(page)), k2)
    const links = await page.evaluate(() => [...document.querySelectorAll('footer a')].map((a) => a.textContent.trim()))
    check('ResourceHub: the footer links the policies', ['About', 'Cookies', 'Refunds', 'Delete my data', 'Credits'].every((t) => links.some((l) => l.includes(t))), links)
    check('ResourceHub: no usage counts sent', sent.events === 0, sent)
    await ctx.close()
  }

  // 4. The new pages, for anyone, with the footer on each.
  {
    const { ctx, page } = await fresh()
    const pages = { '/about': 'About', '/cookies': 'Cookies', '/refunds': 'Refunds', '/delete-my-data': 'Delete my data', '/credits': 'Credits', '/emails/stop?k=reminders': 'Stop daily reminders' }
    for (const [path, heading] of Object.entries(pages)) {
      await go(page, APP + path)
      const at = new URL(page.url()).pathname
      const h1 = await page.$eval('h1', (h) => h.textContent.trim()).catch(() => '')
      check(`page ${path}: opens signed out`, at === path.split('?')[0] && h1.includes(heading), { at, h1 })
    }
    await go(page, APP + '/about')
    const about = await page.evaluate(() => document.body.innerText)
    check('/about: the business, its province and country', about.includes('Autinerary Corp.') && about.includes('Ontario') && about.includes('Canada'))
    check('/about: a mailing address (not "On request")', !/Mailing address\s*On request/i.test(about), 'NEWSLETTER_POSTAL_ADDRESS is not set where this was built')
    const footer = await page.evaluate(() => [...document.querySelectorAll('footer a, footer button')].map((a) => a.textContent.trim()))
    check('app: the footer links every policy, and Cookie settings', ['About and contact', 'Privacy', 'Terms', 'Cookies', 'Refunds', 'Delete my data', 'Credits and licences', 'Cookie settings'].every((t) => footer.includes(t)), footer)

    // The skip link: the first thing Tab reaches, and it moves to the page.
    await go(page, APP + '/privacy')
    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute('href') }))
    check('skip link: the first thing Tab reaches', first.text === 'Skip to main content' && first.href === '#main-content', first)
    await page.keyboard.press('Enter'); await wait(300)
    const landed = await page.evaluate(() => document.activeElement?.id || location.hash)
    check('skip link: Enter moves to the page', landed === 'main-content' || landed === '#main-content', landed)
    await ctx.close()
  }

  // 5. Stop links refuse bad signatures, and opening one only opens its page (nothing is stopped by opening a link).
  // From inside the browser: the live app is behind Vercel's bot checkpoint, which a plain request from Node doesn't pass.
  {
    const { ctx, page } = await fresh()
    await go(page, APP + '/about')
    const u = '11111111-2222-3333-4444-555555555555'
    const status = (url, init) => page.evaluate(async (url, init) => (await fetch(url, init)).status, url, init)
    check('one-click stop: a bad signature is refused', (await status(`/api/emails/stop?k=reminders&u=${u}&t=bad`, { method: 'POST', body: 'List-Unsubscribe=One-Click' })) === 400)
    check('one-click stop: an unknown kind is refused', (await status(`/api/emails/stop?k=everything&u=${u}&t=bad`, { method: 'POST' })) === 400)
    check('check-in one-click stop: a bad token is refused', (await status('/api/checkin/stop?t=bad', { method: 'POST', body: 'List-Unsubscribe=One-Click' })) === 400)
    await go(page, `${APP}/api/emails/stop?k=reminders&u=${u}&t=bad`)
    const at = new URL(page.url())
    const button = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Stop these emails'))
    check('opening a stop link shows its page with the button, and stops nothing', at.pathname === '/emails/stop' && at.searchParams.get('k') === 'reminders' && button, at.href)

    // 6. ResourceHub's policy and sign-up pages are the app's: where its redirect points (a local ResourceHub may point
    // at an app address that isn't running).
    for (const path of ['/privacy', '/terms', '/cookies', '/refunds', '/about', '/delete-my-data', '/credits', '/signup']) {
      let to = null
      const seen = (r) => { if (r.url() === HUB + path && r.status() >= 300 && r.status() < 400) to = r.headers().location || null }
      page.on('response', seen)
      const res = await page.goto(HUB + path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null)
      page.off('response', seen)
      to ||= res?.request().redirectChain()[0]?.response()?.headers().location || null
      const landed = new URL(page.url())
      const ok = (landed.host === new URL(APP).host && landed.pathname === path) || (!!to && !to.startsWith(HUB) && new URL(to, HUB).pathname === path)
      check(`ResourceHub ${path} goes to the app's`, ok, { to, landed: landed.href })
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed ? 1 : 0)
