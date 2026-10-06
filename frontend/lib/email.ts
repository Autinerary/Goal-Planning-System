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
  /** Extra headers, e.g. List-Unsubscribe for the weekly email. */
  headers?: Record<string, string>
  /** Sender, when it is not the reminders address. */
  from?: string
}

export type SendEmailResult = { ok: boolean; skipped?: boolean; id?: string; error?: string }

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = input.from || process.env.REMINDER_FROM_EMAIL || 'Autinerary <reminders@autinerary.app>'

  // Not configured yet → no-op (feature is "ready", just not switched on).
  if (!key) return { ok: false, skipped: true }
  if (!input.to) return { ok: false, error: 'missing recipient' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}) },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text, ...(input.headers ? { headers: input.headers } : {}) }),
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
    text: `${who}\n\nOpen your Path to see today's tasks and keep your streak going:\n${link}\n\nYou're getting this because you turned on daily reminders. You can turn them off in Settings, under Emails.\n\n— Autinerary`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:16px">${who}</p>
        <p style="font-size:16px;line-height:1.5">Here's your nudge for today — open your Path to see your tasks and keep your streak going. 🔥</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:linear-gradient(90deg,#06b6d4,#3b82f6);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Open my Path →</a>
        </p>
        <p style="font-size:12px;color:#64748b">You're getting this because you turned on daily reminders. You can turn them off in Settings, under Emails.</p>
      </div>`,
  }
}


/** Sent once, when someone finishes setup (app/api/me/welcome). */
export function welcomeEmail(appUrl: string): { subject: string; html: string; text: string } {
  const link = `${appUrl.replace(/\/$/, '')}/path`
  return {
    subject: 'Welcome to Autinerary',
    text: `Welcome to Autinerary!\n\nYour account and first Path are ready. Open it to see your first milestone:\n${link}\n\nYou can explore resources and people whenever you are ready.\n\n- Autinerary`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="font-size:24px;margin:0 0 16px">Welcome to Autinerary</h1>
        <p style="font-size:16px;line-height:1.5">Your account and first Path are ready. Open it to see your first milestone.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Open my Path</a>
        </p>
        <p style="font-size:16px;line-height:1.5">You can explore resources and people whenever you are ready.</p>
      </div>`,
  }
}

/**
 * A reminder to finish setup (Riipen Labs, Group 11: "Need a break? Your
 * progress is saved"). Sent once, only to someone who asked for it on the
 * setup page, and only while setup is still unfinished (app/api/cron/reminders).
 */
