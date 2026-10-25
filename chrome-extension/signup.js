// Autinerary - one-click sign-up, in the person's own browser.
//
// Autinerary (app.autinerary.ca, or ResourceHub) asks; this opens the
// service's own sign-up page in a new tab and fills it in for the person,
// page by page, with the kit in signup-kit.js (generated from
// frontend/lib/signupKit.ts by scripts/build-signup-kit.mjs). It stops at
// anything only the person can do (a robot check, a payment, a code from
// their email) and brings that tab to the front. Each new account gets its
// own strong password, made here; it goes back to the Autinerary page once,
// for the person to save, and is then forgotten.
//
// Messages from Autinerary's pages (externally_connectable):
//   { type: 'signup-ping' }                         -> { ok, version, kit, services, catalog }
//   { type: 'signup-start', service, person }       -> { jobId } | { error }
//   { type: 'signup-status', jobId }                -> { status, detail, service, password? }
//   status: running | signed_up | check_email | needs_you | exists | failed | timeout

importScripts('signup-kit.js')

const KIT = self.AutinerarySignup
const ALLOWED = [/^https:\/\/app\.autinerary\.ca$/, /^https:\/\/servicehub-six\.vercel\.app$/, /^http:\/\/localhost:(3000|3100|3101)$/]
const FINAL = new Set(['signed_up', 'check_email', 'needs_you', 'exists', 'failed', 'timeout'])
const MAX_RUN_MS = 3 * 60 * 1000
const KEEP_MS = 30 * 60 * 1000

// Jobs live in session storage: the worker can be stopped between pages, and
// nothing about the person outlives the browser session.
async function allJobs() {
  return (await chrome.storage.session.get('signupJobs')).signupJobs || {}
}
async function saveJob(job) {
  const all = await allJobs()
  all[job.id] = job
  for (const [id, j] of Object.entries(all)) if (Date.now() - j.startedAt > KEEP_MS) delete all[id]
  await chrome.storage.session.set({ signupJobs: all })
}
// A job still being filled in, or handed over to the person (it may still end well: they finish the step, the next page says so).
const open = (j) => !FINAL.has(j.status) || j.status === 'needs_you'
async function jobForTab(tabId) {
  return Object.values(await allJobs()).find((j) => j.tabId === tabId && open(j)) || null
}

// 16 random characters from 56 (no look-alikes), then one of each kind services ask for (a symbol, a digit, a small and a capital letter).
function newPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < 224 && out.length < 16) out += chars[b % 56]
    }
  }
  return `${out.slice(0, 8)}-${out.slice(8)}!7aK`
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '')
const EMAIL = /^[^@\s<>(),;:"[\]]+@[^@\s<>(),;:"[\]]+\.[^@\s<>(),;:"[\]]{2,}$/

// Runs in the service's page (an isolated world): one run per page at a time.
function runInPage(recipe, person, opts) {
  if (self.__autinerarySignupRunning) return { status: 'busy', done: opts.done || [] }
  self.__autinerarySignupRunning = true
  return self.AutinerarySignup.run(recipe, person, {
    ...opts,
    onEvent: (e) => chrome.runtime.sendMessage({ type: 'signup-event', jobId: opts.jobId, event: e }).catch(() => {}),
  }).finally(() => { self.__autinerarySignupRunning = false })
}

async function inject(job) {
  const recipe = KIT.recipes[job.service]
  if (!recipe || !open(job)) return
  // Handed over: wait for the person as long as the job is kept; otherwise a few minutes.
  if (job.status !== 'needs_you' && Date.now() - job.startedAt > MAX_RUN_MS) return finish(job, { status: 'timeout' })
  const person = { ...job.person, password: job.password || undefined }
  try {
    await chrome.scripting.executeScript({ target: { tabId: job.tabId }, files: ['signup-kit.js'] })
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: job.tabId },
      func: runInPage,
      args: [recipe, person, { done: job.done, jobId: job.id, timeoutMs: Math.max(10000, MAX_RUN_MS - (Date.now() - job.startedAt)) }],
    })
    const r = res && res.result
    if (!r || r.status === 'busy') return
    const fresh = (await allJobs())[job.id] || job
    fresh.done = [...new Set([...(fresh.done || []), ...(r.done || [])])]
    // Handed over again on a later page: no change to report.
    if (FINAL.has(r.status) && !(fresh.status === 'needs_you' && r.status === 'needs_you')) await finish(fresh, r)
    else await saveJob(fresh)
  } catch {
    // The page went to a new address mid-run (a form sent): the next load runs it again.
  }
}

