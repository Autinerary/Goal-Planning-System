// Functional check: every page of both apps, signed out and signed in, at
// desktop and phone widths. Opens menus, collects every link and checks where
// it goes (status after redirects), and flags buttons with no click handler.
// Riipen Labs, Group 3: "make sure all navigation items and links are
// functional on both desktop and mobile". First run and fixes:
// docs/reports/functional-check-2026-10-04.md
//
// Run from the repository root (needs Chrome and puppeteer-core):
//   npm i --no-save puppeteer-core
//   QA_EMAIL=... QA_PASSWORD=... node scripts/qa/check-links.mjs
// Optional: APP, HUB (base URLs, default production), CHROME_PATH.
// Use a QA account (test.account+...@test.com); nothing is submitted.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'fs'

const APP = process.env.APP || 'https://goal-planning-app.vercel.app'
const HUB = process.env.HUB || 'https://servicehub-six.vercel.app'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const EMAIL = process.env.QA_EMAIL, PASSWORD = process.env.QA_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error('Set QA_EMAIL and QA_PASSWORD (a QA account) to check signed-in pages.')
  process.exit(1)
}
const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const APP_SIGNED_OUT = ['/', '/signup', '/login', '/privacy', '/checkin']
const APP_SIGNED_IN = ['/path', '/calendar', '/tasks', '/races', '/pit-stop', '/reflection', '/profile/settings', '/family', '/path-market',
  '/ideal-self', '/paths/compare', '/stats', '/tools', '/milestones', '/gamification', '/assistant', '/reels', '/recommend-choices', '/onboarding-confirmation']
const HUB_SIGNED_OUT = ['/', '/search', '/shop', '/login', '/signup']
const HUB_SIGNED_IN = ['/', '/search', '/community', '/community/new', '/my-resources', '/notifications', '/profile', '/settings/accessibility',
  '/settings/sensory', '/shop', '/organizations', '/vouch', '/resources/new', '/onboarding']

const links = new Map()      // absolute url -> { texts:Set, pages:Set }
const deadButtons = new Map() // "page | text" -> viewports
const hashLinks = new Map()
const pageStatus = []

async function collect(page, label) {
  // Open anything that looks like a menu, so its links are in the DOM.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button[aria-label], button[aria-expanded]')) {
      const l = (b.getAttribute('aria-label') || '') + ' ' + b.textContent
      if (/menu|navigation|more/i.test(l) && b.getAttribute('aria-expanded') !== 'true') { try { b.click() } catch {} }
    }
  }).catch(() => {})
  await wait(600)
  const found = await page.evaluate(() => {
    const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const reactProps = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactProps$')); return k ? el[k] : null }
    const hasHandler = (el) => {
      for (let n = el, d = 0; n && d < 4; n = n.parentElement, d++) {
        const p = reactProps(n)
        if (p && (p.onClick || p.onMouseDown || p.onPointerDown || p.onPointerUp || p.onKeyDown || p.onTouchStart)) return true
        if (n.getAttribute && n.getAttribute('onclick')) return true
      }
      return false
    }
    const anchors = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, raw: a.getAttribute('href'), text: (a.innerText || a.getAttribute('aria-label') || a.title || '').trim().replace(/\s+/g, ' ').slice(0, 60), visible: visible(a), handler: hasHandler(a) }))
    const dead = [...document.querySelectorAll('button')].filter((b) => {
      if (b.disabled || !visible(b)) return false
      if (!reactProps(b)) return false
      if (hasHandler(b)) return false
      const type = (b.getAttribute('type') || 'submit').toLowerCase()
      if (type === 'submit' && b.closest('form')) return false
      return true
    }).map((b) => (b.innerText || b.getAttribute('aria-label') || b.title || '?').trim().replace(/\s+/g, ' ').slice(0, 60))
    return { anchors, dead }
  })
  for (const a of found.anchors) {
    if (!a.href || /^(mailto|tel|javascript):/i.test(a.href)) continue
    if (a.raw === '#' || a.raw === '') { if (!a.handler && a.visible) hashLinks.set(`${label} | ${a.text}`, a.raw); continue }
    const url = a.href.split('#')[0]
    const entry = links.get(url) || { texts: new Set(), pages: new Set() }
    entry.texts.add(a.text || '(no text)'); entry.pages.add(label)
    links.set(url, entry)
  }
  for (const t of found.dead) {
    const key = `${label.replace(/ \[(desktop|phone)\]$/, '')} | ${t}`
    const vp = (label.match(/\[(desktop|phone)\]$/) || [])[1]
    deadButtons.set(key, [...(deadButtons.get(key) || []), vp])
  }
}

async function visit(browser, base, paths, signedIn, appName) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage()
    await page.setViewport(vp)
    for (const path of paths) {
      try {
        const res = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 })
        await wait(1500)
        const finalPath = new URL(page.url()).pathname
        pageStatus.push({ app: appName, path, vp: vp.name, status: res?.status(), landed: finalPath, signedIn })
        await collect(page, `${appName} ${path} [${vp.name}]`)
      } catch (e) {
        pageStatus.push({ app: appName, path, vp: vp.name, status: 'error', landed: String(e).slice(0, 60), signedIn })
      }
    }
    await page.close()
  }
}

