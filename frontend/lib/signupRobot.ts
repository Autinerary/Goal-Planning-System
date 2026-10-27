// Server only: one-click sign-up's robot. Opens a service's sign-up page in a
// browser on the server, sends the kit in (lib/signupKit.ts, as the script in
// lib/signupKitSource.ts) and runs it, again after each full page load, until
// it ends. Only for services marked `robot` (no robot check was met on them);
// it never gets around a check, and hands over when one appears.
//
// Type-only imports, so the local tests can load it with Node's type stripping.

import type { Browser, Page } from 'puppeteer-core'
import type { ContactRequest, ContactResult, FieldRole, FormField, FoundEmail, Person, Recipe, RunResult } from './signupKit'

const NAVIGATED = /context was destroyed|navigat|detached|Target closed|Cannot find context|Execution context/i

/**
 * A page for one run, in a context of its own where Chromium can have one. The
 * serverless Chromium (@sparticuz/chromium) runs as one process
 * (--single-process), where a new context crashes it ("Protocol error
 * (Target.createTarget): Target closed", 27 October 2026); each run there has
 * a browser of its own anyway, so its default context is the run's alone.
 */
export async function openPage(browser: Browser): Promise<{ page: Page; close: () => Promise<void>; own: boolean }> {
  if (browser.process()?.spawnargs?.includes('--single-process')) {
    const page = await browser.newPage()
    return { page, own: false, close: () => page.close().catch(() => {}) }
  }
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  return { page, own: true, close: () => context.close().catch(() => {}) }
}