async function finish(job, r) {
  job.status = r.status
  job.detail = r.detail || null
  job.endedAt = Date.now()
  // No account was made: no password to save. (Handed over, it may still be: kept.)
  if (!['signed_up', 'check_email', 'needs_you'].includes(job.status)) job.password = null
  await saveJob(job)
  // Something only they can do: show them the page.
  if (job.status === 'needs_you') {
    chrome.tabs.update(job.tabId, { active: true }).catch(() => {})
  }
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    const origin = sender.origin || (sender.url ? new URL(sender.url).origin : '')
    if (!ALLOWED.some((re) => re.test(origin))) return sendResponse({ error: 'not allowed' })
    if (msg?.type === 'signup-ping') {
      // Its services, named, so an extension newer than the app can bring new ones.
      const catalog = Object.values(KIT.recipes).map((r) => ({ key: r.key, name: r.name, kind: r.kind, hosts: r.hosts }))
      return sendResponse({ ok: true, version: chrome.runtime.getManifest().version, kit: KIT.version, services: Object.keys(KIT.recipes), catalog })
    }
    if (msg?.type === 'signup-start') {
      const recipe = KIT.recipes[msg.service]
      if (!recipe) return sendResponse({ error: 'unknown service' })
      const person = { firstName: text(msg.person?.firstName, 60), lastName: text(msg.person?.lastName, 60), email: text(msg.person?.email, 254) }
      if (!person.firstName || !EMAIL.test(person.email)) return sendResponse({ error: 'name and email needed' })
      const busy = Object.values(await allJobs()).find((j) => j.service === recipe.key && !FINAL.has(j.status))
      if (busy) return sendResponse({ jobId: busy.id })
      const tab = await chrome.tabs.create({ url: recipe.start, active: true })
      const job = {
        id: crypto.randomUUID(),
        service: recipe.key,
        origin,
        person,
        password: recipe.kind === 'account' ? newPassword() : null,
        tabId: tab.id,
        status: 'running',
        detail: null,
        done: [],
        startedAt: Date.now(),
      }
      await saveJob(job)
      // A page that finished loading before the job was saved is run now.
      const now = await chrome.tabs.get(tab.id).catch(() => null)
      if (now && now.status === 'complete') inject(job)
      return sendResponse({ jobId: job.id })
    }
    if (msg?.type === 'signup-status') {
      const job = (await allJobs())[msg.jobId]
      if (!job || job.origin !== origin) return sendResponse({ status: 'unknown' })
      if (!FINAL.has(job.status) && Date.now() - job.startedAt > MAX_RUN_MS) await finish(job, { status: 'timeout' })
      const out = { status: job.status, detail: job.detail, service: job.service }
      // The password once, to the page that asked, once the account is made; then it is forgotten.
      if (['signed_up', 'check_email'].includes(job.status) && job.password) {
        out.password = job.password
        job.password = null
        await saveJob(job)
      }
      return sendResponse(out)
    }
    sendResponse({ error: 'unknown message' })
  })()
  return true
})

// From the page being filled in: a page of the form is done (before it is sent).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'signup-event' || !msg.jobId || msg.event?.type !== 'page_done') return
  ;(async () => {
    const job = (await allJobs())[msg.jobId]
    if (!job || FINAL.has(job.status)) return
    job.done = [...new Set([...(job.done || []), msg.event.page])]
    await saveJob(job)
  })()
})

// Each page load of a sign-up tab: run the kit there.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'complete') return
  ;(async () => {
    const job = await jobForTab(tabId)
    if (job) await inject(job)
  })()
})

// The person closed the tab before it ended (after a hand-over, it stays as it was).
chrome.tabs.onRemoved.addListener((tabId) => {
  ;(async () => {
    const job = await jobForTab(tabId)
    if (job && job.status === 'running') await finish(job, { status: 'failed', detail: 'The tab was closed.' })
  })()
})
