// Transactional email via Resend (https://resend.com).
//
// Uses fetch against Resend's REST API so there's no new npm dependency, and it
// NO-OPS cleanly when RESEND_API_KEY is unset — so nothing breaks until you add
// the key. Server-only (never import from client components).

import { recapLines, communityAction, type FirstWeeksFacts } from '@/lib/firstWeeks'

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

/**
 * The daily reminder. Calm, with no streak to keep and no emoji (Riipen
 * Labs, Group 15: "No countdown timers, guilt-based prompts, or artificial
 * urgency"; Group 18: emoji-heavy screens read as generic).
 */
export function dailyReminderEmail(name: string | null, appUrl: string): { subject: string; html: string; text: string } {
  const who = name ? `Hi ${name},` : 'Hi,'
  const link = `${appUrl.replace(/\/$/, '')}/path`
  return {
    subject: 'Your next step for today',
    text: `${who}\n\nYour next step is on your Path, with today's tasks. Do as much or as little as fits today:\n${link}\n\nYou're getting this because you turned on daily reminders. You can turn them off in Settings, under Emails.\n\n— Autinerary`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:16px">${esc(who)}</p>
        <p style="font-size:16px;line-height:1.5">Your next step is on your Path, with today's tasks. Do as much or as little as fits today.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Open my Path</a>
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
 * A reminder to finish setup, one of up to three (Riipen Labs, Groups 20 and
 * 24; lib/setupReminders.ts). Group 24: "Messaging acknowledges the
 * caregiver's load before asking for anything else", and "every reminder
 * gives three choices: finish now, remind me in a few days, or stop
 * reminders". Group 20: "its tone should stay positive". Sent only to someone
 * who asked for reminders, while setup is still unfinished.
 */
export function setupReminderEmail(
  appUrl: string,
  opts: { index: number; audience?: string | null; links: { finish: string; snooze3: string; snooze7: string; stop: string }; postal: string | null },
): { subject: string; html: string; text: string } {
  const { index, links } = opts
  const caring = opts.audience === 'child' || opts.audience === 'family'
  const subject = index >= 3 ? 'A last note about your Autinerary setup'
    : index === 2 ? 'No rush: your Autinerary setup is still here'
    : 'Your Autinerary setup is waiting'
  const opening = caring ? 'We know you’re carrying a lot right now.' : 'No rush.'
  const body = 'Setting up takes about two minutes: who you’re here for, and one goal. Your answers are saved on the device you used, so you can pick up where you left off.'
  const count = index >= 3 ? 'This is the last one we’ll send.' : `This is reminder ${index} of 3. We won’t send more than three.`
  const why = 'You get this because you asked for reminders to finish setting up Autinerary.'
  const foot = footer(links.stop, opts.postal, why)
  return {
    subject,
    text: `Hi,\n\n${opening} ${body}\n\nFinish setting up: ${links.finish}\n\nNot now?\n- Remind me in 3 days: ${links.snooze3}\n- Remind me in a week: ${links.snooze7}\n- Stop these reminders: ${links.stop}\n\n${count}\n${foot.text}\n\n- Autinerary`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p>
      <p style="font-size:16px;line-height:1.5">${esc(opening)} ${esc(body)}</p>
      <p style="margin:24px 0"><a href="${links.finish}" style="${BUTTON}">Finish setting up</a></p>
      <p style="font-size:15px;line-height:1.6">Not now? <a href="${links.snooze3}" style="color:#3730a3">Remind me in 3 days</a> · <a href="${links.snooze7}" style="color:#3730a3">Remind me in a week</a> · <a href="${links.stop}" style="color:#3730a3">Stop these reminders</a></p>
      <p style="${SMALL}">${esc(count)}</p>${foot.html}</div>`,
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

/**
 * The emails for someone's first two weeks, on day 1, 7 and 14, each from
 * what they did (lib/firstWeeks.ts; Riipen Labs, Group 15: "Day 1, Day 7,
 * and Day 14 emails tied to what the user actually did, not a generic
 * digest"). Day 1 confirms the plan and links to the step where they left
 * off; day 7 is a recap and one thing to try with other people; day 14 asks
 * whether it is useful, and, for people who teach or work with
 * neurodivergent people, about paid extras for organisations ("introduces the
 * paid/expanded tier where relevant", said as the home page says it: they may
 * come later, and everything is free during the beta; docs/free-and-paid.md).
 * Every link goes through `links.open`, which notes the
 * first one opened.
 */
export function firstWeeksEmail(
  day: 1 | 7 | 14,
  facts: FirstWeeksFacts,
  links: { open: (to: string) => string; stop: string; checkin?: string },
  postal: string | null,
): { subject: string; html: string; text: string } {
  const goal = facts.goal ? `\u201c${facts.goal}\u201d` : null
  const step = facts.nextStep
  const stepLink = links.open(step ? `/milestones/${encodeURIComponent(step.id)}` : facts.goal ? '/path' : '/onboarding')
  const stepButton = step ? 'Open this step' : facts.goal ? 'Open my Path' : 'Make my plan'
  const why = 'You get these three emails because you asked for them for your first two weeks with Autinerary.'
  const foot = footer(links.stop, postal, why)
  const para = (t: string) => `<p style="font-size:16px;line-height:1.5">${esc(t)}</p>`
  let subject = ''
  let lines: string[] = []
  let button = { label: stepButton, href: stepLink }
  let extra: { text: string; html: string } = { text: '', html: '' }
  if (day === 1) {
    subject = step ? 'Pick up where you left off' : 'Your next step with Autinerary'
    lines = [
      ...(goal ? [`You made a plan for ${goal}.`] : []),
      step
        ? `Your next step is \u201c${step.name}\u201d. Open it to see a few small tasks, and the tools that can help.`
        : facts.goal
          ? 'Your Path shows what comes next.'
          : 'Your next step is to make your plan: who you\u2019re here for, and one goal. It takes about two minutes.',
      'No rush: it will be there whenever you are ready.',
    ]
  } else if (day === 7) {
    subject = 'Your first week with Autinerary'
    const recap = recapLines(facts)
    lines = [
      ...(recap.length ? ['In your first week:', ...recap.map((r) => `\u2022 ${r}`)] : ['Your plan is still here, and so is your first step. Nothing is lost by waiting.']),
      ...(step ? [`Next up: \u201c${step.name}\u201d.`] : []),
    ]
    const action = communityAction(facts.audience)
    const href = links.open(action.href)
    extra = {
      text: `\nOne thing to try this week: ${action.text}\n${action.label}: ${href}\n`,
      html: `<p style="font-size:16px;line-height:1.5;background:#eef2ff;border-radius:12px;padding:14px"><strong>One thing to try this week:</strong> ${esc(action.text)} <a href="${href}" style="color:#3730a3;font-weight:600">${esc(action.label)}</a></p>`,
    }
  } else {
    subject = 'Two weeks in: is Autinerary useful so far?'
    const recap = recapLines(facts)
    lines = [
      'You have had Autinerary for two weeks.',
      ...recap.map((r) => `\u2022 ${r}`),
      'Is it useful so far? It is one question, and you don\u2019t need to sign in. Your answer decides what we fix next.',
    ]
    if (links.checkin) button = { label: 'Answer one question', href: links.checkin }
    const forWork = facts.audience === 'work'
    const tier = forWork
      ? 'Using Autinerary at a school or workplace? Paid extras for organisations such as schools and employers may come later: reply to this email and tell us what yours would need. Everything you use now stays free during the beta.'
      : 'Everything in Autinerary stays free during the beta, and we will tell you before anything you use changes.'
    extra = {
      text: `\n${tier}\n\nYour Path: ${links.open('/path')}\n\nThis is the last of the three emails.\n`,
      html: `${para(tier)}<p style="font-size:15px"><a href="${links.open('/path')}" style="color:#3730a3">Open my Path</a></p><p style="${SMALL}">This is the last of the three emails.</p>`,
    }
  }
  return {
    subject,
    text: `Hi,\n\n${lines.join('\n')}\n\n${button.label}: ${button.href}\n${extra.text}${foot.text}\n\n- Autinerary`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p>${lines.map(para).join('')}
      <p style="margin:24px 0"><a href="${button.href}" style="${BUTTON}">${esc(button.label)}</a></p>${extra.html}${foot.html}</div>`,
  }
}

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

/**
 * To the team, when someone reports a message in Hare World (STEP 66). Only a
 * link to the review page (ResourceHub, Admin, then Reported messages): the
 * message itself stays in the database.
 */
export function messageReportedEmail(reviewUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: 'A message was reported in Hare World',
    text: `Someone reported a message they were sent in Hare World.

Review it (admins only):
${reviewUrl}

- Autinerary`,
    html: `<div style="${BOX}"><p style="font-size:16px;line-height:1.5">Someone reported a message they were sent in Hare World.</p>
      <p style="margin:24px 0"><a href="${reviewUrl}" style="${BUTTON}">Review it</a></p>
      <p style="${SMALL}">Admins only. The message isn’t in this email; it stays in the database.</p></div>`,
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


/**
 * The weekly email for people with an account who turn it on in Settings →
 * Emails (Riipen Labs, Group 11, for people who finished setup: "Your saved
 * resources, plus new picks this week"). Sent by lib/weeklyPicks.ts.
 */
export function weeklyPicksEmail(input: {
  name: string | null
  saved: NewsletterLink[]
  savedTotal: number
  savedUrl: string
  picks: NewsletterLink[]
  tip: string
  appUrl: string
  unsubscribe: string
  postal: string
}): { subject: string; html: string; text: string } {
  const who = input.name ? `Hi ${input.name},` : 'Hi,'
  const path = `${input.appUrl.replace(/\/$/, '')}/path`
  const picks = linkList(input.picks)
  const saved = linkList(input.saved)
  const more = input.savedTotal > input.saved.length ? input.savedTotal - input.saved.length : 0
  const savedText = input.saved.length
    ? `What you saved in ResourceHub:\n\n${saved.text}\n${more ? `\nAnd ${more} more: ${input.savedUrl}\n` : ''}`
    : `Nothing saved yet. When a place looks useful in ResourceHub, save it and it will be here next week.\n`
  const savedHtml = input.saved.length
    ? `<p style="font-size:16px;line-height:1.5;font-weight:600">What you saved in ResourceHub</p>${saved.html}${more ? `<p style="font-size:15px"><a href="${input.savedUrl}" style="color:#3730a3">And ${more} more</a></p>` : ''}`
    : `<p style="font-size:16px;line-height:1.5">Nothing saved yet. When a place looks useful in ResourceHub, save it and it will be here next week.</p>`
  const foot = footer(input.unsubscribe, input.postal, 'You turned on this weekly email in Autinerary, under Settings → Emails.')
  return {
    subject: 'Your saved resources, plus new picks this week',
    text: `${who}\n\n${savedText}\nNew picks for you this week:\n\n${picks.text}\n\nOne practical tip: ${input.tip}\n\nYour Path: ${path}\n\nThese are places to start looking, not medical or clinical advice.\n${foot.text}`,
    html: `<div style="${BOX}"><p style="font-size:16px">${esc(who)}</p>${savedHtml}
      <p style="font-size:16px;line-height:1.5;font-weight:600">New picks for you this week</p>${picks.html}
      <p style="font-size:16px;line-height:1.5;background:#eef2ff;border-radius:12px;padding:14px"><strong>One practical tip:</strong> ${esc(input.tip)}</p>
      <p style="margin:24px 0"><a href="${path}" style="${BUTTON}">Open my Path</a></p>
      <p style="${SMALL}">These are places to start looking, not medical or clinical advice.</p>${foot.html}</div>`,
  }
}
