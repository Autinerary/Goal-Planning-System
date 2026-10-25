// Server only: one-click sign-up with partner services (docs/partner-signups.md).
// A partner gives Autinerary a way to create the account directly, so there is
// no form at all: Autinerary sends the person's name and email in a signed
// request, and the partner answers created, exists or verify_email.
//
// Partners are set in SIGNUP_PARTNERS (JSON), for example
//   {"focusmate":{"name":"Focusmate","hosts":["focusmate.com"],"url":"https://…/autinerary/signups","secretEnv":"PARTNER_FOCUSMATE_SECRET"}}
// with each secret in its own environment variable. None yet.
//
// Only Node's crypto: lib/signupPartners.test.mjs loads it directly.

import { createHmac, timingSafeEqual } from 'crypto'

export interface Partner {
  key: string
  name: string
  hosts: string[]
  url: string
  secretEnv: string
}

const KEY = /^[a-z0-9-]{2,40}$/
const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/

/** The partners set up in SIGNUP_PARTNERS; anything malformed is left out. */
export function partnersFrom(raw: string | undefined | null): Record<string, Partner> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '{}')
  } catch {
    return {}
  }
  const out: Record<string, Partner> = {}
  if (!parsed || typeof parsed !== 'object') return out
  for (const [key, v] of Object.entries(parsed as Record<string, unknown>)) {
    const p = v as Partial<Partner>
    if (!KEY.test(key) || !p || typeof p.name !== 'string' || !Array.isArray(p.hosts) || typeof p.url !== 'string' || typeof p.secretEnv !== 'string') continue
    if (!/^https:\/\//.test(p.url) || !p.hosts.every((h) => typeof h === 'string' && HOST.test(h)) || !/^[A-Z0-9_]+$/.test(p.secretEnv)) continue
    out[key] = { key, name: p.name.slice(0, 80), hosts: p.hosts, url: p.url, secretEnv: p.secretEnv }
  }
  return out
}

/** The signature header: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">. */
export function signature(secret: string, body: string, t: number): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
}

/** What a partner does with our request (docs/partner-signups.md): check the signature, and that it is fresh. */
export function verifySignature(secret: string, body: string, header: string | null | undefined, now = Math.floor(Date.now() / 1000), toleranceS = 300): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(String(header || ''))
  if (!m) return false
  const t = Number(m[1])
  if (Math.abs(now - t) > toleranceS) return false
  const want = Buffer.from(signature(secret, body, t).split('v1=')[1], 'hex')
  const got = Buffer.from(m[2], 'hex')
  return want.length === got.length && timingSafeEqual(want, got)
}

export type PartnerOutcome = 'signed_up' | 'exists' | 'check_email' | 'failed'

/** The partner's answer, as one-click sign-up's outcomes. */
export function outcomeOf(status: unknown): PartnerOutcome {
  if (status === 'created') return 'signed_up'
  if (status === 'exists') return 'exists'
  if (status === 'verify_email') return 'check_email'
  return 'failed'
}

/** The request body: what the person said yes to sending, and nothing else. */
export function requestBody(input: { requestId: string; service: string; person: { firstName: string; lastName: string; email: string }; consentedAt: string; sentAt: string }): string {
  return JSON.stringify({
    version: 1,
    requestId: input.requestId,
    service: input.service,
    person: { firstName: input.person.firstName, lastName: input.person.lastName, email: input.person.email },
    consentedAt: input.consentedAt,
    sentAt: input.sentAt,
  })
}

/** Send one sign-up to a partner; never throws. */
export async function partnerSignup(
  partner: Partner,
  secret: string,
  input: { requestId: string; person: { firstName: string; lastName: string; email: string }; consentedAt: string },
  fetcher: typeof fetch = fetch,
): Promise<{ status: PartnerOutcome; detail?: string; loginUrl?: string }> {
  const sentAt = new Date().toISOString()
  const body = requestBody({ ...input, service: partner.key, sentAt })
  const t = Math.floor(Date.now() / 1000)
  try {
    const res = await fetcher(partner.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Autinerary-Signature': signature(secret, body, t), 'X-Autinerary-Request-Id': input.requestId },
      body,
      signal: AbortSignal.timeout(15000),
    })
    const j = (await res.json().catch(() => null)) as { status?: string; loginUrl?: string; message?: string } | null
    if (!res.ok) return { status: 'failed', detail: (j?.message || `${partner.name} answered ${res.status}`).slice(0, 200) }
    const status = outcomeOf(j?.status)
    const loginUrl = typeof j?.loginUrl === 'string' && /^https:\/\//.test(j.loginUrl) ? j.loginUrl : undefined
    return { status, ...(status === 'failed' ? { detail: (j?.message || 'An answer it didn’t understand.').slice(0, 200) } : {}), ...(loginUrl ? { loginUrl } : {}) }
  } catch (e) {
    return { status: 'failed', detail: `${partner.name} didn’t answer.` }
  }
}
