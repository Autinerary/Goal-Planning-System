/**
 * One-click sign-up's kit (the ask, October 2026: "a button that I click on
 * and I sign up for the service, bypassing filling in the form on their
 * site"). For each service, the steps of its own sign-up form, written by
 * hand from its real pages (walked through with test accounts, 25 October
 * 2026), and one runner that fills them in for the person.
 *
 * The runner works inside the service's page wherever that page is open:
 *   - the Autinerary extension, in the person's own browser;
 *   - the Autinerary desktop and phone apps, in a window of their own;
 *   - the server robot (lib/signupRobot.ts), only for services marked
 *     `robot`, where no robot check was met.
 * It never gets around a robot check ("I'm not a robot", Cloudflare and the
 * like): it stops there and hands over to the person (needs_you). It never
 * ticks a marketing box. It ticks a service's terms box only because the
 * person pressed Sign me up after being shown that service's terms.
 *
 * Plain data and one self-contained function, no imports:
 * scripts/build-signup-kit.mjs copies them into chrome-extension/,
 * desktop/ and mobile/, and lib/signupKit.test.mjs checks them.
 */

export const KIT_VERSION = '2026-10-25.5'

/** Where an element is: CSS, the nth visible match, a label, or a button's words (regexes as strings). */
export type Target = string | { css?: string; index?: number; label?: string; text?: string }

export type Field = 'email' | 'password' | 'firstName' | 'lastName' | 'fullName'

export type Step =
  | { fill: Target; with: Field }
  | { tick: Target }
  | { click: Target; submit?: boolean }

/** A page of the flow: which page it is (URL and/or an element on it), and what to do there. */
export interface Page {
  when: { url?: string; selector?: string }
  steps: Step[]
}

/** How to tell where the flow ended: the page's address, an element, or words on it. */
export interface Detector {
  url?: string
  selector?: string
  text?: string
}

export type Outcome = 'signed_up' | 'check_email' | 'needs_you' | 'exists' | 'failed'

export interface Recipe {
  key: string
  name: string
  /** An account on the service, or its email newsletter. */
  kind: 'account' | 'newsletter'
  /** Addresses that are this service (a plan's tool or a listing is matched by its web address). */
  hosts: string[]
  start: string
  terms?: string
  privacy?: string
  /** The youngest the service takes (its terms); Autinerary's own accounts are 18+. */
  minAge?: number
  /** The server robot may run it: no robot check was met. */
  robot: boolean
  pages: Page[]
  done: Partial<Record<Outcome, Detector[]>>
  /** What the person should know, shown before they press Sign me up. */
  note?: string
}

export interface Person {
  email: string
  password?: string
  firstName: string
  lastName: string
}

