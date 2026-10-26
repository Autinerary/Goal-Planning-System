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

export const KIT_VERSION = '2026-10-26.7'

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

// ── Local services: their website's contact or booking form (lib/requests.ts) ──

/** What a field of a contact form is for. */
export type FieldRole = 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'message' | 'subject' | 'consent' | 'skip'

/** A field as the AI may see it: the form's own words, never the person's. */
export interface FormField {
  key: string
  tag: string
  type: string
  label: string
  required: boolean
  options?: string[]
}

export interface ContactRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  message: string
  subject: string
}

export interface ContactOptions {
  dryRun?: boolean
  timeoutMs?: number
  /** Pages already visited looking for the form (passed back after each page load). */
  hops?: number
  /** The form was sent before this page loaded: this page is its answer. */
  sent?: boolean
  /** The AI's reading of fields the words alone didn't settle, by field key. */
  mapping?: Record<string, FieldRole>
  /**
   * In the person's own browser (the extension), after the server robot met a
   * robot check or a question only they can answer: fill in everything it can,
   * leave the rest to them, and watch for them sending it ('sent'; and 'done'
   * when the page says so without loading a new one).
   */
  handOver?: boolean
  /** Handed over already: only read the page (never fill in or follow a link again). */
  after?: boolean
  onEvent?: (e: { type: 'sent' | 'done'; url: string }) => void
}

/** An email address a service's own page shows, and the words around it. */
export interface FoundEmail {
  email: string
  /** In a mailto: link, rather than only written out. */
  mailto: boolean
  context: string
}

export interface ContactResult {
  status: 'requested' | 'needs_you' | 'failed' | 'dry_run' | 'navigating' | 'needs_mapping' | 'timeout'
  detail?: string
  url?: string
  hops: number
  /** needs_mapping: the fields to ask about (the form's words only). */
  fields?: FormField[]
  /** dry_run: what was filled in, by role. */
  filled?: string[]
  /** Unless sent: the addresses this page shows, for when there's no form to send (lib/requests.ts pickSiteEmail). */
  emails?: FoundEmail[]
  /** The AI's reading of the form's boxes it used (lib/signupRobot.ts), for a hand-over to use too. */
  mapping?: Record<string, FieldRole>
}

/**
 * Send the person's request through a local service's own website: find its
 * contact or booking form (following its Contact link if need be), fill in
 * the person's name, email, phone and message, tick a consent box (never a
 * marketing one), and send it. A required question the form's words don't
 * settle goes to the AI as words only (needs_mapping), and if it still isn't
 * clear, it hands over (needs_you) rather than guess; so does a robot check.
 * In the person's own browser (opts.handOver) it fills in the rest and leaves
 * those to them. Self-contained, like runSignup.
 */