export function finishSetupEmail(appUrl: string): { subject: string; html: string; text: string } {
  const link = `${appUrl.replace(/\/$/, '')}/onboarding`
  return {
    subject: 'Your Autinerary setup is waiting',
    text: `Hi,\n\nYou asked us to remind you to finish setting up Autinerary. Your answers are saved on the device you used, so you can pick up where you left off:\n${link}\n\nOne goal is all it takes to get your path. This is the only reminder we will send.\n\n- Autinerary`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:16px">Hi,</p>
        <p style="font-size:16px;line-height:1.5">You asked us to remind you to finish setting up Autinerary. Your answers are saved on the device you used, so you can pick up where you left off.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Finish setup</a>
        </p>
        <p style="font-size:16px;line-height:1.5">One goal is all it takes to get your path.</p>
        <p style="font-size:13px;color:#475569;line-height:1.5">This is the only reminder we will send.</p>
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

const BOX = 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a'
const BUTTON = 'background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block'
const SMALL = 'font-size:13px;color:#475569;line-height:1.5'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A shared story's final version is ready for its teller to approve (app/api/stories). */
export function storyReadyEmail(appUrl: string): { subject: string; html: string; text: string } {
  const link = `${appUrl.replace(/\/$/, '')}/share-your-story`
  return {
    subject: 'Your story is ready for you to approve',
    text: `Hi,\n\nThank you for sharing your story. The team has prepared the final version. Nothing is shared until you approve it:\n${link}\n\nYou can also change your mind and withdraw it there at any time.\n\n- Autinerary`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p>
      <p style="font-size:16px;line-height:1.5">Thank you for sharing your story. The team has prepared the final version. Nothing is shared until you approve it.</p>
      <p style="margin:24px 0"><a href="${link}" style="${BUTTON}">Read and approve it</a></p>
      <p style="${SMALL}">You can also change your mind and withdraw it there at any time.</p></div>`,
  }
}

export interface NewsletterLink { label: string; detail?: string; href: string }

function footer(unsubscribe: string, postal: string | null, why: string): { text: string; html: string } {
  const address = postal ? `Autinerary Corp., ${postal}` : 'Autinerary Corp.'
  return {
    text: `\n${why}\nStop these emails: ${unsubscribe}\n${address} · https://app.autinerary.ca/privacy`,
    html: `<p style="${SMALL};margin-top:28px">${esc(why)} <a href="${unsubscribe}" style="color:#334155">Stop these emails</a>.<br>${esc(address)} · <a href="https://app.autinerary.ca/privacy" style="color:#334155">Privacy</a></p>`,
  }
}

function linkList(links: NewsletterLink[]): { text: string; html: string } {
  return {
    text: links.map((l) => `- ${l.label}${l.detail ? `: ${l.detail}` : ''}\n  ${l.href}`).join('\n'),
    html: `<ul style="padding-left:18px">${links.map((l) => `<li style="margin:0 0 12px"><a href="${l.href}" style="color:#3730a3;font-weight:600">${esc(l.label)}</a>${l.detail ? `<br><span style="color:#334155">${esc(l.detail)}</span>` : ''}</li>`).join('')}</ul>`,
  }
}

/** Double opt-in: nothing else is sent until this is confirmed (app/api/newsletter). */
export function newsletterConfirmEmail(confirm: string, asked: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Please confirm your email for Autinerary',
    text: `Hi,\n\nSomeone, hopefully you, asked Autinerary for: ${asked}.\nConfirm it here: ${confirm}\n\nIf it was not you, ignore this email. Nothing else will be sent.\n\n- Autinerary`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p>
      <p style="font-size:16px;line-height:1.5">Someone, hopefully you, asked Autinerary for: <strong>${esc(asked)}</strong>.</p>
      <p style="margin:24px 0"><a href="${confirm}" style="${BUTTON}">Confirm my email</a></p>
      <p style="${SMALL}">If it was not you, ignore this email. Nothing else will be sent.</p></div>`,
  }
}

/** The Start here list someone asked for by email. */
export function newsletterListEmail(title: string, links: NewsletterLink[], startLink: string, unsubscribe: string, postal: string | null): { subject: string; html: string; text: string } {
  const list = linkList(links)
  const foot = footer(unsubscribe, postal, 'You asked for this list on autinerary.ca.')
  return {
    subject: `Your starter resources: ${title}`,
    text: `Hi,\n\nHere is the list you asked for, ${title.toLowerCase()}:\n\n${list.text}\n\nOpen it again any time: ${startLink}\nThese are places to start looking, not medical or clinical advice.\n${foot.text}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p><p style="font-size:16px;line-height:1.5">Here is the list you asked for, ${esc(title.toLowerCase())}:</p>${list.html}
      <p style="font-size:15px"><a href="${startLink}" style="color:#3730a3">Open it again any time</a>.</p>
      <p style="${SMALL}">These are places to start looking, not medical or clinical advice.</p>${foot.html}</div>`,
  }
}

/** The weekly email: three places and ideas to start with, and one practical tip. */
export function newsletterWeeklyEmail(links: NewsletterLink[], tip: string, unsubscribe: string, postal: string): { subject: string; html: string; text: string } {
  const list = linkList(links)
  const foot = footer(unsubscribe, postal, 'You signed up for this weekly email on autinerary.ca.')
  return {
    subject: 'This week from Autinerary: three places to start, and a tip',
    text: `Hi,\n\nThree places and ideas to start with this week:\n\n${list.text}\n\nOne practical tip: ${tip}\n\nThese are places to start looking, not medical or clinical advice.\n${foot.text}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p><p style="font-size:16px;line-height:1.5">Three places and ideas to start with this week:</p>${list.html}
      <p style="font-size:16px;line-height:1.5;background:#eef2ff;border-radius:12px;padding:14px"><strong>One practical tip:</strong> ${esc(tip)}</p>
      <p style="${SMALL}">These are places to start looking, not medical or clinical advice.</p>${foot.html}</div>`,
  }
}