export async function robotSignup(
  browser: Browser,
  kitSource: string,
  recipe: Recipe,
  person: Person,
  opts: { dryRun?: boolean; timeoutMs?: number } = {},
): Promise<RunResult> {
  const { page, close } = await openPage(browser)
  const done = new Set<number>()
  try {
    await page.setViewport({ width: 1280, height: 900 })
    // Told after each page's steps, so a page load can't lose where it got to.
    await page.exposeFunction('__autinerarySignupEvent', (e: { type?: string; page?: number }) => {
      if (e?.type === 'page_done' && typeof e.page === 'number') done.add(e.page)
    })
    await page.goto(recipe.start, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const deadline = Date.now() + (opts.timeoutMs || 60000)
    while (Date.now() < deadline) {
      try {
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
        await page.evaluate(kitSource)
        const result = (await page.evaluate(
          (r, p, o) => {
            const w = window as unknown as {
              AutinerarySignup: { run: (r: unknown, p: unknown, o: unknown) => Promise<unknown> }
              __autinerarySignupEvent?: (e: unknown) => void
            }
            return w.AutinerarySignup.run(r, p, { ...(o as object), onEvent: (e: unknown) => w.__autinerarySignupEvent?.(e) })
          },
          recipe as unknown as Record<string, unknown>,
          person as unknown as Record<string, unknown>,
          { dryRun: !!opts.dryRun, done: [...done], timeoutMs: Math.max(5000, deadline - Date.now()) },
        )) as RunResult
        return result
      } catch (e) {
        // A form was sent and the page went to a new address mid-run: run again
        // there, once it is ready. (Not "wait for the next navigation": it may
        // already have happened, and that would wait for one that never comes.)
        if (!NAVIGATED.test(String((e as Error)?.message || e))) throw e
        await new Promise((r) => setTimeout(r, 300))
        await page.waitForFunction(() => document.readyState !== 'loading', { timeout: 15000 }).catch(() => {})
      }
    }
    return { status: 'timeout', url: page.url(), done: [...done] }
  } finally {
    await close()
  }
}

/**
 * A local service's request through its website's contact form, on the
 * server (lib/signupKit.ts runContactForm). Follows its Contact link, asks
 * `map` (the AI, with the form's words only) about fields it can't place, and
 * reads the page after sending. Never gets around a robot check. Unless it
 * sent, the result carries the addresses the pages it saw show (`emails`).
 */
export async function robotContact(
  browser: Browser,
  kitSource: string,
  website: string,
  request: ContactRequest,
  opts: { dryRun?: boolean; timeoutMs?: number; map?: (fields: FormField[]) => Promise<Record<string, FieldRole> | null> } = {},
): Promise<ContactResult> {
  const { page, close } = await openPage(browser)
  let sent = false
  let hops = 0
  let mapping: Record<string, FieldRole> | undefined
  const emails = new Map<string, FoundEmail>()
  const keep = (list: FoundEmail[] | undefined) => list?.forEach((e) => { if (!emails.has(e.email) || (e.mailto && !emails.get(e.email)!.mailto)) emails.set(e.email, e) })
  // The site's own answer to the form, once it's sent: the POST, or the request its script made
  // (Elementor's {"success": false, "data": {"message": "Your submission failed…"}}, Contact Form 7's
  // {"status": "mail_sent"}). A page that says nothing either way is judged by this.
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
  let sentFrom = ''
  const answers: { status: number; ownSite: boolean; ok: boolean | null; said: string | null }[] = []
  page.on('response', (res) => {
    if (!sent) return
    const req = res.request()
    if (req.method() !== 'POST' || !['xhr', 'fetch', 'document'].includes(req.resourceType())) return
    const a = { status: res.status(), ownSite: host(res.url()) === sentFrom, ok: null as boolean | null, said: null as string | null }
    answers.push(a)
    if (!/json/i.test(res.headers()['content-type'] || '')) return
    res.json().then((j: any) => {
      if (j?.success === true || j?.status === 'mail_sent' || j?.ok === true) a.ok = true
      if (j?.success === false || ['validation_failed', 'spam', 'mail_failed', 'aborted', 'acceptance_missing'].includes(j?.status) || j?.ok === false) a.ok = false
      const said = j?.data?.message || j?.message
      a.said = typeof said === 'string' ? said.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : null
    }).catch(() => {})
  })
  const judged = (r: ContactResult): ContactResult => {
    // Only when the page said nothing: its own "thank you" (or error) is the answer otherwise.
    if (r.status !== 'requested' || r.detail !== 'unconfirmed') return r
    const refused = answers.find((a) => a.ok === false || (a.ownSite && a.status >= 400))
    if (refused) return { ...r, status: 'failed', detail: refused.said ? `Their website said: ${refused.said}` : refused.status >= 400 ? `Their website refused it (${refused.status}).` : 'Their website refused it.' }
    // Not said on the page, but the site's answer was a success: confirmed.
    if (r.detail === 'unconfirmed' && answers.some((a) => a.ok === true)) return { ...r, detail: undefined }
    return r
  }
  // Unless sent: the addresses its pages show, and the AI's reading of the form (so a hand-over can use it too).
  const withEmails = (r: ContactResult): ContactResult => {
    const j = judged(r)
    return j.status === 'requested' ? j : { ...j, emails: [...emails.values()], ...(mapping ? { mapping } : {}) }
  }
  try {
    await page.setViewport({ width: 1280, height: 900 })
    await page.exposeFunction('__autineraryContactEvent', (e: { type?: string }) => { if (e?.type === 'sent') { sent = true; sentFrom = host(page.url()) } })
    await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const deadline = Date.now() + (opts.timeoutMs || 60000)
    while (Date.now() < deadline) {
      try {
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
        await page.evaluate(kitSource)
        const r = (await page.evaluate(
          (req, o) => {
            const w = window as unknown as { AutinerarySignup: { contact: (r: unknown, o: unknown) => Promise<unknown> }; __autineraryContactEvent?: (e: unknown) => void }
            return w.AutinerarySignup.contact(req, { ...(o as object), onEvent: (e: unknown) => w.__autineraryContactEvent?.(e) })
          },
          request as unknown as Record<string, unknown>,
          { dryRun: !!opts.dryRun, hops, sent, mapping, timeoutMs: Math.min(20000, Math.max(5000, deadline - Date.now())) },
        )) as ContactResult
        keep(r.emails)
        if (r.status === 'navigating') {
          hops = r.hops
          await new Promise((res) => setTimeout(res, 800))
          await page.waitForFunction(() => document.readyState !== 'loading', { timeout: 15000 }).catch(() => {})
          continue
        }
        if (r.status === 'needs_mapping') {
          const got = opts.map && !mapping ? await opts.map(r.fields || []).catch(() => null) : null
          if (!got) return withEmails({ ...r, status: 'needs_you', detail: r.detail || 'question: a question on their form' })
          mapping = got
          continue
        }
        return withEmails(r)
      } catch (e) {
        // Sent, or a link followed: the next page is where it carries on.
        if (!NAVIGATED.test(String((e as Error)?.message || e))) throw e
        await new Promise((res) => setTimeout(res, 300))
        await page.waitForFunction(() => document.readyState !== 'loading', { timeout: 15000 }).catch(() => {})
      }
    }
    return withEmails({ status: 'timeout', url: page.url(), hops })
  } finally {
    await close()
  }
}