export async function runContactForm(request: ContactRequest, opts: ContactOptions = {}): Promise<ContactResult> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const hops = opts.hops || 0
  const MAX_HOPS = 2
  const visible = (el: Element | null): el is HTMLElement => {
    if (!el || !(el instanceof HTMLElement)) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  }
  const words = (el: Element): string => {
    const i = el as HTMLInputElement
    const label = (i.labels && i.labels[0]?.innerText) || ''
    const aria = el.getAttribute('aria-label') || ''
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => (id ? document.getElementById(id)?.innerText || '' : '')).join(' ')
    const near = !label && !aria && !labelledBy ? (el.closest('label, .form-group, .field, [class*="field"], p, li, div')?.querySelector('label, legend, span')?.textContent || '') : ''
    return [label, aria, labelledBy, near, i.placeholder || '', el.getAttribute('name') || '', el.id || '', el.getAttribute('autocomplete') || '']
      .join(' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 160)
  }
  // The email addresses the page shows (linked or written out), each with the words around it:
  // when there's no form to send, the request can go to the right one of them instead.
  const foundEmails = (): FoundEmail[] => {
    const out = new Map<string, FoundEmail>()
    const around = (el: Element | null, email: string): string => {
      let node = el as HTMLElement | null
      let words = node?.innerText || ''
      // Out to the line it's on ("General inquiries: email us"): its paragraph, list item or cell, or a
      // small box around it; never the whole footer, whose other lines ("Website by…") aren't about it.
      for (let i = 0; i < 3 && node?.parentElement && node.parentElement !== document.body; i++) {
        if (/^(P|LI|DD|DT|TD|TH|ADDRESS|LABEL|H[1-6])$/.test(node.tagName) && words.trim().length >= 12) break
        const t = node.parentElement.innerText || ''
        if (t.length > 160) break
        node = node.parentElement
        words = t
      }
      const flat = words.replace(/\s+/g, ' ').trim()
      const at = flat.toLowerCase().indexOf(email)
      return (at < 0 ? flat.slice(0, 160) : flat.slice(Math.max(0, at - 80), at + email.length + 40)).trim()
    }
    const add = (raw: string, el: Element | null, mailto: boolean) => {
      const email = raw.trim().toLowerCase()
      if (out.size >= 30 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return
      const had = out.get(email)
      if (had) { if (mailto) had.mailto = true; return }
      out.set(email, { email, mailto, context: around(el, email) })
    }
    for (const a of document.querySelectorAll('a[href^="mailto:" i]')) {
      let to = (a.getAttribute('href') || '').slice(7).split('?')[0]
      try { to = decodeURIComponent(to) } catch {}
      to.split(/[,;]/).forEach((x) => add(x, a, true))
    }
    if (document.body) {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n && out.size < 30; n = walk.nextNode()) {
        const tag = n.parentElement?.tagName
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue
        ;(n.nodeValue || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)?.forEach((x) => add(x, n.parentElement, false))
      }
    }
    return [...out.values()]
  }
  const result = (status: ContactResult['status'], extra: Partial<ContactResult> = {}): ContactResult =>
    ({ status, url: location.href, hops, ...(status === 'requested' ? {} : { emails: foundEmails() }), ...extra })
  const text = () => (document.body?.innerText || '').replace(/\s+/g, ' ')
  const SUCCESS = /thank you|thanks for (contacting|reaching|your (message|inquiry|enquiry|request))|(message|form|request|inquiry|enquiry) (has been |was )?(sent|received|submitted)|we('|’)ll (be in touch|get back)|we will (be in touch|get back|contact you)|successfully (sent|submitted)/i
  const robotCheck = (): boolean =>
    [...document.querySelectorAll('iframe')].some((f) => {
      const r = f.getBoundingClientRect()
      return r.width > 40 && r.height > 40 && visible(f) && !/size=invisible/.test(f.src) && /recaptcha\/(api2|enterprise)\/(anchor|bframe)|hcaptcha|challenges\.cloudflare\.com|turnstile/i.test(f.src)
    })
  const checkPassed = (): boolean => [...document.querySelectorAll('[name="g-recaptcha-response"], [name="h-captcha-response"], [name="cf-turnstile-response"]')].some((el) => !!(el as HTMLInputElement).value)

  // A checkbox can be hidden and drawn by its label; it still counts if its label shows.
  const shownBox = (el: Element) => el instanceof HTMLInputElement && el.type === 'checkbox' && visible(el.closest('label') || (el.id ? document.querySelector(`label[for="${el.id}"]`) : null))
  const fieldsOf = (root: Element): HTMLElement[] =>
    [...root.querySelectorAll('input, textarea, select')].filter((el) => {
      const t = ((el as HTMLInputElement).type || '').toLowerCase()
      return (visible(el) || shownBox(el)) && !['hidden', 'submit', 'button', 'reset', 'image', 'file', 'search'].includes(t)
    }) as HTMLElement[]
  const isEmailField = (el: Element) => (el as HTMLInputElement).type === 'email' || /e-?mail/.test(words(el))
  // A contact form: an email field, and a message box or a name; never a log-in, search or newsletter-only form.
  const contactForm = (): HTMLElement | null => {
    const roots = [...document.querySelectorAll('form'), ...(document.querySelectorAll('form').length ? [] : [document.body])] as HTMLElement[]
    const scored = roots
      .map((root) => {
        const fields = fieldsOf(root)
        if (!fields.some(isEmailField)) return null
        if (fields.some((f) => (f as HTMLInputElement).type === 'password')) return null
        const hasMessage = fields.some((f) => f.tagName === 'TEXTAREA')
        const hasName = fields.some((f) => /name/.test(words(f)) && !isEmailField(f))
        const newsletterOnly = !hasMessage && fields.length <= 3 && /subscribe|newsletter|sign up for (our )?(news|updates)/i.test(root.innerText || '')
        if (newsletterOnly || (!hasMessage && !hasName)) return null
        return { root, score: (hasMessage ? 2 : 0) + (hasName ? 1 : 0) + Math.min(fields.length, 8) / 10 }
      })
      .filter((x): x is { root: HTMLElement; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
    return scored[0]?.root || null
  }

  // Handed over: when they send it themselves, say so; and if the page answers
  // without loading a new one, say how it went. (A click on its button may be
  // a form with no <form>: that only counts once the page says thanks.)
  const watch = (root: HTMLElement) => {
    const w = window as unknown as { __autineraryWatching?: HTMLElement }
    if (w.__autineraryWatching === root) return
    w.__autineraryWatching = root
    const tell = (type: 'sent' | 'done') => { try { opts.onEvent?.({ type, url: location.href }) } catch {} }
    const look = (until: number) => {
      if (SUCCESS.test(text())) return tell('done')
      if (Date.now() < until) setTimeout(() => look(until), 500)
    }
    root.addEventListener('submit', () => { tell('sent'); setTimeout(() => look(Date.now() + 15000), 500) }, true)
    root.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest?.('button, input[type=submit], [role=button]')
      if (b) setTimeout(() => look(Date.now() + 15000), 800)
    }, true)
  }

  // The answer to a form already sent.
  if (opts.sent && !opts.after) {
    await sleep(1200)
    if (SUCCESS.test(text())) return result('requested')
    if (robotCheck()) return result('needs_you', { detail: 'robot_check' })
    return result('requested', { detail: 'sent; the page didn’t say' })
  }
  // Handed over already: a page they went to. Its thanks, or the form again (still theirs to send).
  if (opts.after) {
    await sleep(1200)
    if (SUCCESS.test(text())) return result('requested')
    const again = contactForm()
    if (again) watch(again)
    if (robotCheck() || again || !opts.sent) return result('needs_you', { detail: 'waiting' })
    return result('requested', { detail: 'sent; the page didn’t say' })
  }

  // A form drawn a moment after the page: a few seconds for it, then the site's Contact link.
  const deadline = Date.now() + Math.min(opts.timeoutMs || 30000, hops ? 6000 : 4000)
  let form: HTMLElement | null = contactForm()
  while (!form && Date.now() < deadline) { await sleep(400); form = contactForm() }
  if (!form) {
    // A form from a form service, shown in a frame: open it.
    const framed = [...document.querySelectorAll('iframe')].find((f) => visible(f) && /jotform|hsforms|hubspot|typeform|docs\.google\.com\/forms|wufoo|formstack|cognitoforms|formsite|123formbuilder|zohopublic|forms\.office/i.test(f.src))
    if (framed && hops < MAX_HOPS) { location.href = framed.src; return result('navigating', { hops: hops + 1 }) }
    // The site's own Contact (or Book) page.
    if (hops < MAX_HOPS) {
      const here = location.hostname.replace(/^www\./, '')
      const links = [...document.querySelectorAll('a[href]')].filter((a) => {
        try {
          const u = new URL((a as HTMLAnchorElement).href)
          return /^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, '') === here && u.href !== location.href
        } catch { return false }
      }) as HTMLAnchorElement[]
      const rank = (a: HTMLAnchorElement) => {
        const t = `${a.innerText} ${a.getAttribute('aria-label') || ''} ${a.pathname}`.toLowerCase()
        if (/\bcontact\b/.test(t)) return 3
        if (/book|appointment|intake|referral|request|get started|new (client|patient)|get in touch|enquir|inquir/.test(t)) return 2
        return 0
      }
      const best = links.map((a) => ({ a, r: rank(a) })).filter((x) => x.r > 0).sort((x, y) => y.r - x.r)[0]
      if (best) { location.href = best.a.href; return result('navigating', { hops: hops + 1 }) }
    }
    return result('failed', { detail: 'No contact form on their website.' })
  }

  // What each field is for: the form's own words first.
  const fields = fieldsOf(form)
  const keyOf = (el: HTMLElement, i: number) => `f${i}`
  const roleOf = (el: HTMLElement): FieldRole | null => {
    // A choice (select) is never typed into: required ones get a new-client option below.
    if (el.tagName === 'SELECT') return 'skip'
    const w = words(el)
    const t = ((el as HTMLInputElement).type || el.tagName).toLowerCase()
    if (t === 'checkbox') return /consent|agree|privacy|terms|accept|acknowledg/.test(w) && !/newsletter|marketing|promot|offers|subscribe|updates|mailing list/.test(w) ? 'consent' : 'skip'
    if (t === 'radio') return null
    if (t === 'email' || /e-?mail/.test(w)) return /confirm|again|repeat|re-?enter/.test(w) ? 'email' : 'email'
    if (t === 'tel' || /phone|mobile|cell|telephone|\btel\b/.test(w)) return 'phone'
    if (/first|given|fname|forename/.test(w)) return 'firstName'
    if (/last|surname|family|lname/.test(w)) return 'lastName'
    if (el.tagName === 'TEXTAREA' || /message|comment|question|inquir|enquir|how can we help|details|reason for/.test(w)) return 'message'
    if (/subject|topic|regarding/.test(w) && el.tagName !== 'SELECT') return 'subject'
    if (/(^|\s)(your |full )?name(\s|$)|full.?name|contact.?name/.test(w)) return 'fullName'
    return null
  }
  const required = (el: HTMLElement) => (el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true' || /\*/.test((el as HTMLInputElement).labels?.[0]?.innerText || '')
  // What a box asks, as the person reads it (to tell them): its label, without a choice's options or the "*".
  const asks = (el: HTMLElement): string => {
    const i = el as HTMLInputElement
    let label = (i.labels && i.labels[0]?.innerText) || el.getAttribute('aria-label') || i.placeholder || el.getAttribute('name') || ''
    if (el.tagName === 'SELECT') for (const o of (el as HTMLSelectElement).options) label = label.replace(o.text, '')
    return label.replace(/\*/g, '').replace(/\s+/g, ' ').replace(/[\s:]+$/, '').trim().slice(0, 80)
  }
  const roles = new Map<HTMLElement, FieldRole>()
  const unknown: FormField[] = []
  // Theirs to answer (handed over): the boxes, so the first can be shown to them.
  const theirs: HTMLElement[] = []
  fields.forEach((el, i) => {
    const r = opts.mapping?.[keyOf(el, i)] || roleOf(el)
    if (r && !(r === 'skip' && required(el) && (el as HTMLInputElement).type !== 'checkbox')) roles.set(el, r)
    // A required question nobody can answer from the name, email, phone and message.
    else if (required(el) && el.tagName !== 'SELECT') {
      unknown.push({ key: keyOf(el, i), tag: el.tagName.toLowerCase(), type: (el as HTMLInputElement).type || '', label: words(el), required: true })
      theirs.push(el)
    }
  })
  if (unknown.length && !opts.handOver) {
    // Asked already, and still unclear: a question only they can answer.
    if (opts.mapping) return result('needs_you', { detail: `question: ${asks(theirs[0])}` })
    return result('needs_mapping', { detail: `question: ${asks(theirs[0])}`, fields: [...unknown, ...fields.map((el, i) => roles.has(el) ? null : { key: keyOf(el, i), tag: el.tagName.toLowerCase(), type: (el as HTMLInputElement).type || '', label: words(el), required: false }).filter((x): x is FormField => !!x && !unknown.some((u) => u.key === x.key))].slice(0, 40) })
  }
  if (![...roles.values()].includes('email')) return result('failed', { detail: 'Their form has no email field.' })

  // Typing the way a framework hears it (text boxes only).
  const setValue = (el: HTMLElement, value: string) => {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return
    const input = el as HTMLInputElement
    input.focus()
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
  }
  const value: Record<string, string> = {
    firstName: request.firstName,
    lastName: request.lastName,
    fullName: `${request.firstName} ${request.lastName}`.trim(),
    email: request.email,
    phone: request.phone || '',
    message: request.message,
    subject: request.subject,
  }
  const filled: string[] = []
  for (const [el, role] of roles) {
    if (role === 'skip') continue
    if (role === 'consent') {
      const box = el as HTMLInputElement
      const shown: boolean = visible(box as Element)
      if (!box.checked) ((shown ? box : (box.closest('label') as HTMLElement | null) || box) as HTMLElement).click()
      filled.push('consent')
      continue
    }
    if (role === 'phone' && !value.phone) continue
    setValue(el, value[role])
    filled.push(role)
    await sleep(120)
  }
  // A required choice (a select): a new-client, appointment or general option when there is one.
  for (const el of fields) {
    if (el.tagName !== 'SELECT' || !required(el)) continue
    const sel = el as HTMLSelectElement
    if (sel.value) continue
    const opt = [...sel.options].find((o) => /new (client|patient)|appointment|book|general|inquir|enquir|other/i.test(o.text)) || null
    if (!opt) {
      if (!opts.handOver) return result('needs_you', { detail: `question: ${asks(el)}` })
      theirs.push(el)
      continue
    }
    sel.value = opt.value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // Handed over, with questions only they can answer: everything else is in; they answer and send.
  if (opts.handOver && theirs.length) {
    watch(form)
    theirs[0].scrollIntoView({ block: 'center' })
    theirs[0].focus()
    return result('needs_you', { detail: `question: ${asks(theirs[0])}`, filled })
  }
  if (robotCheck() && !checkPassed()) {
    const until = Date.now() + 6000
    while (Date.now() < until && !checkPassed()) await sleep(400)
    if (!checkPassed()) {
      // Handed over: they tick it and send; the page is watched for that.
      if (opts.handOver) watch(form)
      return result('needs_you', { detail: 'robot_check', filled })
    }
  }
  if (opts.dryRun) return result('dry_run', { filled })

  const submit = ([...form.querySelectorAll('button, input[type=submit]')] as HTMLElement[]).filter(visible)
    .sort((a, b) => Number((b as HTMLButtonElement).type === 'submit') - Number((a as HTMLButtonElement).type === 'submit'))
    .find((b) => (b as HTMLButtonElement).type === 'submit' || /send|submit|request|book|contact|go|enquir|inquir/i.test((b as HTMLElement).innerText || (b as HTMLInputElement).value || ''))
  if (!submit) return result('failed', { detail: 'No button to send their form.' })
  // Told before sending: sending can load a new page, which is then its answer.
  try { opts.onEvent?.({ type: 'sent', url: location.href }) } catch {}
  let leftAt = 0
  addEventListener('beforeunload', () => { leftAt = Date.now() })
  submit.click()
  const until = Date.now() + 12000
  while (Date.now() < until) {
    await sleep(500)
    if (leftAt) continue
    if (SUCCESS.test(text())) return result('requested', { filled })
    if (robotCheck() && !checkPassed()) return result('needs_you', { detail: 'robot_check', filled })
    const invalid = [...form.querySelectorAll(':invalid')].filter(visible)
    if (invalid.length) return result('failed', { detail: `Their form wants: ${words(invalid[0]).slice(0, 60)}`, filled })
  }
  return result('requested', { detail: 'sent; the page didn’t say', filled })
}
