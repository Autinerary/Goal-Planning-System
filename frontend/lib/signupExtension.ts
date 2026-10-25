/**
 * Talking to the Autinerary extension from the app's pages (one-click
 * sign-up; chrome-extension/signup.js). Chrome gives a page a way to message
 * an extension only when that extension lists the page's address
 * (externally_connectable), so without it installed everything here answers
 * null. Browser only.
 */

/** The extension's ID: fixed by the public key in its manifest; the Chrome Web Store's once it is published. */
export const EXTENSION_ID = process.env.NEXT_PUBLIC_SIGNUP_EXTENSION_ID || 'nfhcdhdjijngooikmhoeebadceanmncf'

type SendMessage = (id: string, message: unknown, callback: (response: unknown) => void) => void

function runtime(): { sendMessage: SendMessage; lastError?: unknown } | null {
  const chrome = (globalThis as unknown as { chrome?: { runtime?: { sendMessage?: SendMessage; lastError?: unknown } } }).chrome
  return chrome?.runtime?.sendMessage ? (chrome.runtime as { sendMessage: SendMessage; lastError?: unknown }) : null
}

/** One message to the extension; null if it isn't there or doesn't answer in time. */
export function askExtension<T>(message: unknown, timeoutMs = 2000): Promise<T | null> {
  const rt = runtime()
  if (!rt) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    try {
      rt.sendMessage(EXTENSION_ID, message, (response) => {
        clearTimeout(timer)
        // Reading lastError keeps Chrome from logging "Unchecked runtime.lastError".
        void rt.lastError
        resolve((response as T) ?? null)
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

export interface ExtensionInfo {
  ok: true
  version: string
  kit: string
  services: string[]
  /** Its services, named: one newer than the app can bring new ones. */
  catalog?: { key: string; name: string; kind: 'account' | 'newsletter'; hosts: string[] }[]
}

export const extensionInfo = async (): Promise<ExtensionInfo | null> => {
  const r = await askExtension<ExtensionInfo>({ type: 'signup-ping' })
  return r && r.ok ? r : null
}

export interface ExtensionStatus {
  status: 'running' | 'signed_up' | 'check_email' | 'needs_you' | 'exists' | 'failed' | 'timeout' | 'unknown'
  detail?: string | null
  password?: string
  /** The extension's job, to keep watching after a hand-over. */
  jobId?: string
}

/** Ask the extension to sign the person up; then watch until it ends (a few minutes at most). */
export async function signUpWithExtension(
  service: string,
  person: { firstName: string; lastName: string; email: string },
  onWaiting?: () => void,
): Promise<ExtensionStatus> {
  const start = await askExtension<{ jobId?: string; error?: string }>({ type: 'signup-start', service, person }, 4000)
  if (!start?.jobId) return { status: 'failed', detail: start?.error || 'The extension didn’t answer.' }
  const end = Date.now() + 4 * 60 * 1000
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1200))
    const s = await askExtension<ExtensionStatus>({ type: 'signup-status', jobId: start.jobId })
    if (s && s.status !== 'running') return { ...s, jobId: start.jobId }
    onWaiting?.()
  }
  return { status: 'timeout', jobId: start.jobId }
}

/** After a hand-over: wait (up to 10 minutes) for the person to finish the step, and the sign-up to end. */
export async function watchExtensionJob(jobId: string, maxMs = 10 * 60 * 1000): Promise<ExtensionStatus | null> {
  const end = Date.now() + maxMs
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await askExtension<ExtensionStatus>({ type: 'signup-status', jobId })
    if (!s || s.status === 'unknown') return null
    if (s.status !== 'running' && s.status !== 'needs_you') return s
  }
  return null
}

// ── The desktop app (desktop/signup.js): the web app runs inside it, with a bridge ──

interface DesktopBridge {
  signupInfo: () => Promise<ExtensionInfo | null>
  signUp: (service: string, person: { firstName: string; lastName: string; email: string }) => Promise<ExtensionStatus>
  onSignupUpdate?: (callback: (update: ExtensionStatus & { service: string }) => void) => void
}

const desktop = (): DesktopBridge | null => (globalThis as unknown as { autineraryDesktop?: DesktopBridge }).autineraryDesktop || null

/** The desktop app's sign-up, when this page is open inside it. */
export const desktopInfo = async (): Promise<ExtensionInfo | null> => {
  const d = desktop()
  if (!d) return null
  const r = await d.signupInfo().catch(() => null)
  return r && r.ok ? r : null
}

/** Sign up in a window of the desktop app's own; it answers when the sign-up ends. */
export async function signUpWithDesktop(service: string, person: { firstName: string; lastName: string; email: string }): Promise<ExtensionStatus> {
  const d = desktop()
  if (!d) return { status: 'failed', detail: 'Not in the desktop app.' }
  return d.signUp(service, person).catch(() => ({ status: 'failed' as const, detail: 'The desktop app didn’t answer.' }))
}

/** After a hand-over in the desktop app: told how each sign-up ended once the person finished the step. */
export function onDesktopUpdate(callback: (update: ExtensionStatus & { service: string }) => void): void {
  desktop()?.onSignupUpdate?.(callback)
}