export const RECIPES: Record<string, Recipe> = {
  focusmate: {
    key: 'focusmate',
    name: 'Focusmate',
    kind: 'account',
    hosts: ['focusmate.com'],
    start: 'https://app.focusmate.com/signup',
    terms: 'https://www.focusmate.com/terms',
    privacy: 'https://www.focusmate.com/privacy',
    minAge: 17,
    robot: true,
    pages: [
      {
        when: { url: 'focusmate\\.com/signup(/method)?([?#]|$)', selector: 'input[type=password]' },
        steps: [
          { fill: { css: 'input[type=text]', index: 0 }, with: 'email' },
          { fill: 'input[type=password]', with: 'password' },
          { click: { text: '^Sign up with email$' }, submit: true },
        ],
      },
      {
        when: { url: 'focusmate\\.com/signup/profile' },
        steps: [
          { fill: { css: 'input[type=text]', index: 0 }, with: 'firstName' },
          { fill: { css: 'input[type=text]', index: 1 }, with: 'lastName' },
          // "I confirm that: I am at least 17 years old; I accept Focusmate's Terms and Privacy Policy."
          { tick: 'label.checkbox-container' },
          { click: { text: '^Complete sign up$' }, submit: true },
        ],
      },
    ],
    done: {
      check_email: [{ url: 'focusmate\\.com/signup/verify' }, { text: 'sent a verification email' }],
      exists: [{ text: 'already (in use|registered|exists|taken)|account (already )?exists' }],
      signed_up: [{ url: 'app\\.focusmate\\.com/(dashboard|sessions|schedule)' }],
    },
  },

  headspace: {
    key: 'headspace',
    name: 'Headspace',
    kind: 'account',
    hosts: ['headspace.com'],
    start: 'https://www.headspace.com/register',
    terms: 'https://www.headspace.com/terms-and-conditions',
    privacy: 'https://www.headspace.com/privacy-policy',
    robot: true,
    note: 'A free account. Headspace offers a paid plan afterwards; nothing is bought for you.',
    pages: [
      {
        when: { url: 'auth\\.headspace\\.com/u/signup/identifier', selector: 'input[name=email]' },
        steps: [
          { fill: 'input[name=email]', with: 'email' },
          // The terms box only; never "send me marketing emails".
          { tick: 'input[data-testid=legal-checkbox]' },
          { click: 'button[type=submit][data-testid=button]', submit: true },
        ],
      },
      {
        when: { url: 'auth\\.headspace\\.com/u/signup/password', selector: 'input[name=password]' },
        steps: [
          { fill: 'input[name=given_name]', with: 'firstName' },
          { fill: 'input[name=family_name]', with: 'lastName' },
          { fill: 'input[name=password]', with: 'password' },
          { click: 'button[type=submit][data-testid=button]', submit: true },
        ],
      },
    ],
    done: {
      // Not "Already have an account? Log in": that is on every sign-up page.
      exists: [{ text: 'user already exists|already (exists|in use|registered)' }, { url: 'auth\\.headspace\\.com/u/login' }],
      signed_up: [{ url: '^https://my\\.headspace\\.com' }],
    },
  },

  speechify: {
    key: 'speechify',
    name: 'Speechify',
    kind: 'account',
    hosts: ['speechify.com'],
    start: 'https://app.speechify.com/auth?mode=sign-up',
    terms: 'https://speechify.com/terms/',
    privacy: 'https://speechify.com/privacy/',
    robot: true,
    note: 'A free account. Speechify offers a paid plan afterwards; nothing is bought for you.',
    pages: [
      {
        when: { url: 'app\\.speechify\\.com/auth', selector: 'input[data-testid=auth-page-form-email]' },
        steps: [
          { fill: 'input[data-testid=auth-page-form-email]', with: 'email' },
          { fill: 'input[data-testid=auth-page-form-password]', with: 'password' },
          { click: 'button[data-testid=auth-page-form-submit]', submit: true },
        ],
      },
    ],
    done: {
      exists: [{ text: 'already (exists|in use|registered)|email.{0,30}taken' }],
      signed_up: [{ selector: '[data-testid=sidebar-profile-trigger]' }],
    },
  },

  chadd: {
    key: 'chadd',
    name: 'CHADD’s newsletter',
    kind: 'newsletter',
    hosts: ['chadd.org'],
    start: 'https://chadd.org/',
    privacy: 'https://chadd.org/privacy-policy/',
    robot: true,
    pages: [
      {
        when: { url: 'chadd\\.org', selector: '#mce-EMAIL' },
        steps: [
          // Mailchimp's form; its hidden "b_…" field is a trap for robots and stays empty.
          { fill: '#mce-EMAIL', with: 'email' },
          { fill: '#mce-FNAME', with: 'firstName' },
          { fill: '#mce-LNAME', with: 'lastName' },
          { click: '#mc-embedded-subscribe', submit: true },
        ],
      },
    ],
    done: {
      // "You're already subscribed, your profile has been updated."
      exists: [{ text: 'already subscribed' }],
      signed_up: [{ text: 'Thank you for subscribing' }],
    },
  },

  todoist: {
    key: 'todoist',
    name: 'Todoist',
    kind: 'account',
    hosts: ['todoist.com'],
    start: 'https://app.todoist.com/auth/signup',
    terms: 'https://doist.com/terms-of-service',
    privacy: 'https://doist.com/privacy',
    // Cloudflare checks every sign-up: in a person's own browser it usually
    // passes by itself; a robot is refused.
    robot: false,
    pages: [
      {
        when: { url: 'todoist\\.com/auth/signup', selector: 'input[type=email]' },
        steps: [
          { fill: 'input[type=email]', with: 'email' },
          { fill: 'input[type=password]', with: 'password' },
          { click: 'button[type=submit]', submit: true },
        ],
      },
    ],
    done: {
      needs_you: [{ text: 'Captcha verification failed' }],
      exists: [{ text: 'already (associated|registered|in use|exists)' }],
      signed_up: [{ url: 'todoist\\.com/(app|onboarding)' }],
    },
  },

  notion: {
    key: 'notion',
    name: 'Notion',
    kind: 'account',
    hosts: ['notion.so', 'notion.com'],
    start: 'https://www.notion.so/signup',
    terms: 'https://www.notion.so/notion/Terms-and-Privacy-28ffdd083dc3473e9c2da6ec011b58ac',
    privacy: 'https://www.notion.so/notion/Privacy-Policy-3468d120cf614d4c9014c09f6adc9091',
    // Notion refuses automated browsers, and emails a code to type in.
    robot: false,
    note: 'Notion emails you a code to finish signing up.',
    pages: [
      {
        when: { url: 'notion\\.(so|com)/signup', selector: 'input[type=email]' },
        steps: [
          { fill: 'input[type=email]', with: 'email' },
          { click: { text: '^Continue$' }, submit: true },
        ],
      },
    ],
    done: {
      needs_you: [{ text: 'There was a problem signing up' }],
      check_email: [{ text: '(sent|emailed) (you )?a (code|link)|check your (email|inbox)|verification code' }],
      signed_up: [{ url: 'notion\\.(so|com)/(onboarding|[0-9a-f]{32})' }],
    },
  },

  autismcanada: {
    key: 'autismcanada',
    name: 'Autism Canada’s newsletter',
    kind: 'newsletter',
    hosts: ['autismcanada.org'],
    start: 'https://www.autismcanada.org/',
    privacy: 'https://www.autismcanada.org/privacy-policy',
    // Asks "I'm not a robot" after Subscribe: the person ticks it.
    robot: false,
    note: 'Autism Canada asks you to tick “I’m not a robot” at the end.',
    pages: [
      {
        when: { url: 'autismcanada\\.org', selector: 'input[name=email]' },
        steps: [
          { fill: 'input[name=first-name]', with: 'firstName' },
          { fill: 'input[name=last-name]', with: 'lastName' },
          { fill: 'input[name=email]', with: 'email' },
          // "I consent to receiving emails, from which I can unsubscribe anytime": what subscribing is.
          { tick: { css: 'input[type=checkbox]', label: 'consent to rec' } },
          { click: { text: '^Subscribe$' }, submit: true },
        ],
      },
    ],
    done: {
      signed_up: [{ text: 'thanks? (you )?for (subscribing|signing up)|you(’|\')re (now )?subscribed' }],
    },
  },
}

