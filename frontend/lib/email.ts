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
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
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
    text: `${who}\n\nOpen your Path to see today's tasks and keep your streak going:\n${link}\n\n— Autinerary`,
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
