const { BrowserWindow, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

/**
 * One-click sign-up in the desktop app. The web app (in the main window)
 * asks through app-preload.js; this opens the service's own sign-up page in
 * a window of its own and fills it in with the kit (signup-kit.js, generated
 * from frontend/lib/signupKit.ts), running it again after each page load. It
 * stops at anything only the person can do (a robot check, a payment, a code
 * from their email) and leaves that window in front of them.
 */

const KIT_SOURCE = fs.readFileSync(path.join(__dirname, 'signup-kit.js'), 'utf8')
const kit = (() => {
  const g = {}
  new Function('self', KIT_SOURCE)(g)
  return g.AutinerarySignup
})()
const FINAL = new Set(['signed_up', 'check_email', 'needs_you', 'exists', 'failed', 'timeout'])
const MAX_RUN_MS = 3 * 60 * 1000
const EMAIL = /^[^@\s<>(),;:"[\]]+@[^@\s<>(),;:"[\]]+\.[^@\s<>(),;:"[\]]{2,}$/

function newPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const out = Array.from({ length: 16 }, () => chars[crypto.randomInt(chars.length)]).join('')
  return `${out.slice(0, 8)}-${out.slice(8)}!7aK`
}

// Jobs by the sign-up window's webContents id.
const jobs = new Map()

function run(job) {
  if (job.win.isDestroyed()) return
  const wc = job.win.webContents
  const code = `${KIT_SOURCE}
;(() => {
  if (window.__autinerarySignupRunning) return { status: 'busy' }
  window.__autinerarySignupRunning = true
  return window.AutinerarySignup.run(${JSON.stringify(job.recipe)}, ${JSON.stringify(job.person)}, {
    done: ${JSON.stringify([...job.done])},
    timeoutMs: ${Math.max(10000, MAX_RUN_MS - (Date.now() - job.startedAt))},
    onEvent: (e) => window.__autinerarySignupEvent && window.__autinerarySignupEvent(e),
  }).finally(() => { window.__autinerarySignupRunning = false })
})()`
  wc.executeJavaScript(code, true)
    .then((r) => {
      if (!r || r.status === 'busy') return
      for (const p of r.done || []) job.done.add(p)
      if (!FINAL.has(r.status)) return
      // Handed over, then the person finished the step: tell the app how it ended.
      if (job.result && job.result.status === 'needs_you') {
        if (r.status !== 'needs_you') later(job, r)
        return
      }
      end(job, r)
    })
    .catch(() => {
      // The page went to a new address mid-run (a form sent): the next load runs it again.
    })
}

function end(job, r) {
  if (job.result) return
  job.result = { status: r.status, detail: r.detail || null }
  clearTimeout(job.timer)
  if (job.result.status === 'needs_you') {
    // Something only they can do: the window stays, in front.
    if (!job.win.isDestroyed()) {
      job.win.show()
      job.win.focus()
    }
  } else if (!job.win.isDestroyed()) {
    setTimeout(() => !job.win.isDestroyed() && job.win.close(), 1500)
  }
  const ok = job.result.status === 'signed_up' || job.result.status === 'check_email'
  job.resolve({ ...job.result, ...(ok && job.person.password ? { password: job.person.password } : {}) })
}

// After a hand-over, the sign-up's real end, sent to the app (app-preload.js: onSignupUpdate).
let sendUpdate = () => {}
function later(job, r) {
  const ok = r.status === 'signed_up' || r.status === 'check_email'
  job.result = { status: r.status, detail: r.detail || null }
  sendUpdate({ service: job.recipe.key, status: r.status, detail: r.detail || null, ...(ok && job.person.password ? { password: job.person.password } : {}) })
  if (!job.win.isDestroyed()) setTimeout(() => !job.win.isDestroyed() && job.win.close(), 1500)
}

function register({ appUrl, getMainWindow }) {
  sendUpdate = (update) => {
    const main = getMainWindow()
    if (main && !main.isDestroyed()) main.webContents.send('signup:update', update)
  }
  const appOrigin = new URL(appUrl).origin
  // Only the Autinerary app itself may ask.
  const fromApp = (event) => {
    try {
      return new URL(event.senderFrame.url).origin === appOrigin
    } catch {
      return false
    }
  }

  ipcMain.handle('signup:info', (event) =>
    fromApp(event)
      ? {
          ok: true,
          version: require('./package.json').version,
          kit: kit.version,
          services: Object.keys(kit.recipes),
          catalog: Object.values(kit.recipes).map((r) => ({ key: r.key, name: r.name, kind: r.kind, hosts: r.hosts })),
        }
      : null,
  )

  ipcMain.handle('signup:start', (event, { service, person }) => {
    if (!fromApp(event)) return { status: 'failed', detail: 'not allowed' }
    const recipe = kit.recipes[service]
    if (!recipe) return { status: 'failed', detail: 'unknown service' }
    const p = { firstName: String(person.firstName).trim().slice(0, 60), lastName: String(person.lastName).trim().slice(0, 60), email: String(person.email).trim().slice(0, 254) }
    if (!p.firstName || !EMAIL.test(p.email)) return { status: 'failed', detail: 'name and email needed' }
    if (recipe.kind === 'account') p.password = newPassword()

    return new Promise((resolve) => {
      const win = new BrowserWindow({
        width: 1000,
        height: 780,
        // Tests run it out of sight; people see it, so nothing happens behind their back.
        show: process.env.AUTINERARY_SIGNUP_TEST !== '1',
        parent: getMainWindow() || undefined,
        title: `Signing you up for ${recipe.name}`,
        webPreferences: {
          preload: path.join(__dirname, 'signup-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          // Its own cookies: the service's site never sees Autinerary's.
          partition: 'persist:signups',
        },
      })
      const job = { win, recipe, person: p, done: new Set(), startedAt: Date.now(), resolve, result: null, timer: null }
      // Kept now: a closed window's webContents can't be read any more (it throws, and
      // in the main process that stops everything behind an error dialog).
      const wcId = win.webContents.id
      jobs.set(wcId, job)
      job.timer = setTimeout(() => end(job, { status: 'timeout' }), MAX_RUN_MS)
      // Popups from the service open in the real browser.
      win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
      })
      win.webContents.on('did-finish-load', () => run(job))
      win.on('closed', () => {
        jobs.delete(wcId)
        // Closed after a hand-over: it stays as it was.
        if (!job.result) end(job, { status: 'failed', detail: 'The window was closed.' })
      })
      win.loadURL(recipe.start)
    })
  })

  ipcMain.on('signup:event', (event, { page }) => {
    const job = jobs.get(event.sender.id)
    if (job && Number.isInteger(page)) job.done.add(page)
  })
}

module.exports = { register, kit }
