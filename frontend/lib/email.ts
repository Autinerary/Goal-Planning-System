// Transactional email via Resend (https://resend.com).
//
// Uses fetch against Resend's REST API so there's no new npm dependency, and it
// NO-OPS cleanly when RESEND_API_KEY is unset — so nothing breaks until you add
// the key. Server-only (never import from client components).

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
  idempotencyKey?: string
}

export type SendEmailResult = { ok: boolean; skipped?: boolean; id?: string; error?: string }

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL || 'Autinerary <reminders@autinerary.app>'

  // Not configured yet → no-op (feature is "ready", just not switched on).
  if (!key) return { ok: false, skipped: true }
  if (!input.to) return { ok: false, error: 'missing recipient' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}) },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: true, id: data?.id }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send failed' }
  }
}

/** Simple branded HTML for the daily goals reminder. */
export function dailyReminderEmail(name: string | null, appUrl: string): { subject: string; html: string; text: string } {
  const who = name ? `Hi ${name},` : 'Hi,'
  const link = `${appUrl.replace(/\/$/, '')}/path`
  return {
    subject: 'Your goals for today 🎯',
    text: `${who}\n\nOpen your Path to see today's tasks and keep your streak going:\n${link}\n\nYou're getting this because you turned on daily reminders. You can turn them off in Settings.\n\n— Autinerary`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:16px">${who}</p>
        <p style="font-size:16px;line-height:1.5">Here's your nudge for today — open your Path to see your tasks and keep your streak going. 🔥</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:linear-gradient(90deg,#06b6d4,#3b82f6);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Open my Path →</a>
        </p>
        <p style="font-size:12px;color:#64748b">You're getting this because you turned on daily reminders. You can turn them off in Settings.</p>
      </div>`,
  }
}


/**
 * The inactive-user check-in (Riipen Labs, Group 2): one question, sent only to
 * people who opted in, after two weeks away. The links work without signing
 * in: one answers the question, the other turns these emails off.
 */
export function checkinEmail(appUrl: string, token: string): { subject: string; html: string; text: string } {
  const base = `${appUrl.replace(/\/$/, '')}/checkin?t=${encodeURIComponent(token)}`
  const stop = `${base}&stop=1`
  return {
    subject: 'One quick question from Autinerary',
    text: `Hi,\n\nYou haven't opened Autinerary for a couple of weeks, and that's okay. Could you tell us why? It's one question, you don't need to sign in, and it helps us fix whatever got in the way:\n${base}\n\nYou're getting this because you asked us to check in if you stopped using Autinerary. To stop these emails: ${stop}\n\n- Autinerary`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:16px">Hi,</p>
        <p style="font-size:16px;line-height:1.5">You haven't opened Autinerary for a couple of weeks, and that's okay. Could you tell us why? It's one question, you don't need to sign in, and it helps us fix whatever got in the way.</p>
        <p style="margin:24px 0">
          <a href="${base}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Answer one question</a>
        </p>
        <p style="font-size:13px;color:#475569;line-height:1.5">You're getting this because you asked us to check in if you stopped using Autinerary. <a href="${stop}" style="color:#334155">Stop these emails</a>.</p>
      </div>`,
  }
}
