// Text messages through Twilio's REST API (https://www.twilio.com/docs/sms),
// for daily reminders by text. Server-only.
//
// Off until these are set in Vercel: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_VERIFY_SERVICE_SID (Twilio Verify sends and checks the code that
// proves a number is yours), and TWILIO_MESSAGING_SERVICE_SID or
// TWILIO_FROM_NUMBER (who the reminders come from). Until then setup and
// Settings do not offer texts at all, so nobody is promised one.
//
// A number gets reminders only after its owner types the code sent to it, so
// nobody can sign someone else's phone up. The verified number lives in the
// account's app_metadata, which only the server can change. Replies of STOP
// are handled by Twilio's opt-out for US and Canadian numbers.

const API = 'https://api.twilio.com/2010-04-01'
const VERIFY = 'https://verify.twilio.com/v2'

export function smsEnabled(): boolean {
  const e = process.env
  return Boolean(
    e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_VERIFY_SERVICE_SID &&
      (e.TWILIO_MESSAGING_SERVICE_SID || e.TWILIO_FROM_NUMBER),
  )
}

/** A Canadian or US number as +1XXXXXXXXXX, or null. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  // North American numbers: area code and exchange never start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null
  return `+1${national}`
}

/** "••• ••• 1234", for showing which number texts go to. */
export function maskPhone(phone: string | null | undefined): string | null {
  return phone ? `••• ••• ${phone.slice(-4)}` : null
}

async function twilio(url: string, form: Record<string, string>): Promise<{ ok: boolean; status: number; json: any }> {
  const sid = process.env.TWILIO_ACCOUNT_SID || ''
  const token = process.env.TWILIO_AUTH_TOKEN || ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(10000),
    })
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) }
  } catch (e: any) {
    return { ok: false, status: 0, json: { message: e?.message || 'request failed' } }
  }
}

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!smsEnabled()) return { ok: false, error: 'texts are not set up' }
  const sender: Record<string, string> = process.env.TWILIO_MESSAGING_SERVICE_SID
    ? { MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
    : { From: process.env.TWILIO_FROM_NUMBER || '' }
  const res = await twilio(`${API}/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { To: to, Body: body, ...sender })
  return res.ok ? { ok: true } : { ok: false, error: `Twilio ${res.status}: ${String(res.json?.message || '').slice(0, 160)}` }
}

/** Text a 6-digit code to the number (Twilio Verify). */
export async function startVerification(to: string): Promise<{ ok: boolean; error?: string }> {
  const res = await twilio(`${VERIFY}/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, { To: to, Channel: 'sms' })
  if (res.ok) return { ok: true }
  return { ok: false, error: res.status === 429 ? 'Too many codes for this number. Please wait a few minutes.' : 'The code could not be sent. Check the number and try again.' }
}

/** True when the code is the one sent to the number. */
export async function checkVerification(to: string, code: string): Promise<boolean> {
  const res = await twilio(`${VERIFY}/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, { To: to, Code: code })
  return res.ok && res.json?.status === 'approved'
}

/** The daily reminder, by text. Short, with who it is from and how to stop. */
export function reminderText(appUrl: string): string {
  return `Autinerary: your goals for today are on your Path: ${appUrl.replace(/\/$/, '')}/path Reply STOP to stop these texts.`
}