async function signIn(browser, base, loginPath) {
  const page = await browser.newPage()
  await page.goto(base + loginPath, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.evaluate((e, p) => {
    const set = (sel, v) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    set('input[type="email"]', e); set('input[type="password"]', p)
    const btn = [...document.querySelectorAll('button')].find((b) => /^sign ?in$/i.test(b.textContent.trim()) || b.type === 'submit')
    btn.click()
  }, EMAIL, PASSWORD)
  await wait(6000)
  const at = new URL(page.url()).pathname
  await page.close()
  return at
}

const outBrowser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const setup = async (b) => { const p = await b.newPage(); await p.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }); try { localStorage.setItem('autinerary_demo_seen_v1', '1'); localStorage.setItem('autinerary_install_dismissed', '1'); localStorage.setItem('autinerary_feedback_completed_v1', 'true') } catch {} }); await p.close() }
await setup(outBrowser)
// A resource page to include.
const sample = await (await fetch(`${HUB}/api/search?categories=library&pageSize=1`)).json().catch(() => ({}))
const resId = sample?.results?.[0]?.id
await visit(outBrowser, APP, APP_SIGNED_OUT, false, 'app')
await visit(outBrowser, HUB, [...HUB_SIGNED_OUT, ...(resId ? [`/resources/${resId}`] : [])], false, 'hub')
await outBrowser.close()

const inBrowser = await puppeteer.launch({ executablePath: CHROME, headless: true })
// Skip first-run overlays, which would cover the pages being checked.
inBrowser.on('targetcreated', async (t) => { try { const p = await t.page(); if (p) await p.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }); try { localStorage.setItem('autinerary_demo_seen_v1', '1'); localStorage.setItem('autinerary_install_dismissed', '1'); localStorage.setItem('autinerary_feedback_completed_v1', 'true') } catch {} }) } catch {} })
console.log('app sign-in landed on', await signIn(inBrowser, APP, '/login'))
await visit(inBrowser, APP, APP_SIGNED_IN, true, 'app')
console.log('hub sign-in landed on', await signIn(inBrowser, HUB, '/login'))
await visit(inBrowser, HUB, HUB_SIGNED_IN, true, 'hub')

// Check every link: our own pages in the signed-in browser (status after
// redirects), outside sites from here.
// One checker page per site: a page can only read its own site's responses.
const checkers = {}
for (const base of [APP, HUB]) {
  checkers[base] = await inBrowser.newPage()
  await checkers[base].goto(base + (base === APP ? '/privacy' : '/search'), { waitUntil: 'domcontentloaded' })
}
const results = []
for (const [url, info] of links) {
  const own = url.startsWith(APP) || url.startsWith(HUB)
  let status, final
  try {
    if (own) {
      const checker = checkers[url.startsWith(APP) ? APP : HUB]
      const r = await checker.evaluate(async (u) => { try { const res = await fetch(u, { credentials: 'include' }); return { s: res.status, f: res.url } } catch (e) { return { s: 'fetch-error', f: String(e) } } }, url)
      status = r.s; final = r.f
    } else {
      const ctl = AbortSignal.timeout(15000)
      const res = await fetch(url, { redirect: 'follow', signal: ctl, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } })
      status = res.status; final = res.url
    }
  } catch (e) { status = 'error'; final = String(e).slice(0, 80) }
  results.push({ url, status, final, texts: [...info.texts].slice(0, 3), pages: [...info.pages].slice(0, 3), own })
}
await inBrowser.close()

// A link that redirects to the other app (ResourceHub /privacy) shows as
// fetch-error here: a page cannot follow a redirect to another site. Check
// those by hand.
const broken = results.filter((r) => typeof r.status !== 'number' || r.status >= 400)
console.log(`\nPages visited: ${pageStatus.length} | unique links: ${results.length} | broken or unreachable: ${broken.length} | dead buttons: ${deadButtons.size} | '#' links with no action: ${hashLinks.size}`)
console.log('\n== Pages that did not load (status >= 400 or error)')
for (const p of pageStatus.filter((p) => typeof p.status !== 'number' || p.status >= 400)) console.log(`  ${p.app} ${p.path} [${p.vp}] ${p.signedIn ? 'signed in' : 'signed out'}: ${p.status} -> ${p.landed}`)
console.log('\n== Broken or unreachable links')
for (const r of broken) console.log(`  ${r.status}  ${r.url}\n        text: ${r.texts.join(' / ')} | on: ${r.pages.join(', ')}`)
console.log('\n== Buttons with no action')
for (const [k, v] of deadButtons) console.log(`  ${k}  [${[...new Set(v)].join(', ')}]`)
console.log('\n== "#" links with no action')
for (const [k] of hashLinks) console.log(`  ${k}`)
writeFileSync('check-links-result.json', JSON.stringify({ pageStatus, results, deadButtons: [...deadButtons], hashLinks: [...hashLinks] }, null, 2))
