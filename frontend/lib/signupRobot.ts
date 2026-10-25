// Server only: one-click sign-up's robot. Opens a service's sign-up page in a
// browser on the server, sends the kit in (lib/signupKit.ts, as the script in
// lib/signupKitSource.ts) and runs it, again after each full page load, until
// it ends. Only for services marked `robot` (no robot check was met on them);
// it never gets around a check, and hands over when one appears.
//
// Type-only imports, so the local tests can load it with Node's type stripping.

import type { Browser } from 'puppeteer-core'
import type { Person, Recipe, RunResult } from './signupKit'

const NAVIGATED = /context was destroyed|navigat|detached|Target closed|Cannot find context|Execution context/i

export async function robotSignup(
  browser: Browser,
  kitSource: string,
  recipe: Recipe,
  person: Person,
  opts: { dryRun?: boolean; timeoutMs?: number } = {},
): Promise<RunResult> {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
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
    await context.close().catch(() => {})
  }
}