/** The service a web address belongs to, if the kit can sign people up for it. */
export function recipeForUrl(url: string | null | undefined): Recipe | null {
  if (!url) return null
  let host = ''
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  for (const r of Object.values(RECIPES)) {
    if (r.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return r
  }
  return null
}

export interface RunResult {
  status: Outcome | 'dry_run' | 'timeout'
  detail?: string
  url?: string
  /** Pages whose steps were done, by index (the caller passes them back after a full page load). */
  done: number[]
}

export interface RunOptions {
  /** Fill everything but press nothing that sends it (tests). */
  dryRun?: boolean
  /** Pages already done before this page loaded. */
  done?: number[]
  timeoutMs?: number
  /** Told each time a page's steps are done (so a page load can't lose it). */
  onEvent?: (e: { type: 'page_done'; page: number; url: string }) => void
}

/**
 * Fill in a service's sign-up form in the page this runs in, page by page,
 * until it ends: signed up, a confirmation email sent, an account that
 * already existed, a step only the person can do (a robot check, a payment,
 * a code from their email), or a failure (with the page's own words).
 * Self-contained, so it can be sent into any page and run there.
 */
export async function runSignup(recipe: Recipe, person: Person, opts: RunOptions = {}): Promise<RunResult> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const re = (s: string) => new RegExp(s, 'i')
  const done = new Set<number>(opts.done || [])
  const deadline = Date.now() + (opts.timeoutMs || 45000)

  const visible = (el: Element | null): el is HTMLElement => {
    if (!el || !(el instanceof HTMLElement)) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const labelOf = (el: HTMLElement): string => {
    const own = (el as HTMLInputElement).labels?.[0]?.innerText || el.getAttribute('aria-label') || ''
    return (own || el.closest('label')?.innerText || el.parentElement?.innerText || '').trim()
  }
  // A checkbox can be hidden and drawn by its label; it still counts if its label shows.
  const usable = (el: Element | null): el is HTMLElement =>
    visible(el) || (el instanceof HTMLInputElement && el.type === 'checkbox' && visible(el.closest('label') || (el.id ? document.querySelector(`label[for="${el.id}"]`) : null)))

  const find = (t: Target): HTMLElement | null => {
    if (typeof t === 'string') return ([...document.querySelectorAll(t)].find(usable) as HTMLElement) || null
    if (t.text) {
      const words = re(t.text)
      const all = [...document.querySelectorAll('button, a, [role=button], input[type=submit], label')].filter(visible)
      return (all.find((b) => words.test(((b as HTMLElement).innerText || (b as HTMLInputElement).value || b.getAttribute('aria-label') || '').trim())) as HTMLElement) || null
    }
    let all = [...document.querySelectorAll(t.css || '*')].filter(usable) as HTMLElement[]
    if (t.label) all = all.filter((el) => re(t.label!).test(labelOf(el)))
    return all[t.index || 0] || null
  }
  const waitFind = async (t: Target, ms = 10000): Promise<HTMLElement | null> => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      const el = find(t)
      if (el) return el
      await sleep(200)
    }
    return null
  }
  const valueOf = (f: Field): string =>
    f === 'fullName' ? `${person.firstName} ${person.lastName}`.trim() : String((person as unknown as Record<string, string | undefined>)[f] || '')

  // Typing the way a framework (React, Angular) hears it.
  const setValue = (el: HTMLElement, value: string) => {
    const input = el as HTMLInputElement
    input.focus()
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
  }
  const tick = (el: HTMLElement) => {
    const box = (el instanceof HTMLInputElement ? el : el.querySelector('input[type=checkbox]')) as HTMLInputElement | null
    if (box && box.checked) return
    // A hidden box is ticked through its label, as a person would.
    const shown: boolean = visible(el as Element)
    const target = el instanceof HTMLInputElement && !shown ? (el.closest('label') as HTMLElement | null) || el : el
    target.click()
  }

  const matches = (d: Detector): boolean => {
    if (d.url && !re(d.url).test(location.href)) return false
    if (d.selector && !visible(document.querySelector(d.selector))) return false
    if (d.text && !re(d.text).test(document.body?.innerText || '')) return false
    return Boolean(d.url || d.selector || d.text)
  }
  const outcome = (): Outcome | null => {
    for (const o of ['exists', 'needs_you', 'failed', 'check_email', 'signed_up'] as Outcome[]) {
      if ((recipe.done[o] || []).some(matches)) return o
    }
    return null
  }
  // A robot check the person has to do: never got around, handed over. Not
  // reCAPTCHA's invisible badge, which only watches.
  const robotCheck = (): boolean => {
    const frames = [...document.querySelectorAll('iframe')].filter((f) => {
      const r = f.getBoundingClientRect()
      return r.width > 40 && r.height > 40 && visible(f) && !/size=invisible/.test(f.src) &&
        /recaptcha\/(api2|enterprise)\/(anchor|bframe)|hcaptcha|challenges\.cloudflare\.com|turnstile|arkoselabs|funcaptcha/i.test(f.src)
    })
    return frames.length > 0 || visible(document.querySelector('#px-captcha')) || /prove your humanity|confirm you('|’)re human|press (&|and) hold/i.test(document.body?.innerText || '')
  }
  // A check passed: its answer is in the form (reCAPTCHA, hCaptcha, Cloudflare Turnstile).
  const checkPassed = (): boolean =>
    [...document.querySelectorAll('[name="g-recaptcha-response"], [name="h-captcha-response"], [name="cf-turnstile-response"]')].some(
      (el) => !!(el as HTMLInputElement).value,
    )
  // Many checks pass by themselves in a moment: only one still there seconds later is the person's to do.
  let checkSince = 0
  const stuckOnCheck = (): boolean => {
    if (!robotCheck()) { checkSince = 0; return false }
    if (!checkSince) checkSince = Date.now()
    return Date.now() - checkSince > 4000
  }
  const errorText = (): string => {
    const el = [...document.querySelectorAll('[role=alert], [aria-live=assertive], [class*=error], [class*=Error], [id*=error], [id*=Error]')].find((e) => visible(e) && (e as HTMLElement).innerText.trim())
    return ((el as HTMLElement)?.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 200)
  }
  const result = (status: RunResult['status'], detail?: string): RunResult => ({ status, detail, url: location.href, done: [...done] })
  // A form sent that loads a new page: this page is leaving, and its answer
  // comes on the next. Only for a while: a page that said it would leave and
  // is still here 10 seconds later isn't leaving.
  let leftAt = 0
  addEventListener('beforeunload', () => { leftAt = Date.now() })
  addEventListener('pagehide', () => { leftAt = Date.now() })
  const leaving = () => leftAt > 0 && Date.now() - leftAt < 10000

  const pageNow = () => recipe.pages.findIndex((p) => (!p.when.url || re(p.when.url).test(location.href)) && (!p.when.selector || usable(document.querySelector(p.when.selector))))
  while (Date.now() < deadline) {
    const end = outcome()
    if (end) return result(end)
    const index = pageNow()
    if (index >= 0 && !done.has(index)) {
      for (const step of recipe.pages[index].steps) {
        const target = 'fill' in step ? step.fill : 'tick' in step ? step.tick : step.click
        if (opts.dryRun && 'click' in step && step.submit) return result('dry_run', `page ${index + 1}: ready to send`)
        const el = await waitFind(target)
        if (!el) return result('failed', `missing: ${JSON.stringify(target).slice(0, 80)}`)
        if ('click' in step && step.submit) {
          // Told before sending: sending can load a new page, and this page must not be sent twice.
          done.add(index)
          try { opts.onEvent?.({ type: 'page_done', page: index, url: location.href }) } catch {}
          // A robot check on the page: a few seconds to pass by itself; if it doesn't, everything is
          // filled in and the person ticks it and sends. The next page carries on from there.
          if (robotCheck() && !checkPassed()) {
            const until = Date.now() + 6000
            while (Date.now() < until && !checkPassed()) await sleep(400)
            if (!checkPassed()) return result('needs_you', 'robot_check')
          }
        }
        if ('fill' in step) setValue(el, valueOf(step.with))
        else if ('tick' in step) tick(el)
        else el.click()
        await sleep(250)
      }
      done.add(index)
      await sleep(1500)
      continue
    }
    // Nothing to fill right now: waiting for the service, or stuck.
    if (stuckOnCheck()) return result('needs_you', 'robot_check')
    if (index >= 0 && done.has(index)) {
      // Still on a page already filled in: the service may be slow, or said no.
      // Up to 8 seconds for an answer; while the page is leaving, its answer
      // comes on the next page. Then the service's own words, if it has any.
      const until = Date.now() + 8000
      let moved = false
      while (Date.now() < until || leaving()) {
        await sleep(500)
        if (outcome() || robotCheck() || pageNow() !== index) { moved = true; break }
      }
      if (moved) continue
      return result('failed', errorText() || 'The service didn’t accept the form.')
    }
    await sleep(400)
  }
  return result('timeout', errorText() || undefined)
}
