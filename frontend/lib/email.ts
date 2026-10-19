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
          <a href="${link}" style="background:#1b5d30;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Open my Path</a>
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
          <a href="${link}" style="background:#1b5d30;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Open my Path</a>
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
          <a href="${link}" style="background:#1b5d30;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Finish setup</a>
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
          <a href="${base}" style="background:#1b5d30;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">Answer one question</a>
        </p>
        <p style="font-size:13px;color:#475569;line-height:1.5">You're getting this because you asked us to check in if you stopped using Autinerary. <a href="${stop}" style="color:#334155">Stop these emails</a>.</p>
      </div>`,
  }
}

const BOX = 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a'
const BUTTON = 'background:#1b5d30;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block'
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

/** The vote for Community's Choice, in the month's last newsletter (Goal 5). */
export interface ChoiceVoteSection {
  /** "October". */
  month: string
  /** This person's link to the vote page. */
  link: string
  /** A few of the most nominated, by kind, to show what is on the ballot. */
  nominees: { kind: string; name: string }[]
}

function voteSection(vote: ChoiceVoteSection | null | undefined): { text: string; html: string } {
  if (!vote) return { text: '', html: '' }
  const names = vote.nominees.slice(0, 6)
  const disclaimer = "Community's Choice services are chosen through monthly nomination rounds, where all users can nominate a service."
  return {
    text: `\nVote for ${vote.month}'s Community's Choice: the most nominated service, shop item and article this month. One vote of each:\n${names.map((n) => `- ${n.name} (${n.kind})`).join('\n')}\nVote: ${vote.link}\n${disclaimer}\n`,
    html: `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:16px;margin:20px 0">
      <p style="font-size:17px;font-weight:700;margin:0 0 6px;color:#451a03">Vote for ${esc(vote.month)}'s Community's Choice</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 8px;color:#1e293b">The most nominated service, shop item and article this month. One vote of each.</p>
      <ul style="padding-left:18px;margin:0 0 12px;color:#1e293b">${names.map((n) => `<li>${esc(n.name)} <span style="color:#475569">(${esc(n.kind)})</span></li>`).join('')}</ul>
      <a href="${vote.link}" style="${BUTTON}">Vote now</a>
      <p style="${SMALL};margin:10px 0 0">${esc(disclaimer)}</p></div>`,
  }
}

function footer(unsubscribe: string, postal: string | null, why: string): { text: string; html: string } {
  const address = postal ? `Autinerary Corp., ${postal}` : 'Autinerary Corp.'
  return {
    text: `\n${why}\nStop these emails: ${unsubscribe}\n${address} · https://app.autinerary.ca/privacy · https://app.autinerary.ca/terms`,
    html: `<p style="${SMALL};margin-top:28px">${esc(why)} <a href="${unsubscribe}" style="color:#334155">Stop these emails</a>.<br>${esc(address)} · <a href="https://app.autinerary.ca/privacy" style="color:#334155">Privacy</a> · <a href="https://app.autinerary.ca/terms" style="color:#334155">Terms</a></p>`,
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
export function newsletterWeeklyEmail(links: NewsletterLink[], tip: string, unsubscribe: string, postal: string, vote?: ChoiceVoteSection | null): { subject: string; html: string; text: string } {
  const list = linkList(links)
  const foot = footer(unsubscribe, postal, 'You signed up for this weekly email on autinerary.ca.')
  const choice = voteSection(vote)
  return {
    subject: vote ? `This week from Autinerary: vote for ${vote.month}'s Community's Choice` : 'This week from Autinerary: three places to start, and a tip',
    text: `Hi,\n${choice.text}\nThree places and ideas to start with this week:\n\n${list.text}\n\nOne practical tip: ${tip}\n\nThese are places to start looking, not medical or clinical advice.\n${foot.text}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p>${choice.html}<p style="font-size:16px;line-height:1.5">Three places and ideas to start with this week:</p>${list.html}
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
  /** In the month's last week: the vote for Community's Choice. */
  vote?: ChoiceVoteSection | null
}): { subject: string; html: string; text: string } {
  const who = input.name ? `Hi ${input.name},` : 'Hi,'
  const choice = voteSection(input.vote)
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
    subject: input.vote ? `Your saved resources, new picks, and the vote for ${input.vote.month}'s Community's Choice` : 'Your saved resources, plus new picks this week',
    text: `${who}\n${choice.text}\n${savedText}\nNew picks for you this week:\n\n${picks.text}\n\nOne practical tip: ${input.tip}\n\nYour Path: ${path}\n\nThese are places to start looking, not medical or clinical advice.\n${foot.text}`,
    html: `<div style="${BOX}"><p style="font-size:16px">${esc(who)}</p>${choice.html}${savedHtml}
      <p style="font-size:16px;line-height:1.5;font-weight:600">New picks for you this week</p>${picks.html}
      <p style="font-size:16px;line-height:1.5;background:#eef2ff;border-radius:12px;padding:14px"><strong>One practical tip:</strong> ${esc(input.tip)}</p>
      <p style="margin:24px 0"><a href="${path}" style="${BUTTON}">Open my Path</a></p>
      <p style="${SMALL}">These are places to start looking, not medical or clinical advice.</p>${foot.html}</div>`,
  }
}

/** One service's line in the rating sweep (STEP 79's rating_sweep()). */
export interface SweepRow {
  resource_id: string
  name: string
  category: string | null
  email: string | null
  email_ok: boolean
  from_state: 'good' | 'warned' | 'probation' | 'hidden'
  to_state: 'good' | 'warned' | 'probation' | 'hidden'
  average: number
  ratings: number
  needed_to_return: number
  needed_for_good: number
  probation_ends: string | null
}

const STATE_WORDS: Record<SweepRow['to_state'], string> = {
  good: 'in good standing',
  warned: 'warned (under 4.0)',
  probation: 'on probation (3.5 or under)',
  hidden: 'hidden (3.5 or under for two months)',
}

/**
 * The monthly rating sweep's digest for the team (Goal 5: "Automated so we
 * get email of any services below 3.5/5"): what changed, and every service at
 * 3.5 or under, with how many ratings of 5 would bring each back.
 */
export function ratingSweepDigestEmail(rows: SweepRow[], hubUrl: string, applied: boolean, servicesEmailed: number): { subject: string; html: string; text: string } {
  const low = rows.filter((r) => r.to_state === 'probation' || r.to_state === 'hidden')
  const changed = rows.filter((r) => r.from_state !== r.to_state)
  const line = (r: SweepRow) =>
    `${r.name} (${r.category || 'service'}): ${Number(r.average).toFixed(2)} from ${r.ratings} ratings, ${STATE_WORDS[r.to_state]}` +
    (r.needed_to_return ? `; ${r.needed_to_return} more rating${r.needed_to_return === 1 ? '' : 's'} of 5 would bring it above 3.5` : '') +
    (r.probation_ends ? `; probation ends ${r.probation_ends}` : '')
  const link = (r: SweepRow) => `${hubUrl.replace(/\/$/, '')}/resources/${r.resource_id}`
  const section = (title: string, list: SweepRow[]) =>
    list.length
      ? {
          text: `${title}:\n${list.map((r) => `- ${line(r)}\n  ${link(r)}`).join('\n')}\n`,
          html: `<p style="font-size:16px;font-weight:600">${esc(title)}</p><ul style="padding-left:18px">${list.map((r) => `<li style="margin:0 0 8px"><a href="${link(r)}" style="color:#3730a3">${esc(r.name)}</a>: ${esc(line(r).slice(r.name.length + 2))}</li>`).join('')}</ul>`,
        }
      : { text: `${title}: none.\n`, html: `<p style="font-size:16px">${esc(title)}: none.</p>` }
  const a = section('Changed this month', changed)
  const b = section('At 3.5 or under', low)
  const how = applied
    ? `Applied. ${servicesEmailed} service${servicesEmailed === 1 ? '' : 's'} emailed.`
    : 'A dry run: nothing was changed or sent.'
  return {
    subject: `Rating sweep: ${low.length} service${low.length === 1 ? '' : 's'} at 3.5 or under`,
    text: `The monthly rating sweep (services with at least five ratings). ${how}\n\n${a.text}\n${b.text}`,
    html: `<div style="${BOX}"><p style="font-size:16px">The monthly rating sweep (services with at least five ratings). ${esc(how)}</p>${a.html}${b.html}</div>`,
  }
}

/**
 * The email to a service whose standing changed (sent only with
 * RATING_SWEEP_EMAIL_SERVICES=on), to the address it publishes. Informational,
 * from Autinerary Corp., with how to stop it.
 */
export function serviceStandingEmail(r: SweepRow, hubUrl: string, postal: string | null): { subject: string; html: string; text: string } | null {
  const page = `${hubUrl.replace(/\/$/, '')}/resources/${r.resource_id}`
  const avg = Number(r.average).toFixed(1)
  const body =
    r.from_state === 'hidden' && r.to_state !== 'hidden'
      ? `${r.name} is back in ResourceHub's search: its rating is now ${avg} out of 5.`
      : r.to_state === 'warned'
        ? `${r.name}'s rating on ResourceHub is ${avg} out of 5, from ${r.ratings} people who used it. That is under 4. Nothing changes yet: this is a heads-up, so you can read what people said.`
        : r.to_state === 'probation'
          ? `${r.name}'s rating on ResourceHub is ${avg} out of 5, from ${r.ratings} people who used it. At 3.5 or under, a service has two months to improve${r.probation_ends ? ` (until ${r.probation_ends})` : ''}; if its rating is still 3.5 or under then, it is hidden from search. Nothing is deleted.`
          : r.to_state === 'hidden'
            ? `${r.name}'s rating on ResourceHub stayed at 3.5 out of 5 or under for two months, so it is hidden from search for now. Nothing is deleted: people who have used it can still rate it, and it comes back as soon as its rating rises above 3.5${r.needed_to_return ? ` (about ${r.needed_to_return} more rating${r.needed_to_return === 1 ? '' : 's'} of 5)` : ''}.`
            : ''
  if (!body) return null
  const sign = `Autinerary Corp.${postal ? `, ${postal}` : ''}. To stop these emails, reply "stop".`
  return {
    subject: r.to_state === 'warned' ? `Your rating on ResourceHub` : r.to_state === 'probation' ? `Your rating on ResourceHub: two months to improve` : r.to_state === 'hidden' ? `Your listing on ResourceHub is hidden for now` : `Your listing on ResourceHub is back`,
    text: `Hello,\n\n${body}\n\nYour listing: ${page}\n\nRatings on ResourceHub come only from people who have used a service.\n\n${sign}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hello,</p><p style="font-size:16px;line-height:1.5">${esc(body)}</p><p style="margin:20px 0"><a href="${page}" style="${BUTTON}">See your listing</a></p><p style="${SMALL}">Ratings on ResourceHub come only from people who have used a service.<br>${esc(sign)}</p></div>`,
  }
}

/** The month's Community's Choice winners, for the team. */
export function choiceTallyEmail(month: string, winners: { kind: string; name: string; votes: number; url: string }[], applied: boolean): { subject: string; html: string; text: string } {
  const how = applied ? 'Saved, and tagged Community’s Choice.' : 'A dry run: nothing was saved.'
  return {
    subject: `Community's Choice for ${month}: ${winners.length} winner${winners.length === 1 ? '' : 's'}`,
    text: `Community's Choice for ${month}. ${how}\n\n${winners.length ? winners.map((w) => `- ${w.kind}: ${w.name} (${w.votes} vote${w.votes === 1 ? '' : 's'})\n  ${w.url}`).join('\n') : 'No votes this month.'}\n`,
    html: `<div style="${BOX}"><p style="font-size:16px">Community's Choice for ${esc(month)}. ${esc(how)}</p>${
      winners.length
        ? `<ul style="padding-left:18px">${winners.map((w) => `<li style="margin:0 0 8px">${esc(w.kind)}: <a href="${w.url}" style="color:#3730a3">${esc(w.name)}</a> (${w.votes} vote${w.votes === 1 ? '' : 's'})</li>`).join('')}</ul>`
        : '<p style="font-size:16px">No votes this month.</p>'
    }</div>`,
  }
}

/**
 * Billing emails (lib/billingNotices.ts sends each once; docs/subscriptions-2026-10.md
 * says which law asks for which). Plain and calm: no countdowns or pressure
 * (Riipen Labs, Group 15), and always how to stop paying.
 */
export interface BillingFacts {
  appUrl: string
  business: { name: string; address: string; phone: string; email: string }
}

const billingSign = (f: BillingFacts) =>
  [f.business.name, f.business.address, f.business.phone, f.business.email].filter(Boolean).join(' · ')

function billingEmail(f: BillingFacts, subject: string, lines: string[], button: { label: string; href: string } | null, small: string[] = []) {
  const sign = billingSign(f)
  return {
    subject,
    text: `Hi,\n\n${lines.join('\n\n')}\n\n${button ? `${button.label}: ${button.href}\n\n` : ''}${small.length ? `${small.join('\n')}\n\n` : ''}${sign}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hi,</p>${lines.map((l) => `<p style="font-size:16px;line-height:1.5">${esc(l)}</p>`).join('')}${
      button ? `<p style="margin:24px 0"><a href="${button.href}" style="${BUTTON}">${esc(button.label)}</a></p>` : ''
    }${small.length ? `<p style="${SMALL}">${small.map(esc).join('<br>')}</p>` : ''}<p style="${SMALL}">${esc(sign)}</p></div>`,
  }
}

/**
 * A copy of the agreement, right after subscribing (Ontario, O. Reg. 17/05
 * s. 33: within 15 days, with what s. 32 lists, the person's name and the date).
 */
export function agreementCopyEmail(
  f: BillingFacts,
  a: { name: string; date: string; planWords: string; price: string; firstCharge: string; taxes: boolean; termsUrl: string }
) {
  const billing = `${f.appUrl.replace(/\/$/, '')}/billing`
  return billingEmail(
    f,
    'Your Autinerary plan: a copy of your agreement',
    [
      `Thank you for choosing a plan, ${a.name}. This is a copy of what you agreed to on ${a.date}. Please keep it.`,
      `What you get: full use of the Autinerary app (your plan, calendar, check-ins and the people helping you). ResourceHub's directory, ratings and Tidbits stay free for everyone.`,
      `Price: ${a.price} ${a.planWords}${a.taxes ? ', plus GST or HST where it applies' : ''}, in Canadian dollars, paid by card through Stripe, ${a.planWords === 'a month' ? 'every month' : 'every year'} until you cancel. There are no other fees.`,
      `Your first payment: ${a.firstCharge}.`,
      `Cancelling: any time in Billing, with "Cancel my plan". Your plan then runs to the end of the time you have paid for, and you are not charged again. If you think you were charged by mistake, email us within 30 days and we will look at it and refund it if it was.`,
      `Changes: we will email you at least 30 days before a change to your price or plan. You can then cancel, or keep your plan as it was where the law gives you that choice.`,
    ],
    { label: 'Your billing', href: billing },
    [`The terms you agreed to, including Paid plans: ${a.termsUrl}`, 'Your rights under Ontario’s Consumer Protection Act, 2002 (and the law where you live) still apply.']
  )
}

/**
 * Before a free period becomes paid, when someone subscribed during their free
 * month (Quebec, Consumer Protection Act s. 187.29: 2 to 10 days before, with
 * the end date and the price).
 */
export function freePeriodEndingEmail(f: BillingFacts, a: { ends: string; price: string; planWords: string }) {
  const billing = `${f.appUrl.replace(/\/$/, '')}/billing`
  return billingEmail(
    f,
    `Your free month ends on ${a.ends}`,
    [
      `Your free month of Autinerary ends on ${a.ends}. From then, your plan costs ${a.price} ${a.planWords}, plus tax where it applies, charged to your card on ${a.ends}.`,
      `If you don't want to pay, cancel before ${a.ends} in Billing, with "Cancel my plan". You won't be charged.`,
    ],
    { label: 'Your billing', href: billing }
  )
}

/** The free month that needs no card: a heads-up, nothing to pay. */
export function freeMonthEndingEmail(f: BillingFacts, a: { ends: string }) {
  const app = f.appUrl.replace(/\/$/, '')
  return billingEmail(
    f,
    `Your free month of Autinerary ends on ${a.ends}`,
    [
      `Your free month ends on ${a.ends}. Nothing will be charged: there is no card on file.`,
      `To keep using the app after that, you can choose a plan, or see whether you can use it free, through your school, workplace or city, or by explaining your situation.`,
      `Your plan and everything you added are kept either way. ResourceHub stays free.`,
    ],
    { label: 'See your options', href: `${app}/billing` },
    [`Free access: ${app}/free-access`]
  )
}

/** After the free month, with the one question (the planning note: feedback from people who didn't continue). */
export function freeMonthEndedEmail(f: BillingFacts) {
  const app = f.appUrl.replace(/\/$/, '')
  return billingEmail(
    f,
    'Your free month of Autinerary has ended',
    [
      `Your free month has ended, and nothing was charged. Your plan and everything you added are kept, if you come back.`,
      `If you decided not to continue, would you tell us why? It's one question, and it helps us make Autinerary better and cheaper.`,
    ],
    { label: 'Tell us why (one question)', href: `${app}/billing?why=1` },
    [`To keep going: choose a plan or free access at ${app}/billing.`]
  )
}

/** Before a yearly plan renews (Ontario, O. Reg. 17/05 s. 42: 30 to 90 days before). */
export function renewalNoticeEmail(f: BillingFacts, a: { renews: string; price: string }) {
  const billing = `${f.appUrl.replace(/\/$/, '')}/billing`
  return billingEmail(
    f,
    `Your yearly Autinerary plan renews on ${a.renews}`,
    [
      `Your yearly plan renews on ${a.renews} for ${a.price}, plus tax where it applies, charged to your card on file.`,
      `To change to monthly, or to cancel, go to Billing before ${a.renews}. If you do nothing, it renews for another year at that price.`,
    ],
    { label: 'Your billing', href: billing }
  )
}

/** A payment that didn't go through. */
export function paymentFailedEmail(f: BillingFacts) {
  const billing = `${f.appUrl.replace(/\/$/, '')}/billing`
  return billingEmail(
    f,
    'Your Autinerary payment didn’t go through',
    [
      `Your last payment for Autinerary didn't go through. You can still use the app while your card is tried again over the next days.`,
      `To fix it, update your card in Billing. If you'd rather stop, cancel there and you won't be charged.`,
    ],
    { label: 'Update your card', href: billing }
  )
}

/** Confirming a cancellation. */
export function planCancelledEmail(f: BillingFacts, a: { until: string | null }) {
  const billing = `${f.appUrl.replace(/\/$/, '')}/billing`
  return billingEmail(
    f,
    'Your Autinerary plan is cancelled',
    [
      a.until
        ? `Your plan is cancelled. You can keep using the app until ${a.until}, and you won't be charged again.`
        : `Your plan is cancelled, and you won't be charged again.`,
      `Your plan and everything you added are kept, if you come back.`,
    ],
    { label: 'Your billing', href: billing },
    ['Changed your mind? You can choose a plan again in Billing at any time.']
  )
}

/**
 * The code that proves someone runs a listing (Resource Accounts, STEP 81),
 * sent to the email the listing publishes. Not marketing: it is sent only
 * because someone asked to manage that listing, and says how to ignore it.
 */
export function listingClaimCodeEmail(a: { listing: string; code: string; askedBy: string; minutes: number }): { subject: string; html: string; text: string } {
  const lines = [
    `Someone using Autinerary asked to manage the listing for ${a.listing} on ResourceHub. The request came from an account with the email ${a.askedBy}.`,
    `If it was you or your team, your code is ${a.code}. It works for ${a.minutes} minutes.`,
    `If it wasn't you, ignore this email: nothing changes, and the code stops working.`,
  ]
  return {
    subject: `Your code to manage ${a.listing} on ResourceHub`,
    text: `Hello,\n\n${lines.join('\n\n')}\n\n- Autinerary`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hello,</p><p style="font-size:16px;line-height:1.5">${esc(lines[0])}</p>
      <p style="font-size:16px;line-height:1.5">If it was you or your team, your code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${esc(a.code)}</p>
      <p style="${SMALL}">It works for ${a.minutes} minutes. ${esc(lines[2])}</p></div>`,
  }
}

/**
 * To services (V1.5, the planning note's Goal 11), from their published
 * address, only when an admin sends a batch (/business/outreach): what they
 * would like in a Resource Account, and, once a month, that someone who used
 * them rated them. Each says who we are, our mailing address, and how to stop
 * (Canada's anti-spam law); services that reply "stop" are never emailed
 * again (service_email_optouts).
 */
export function providerSurveyEmail(a: { name: string; listing: string; survey: string; claim: string; image: string | null; postal: string }) {
  const sign = `Autinerary Corp., ${a.postal}. To stop these emails, reply "stop".`
  const lines = [
    `${a.name} is listed in ResourceHub, Autinerary's free directory of services for neurodivergent people and their families.`,
    `We are building Resource Accounts, so services can keep their listing right and see how people use it. What would you like in yours? It's a few checkboxes.`,
  ]
  const picture = a.image ? `This is the picture we show for ${a.name}. If it isn't right, say so in the survey.` : `We don't have a picture for ${a.name} yet. You can add one once you claim your listing.`
  return {
    subject: `What would ${a.name} like in its ResourceHub account?`,
    text: `Hello,\n\n${lines.join('\n\n')}\n\nThe survey: ${a.survey}\n\nYour listing: ${a.listing}\n${picture}\n\nClaim your listing: ${a.claim}\n\n${sign}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hello,</p>${lines.map((l) => `<p style="font-size:16px;line-height:1.5">${esc(l)}</p>`).join('')}
      <p style="margin:24px 0"><a href="${a.survey}" style="${BUTTON}">Answer the survey</a></p>
      ${a.image ? `<p style="margin:0 0 8px"><img src="${a.image}" alt="" width="240" style="max-width:240px;border-radius:8px;border:1px solid #e2e8f0"></p>` : ''}
      <p style="font-size:15px;line-height:1.5">${esc(picture)} <a href="${a.listing}" style="color:#1b5d30">See your listing</a> · <a href="${a.claim}" style="color:#1b5d30">Claim it</a></p>
      <p style="${SMALL}">${esc(sign)}</p></div>`,
  }
}

export function providerReviewedEmail(a: { name: string; ratings: number; listing: string; survey: string; claim: string; image: string | null; postal: string }) {
  const sign = `Autinerary Corp., ${a.postal}. To stop these emails, reply "stop".`
  const who = a.ratings === 1 ? 'Someone who used' : `${a.ratings} people who used`
  const lines = [
    `${who} ${a.name} rated it on ResourceHub this month. Ratings come only from people who have used a service.`,
    `You can read what they said on your listing. Run ${a.name}? Claim your listing to keep its details right, and tell us what you'd like in a Resource Account.`,
  ]
  const picture = a.image ? `Is this the right picture for ${a.name}? If not, say so in the survey.` : `We don't have a picture for ${a.name} yet.`
  return {
    subject: `${a.name} was rated on ResourceHub`,
    text: `Hello,\n\n${lines.join('\n\n')}\n\nYour listing: ${a.listing}\nClaim it: ${a.claim}\nThe survey: ${a.survey}\n${picture}\n\n${sign}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hello,</p>${lines.map((l) => `<p style="font-size:16px;line-height:1.5">${esc(l)}</p>`).join('')}
      <p style="margin:24px 0"><a href="${a.listing}" style="${BUTTON}">Read the ratings</a></p>
      ${a.image ? `<p style="margin:0 0 8px"><img src="${a.image}" alt="" width="240" style="max-width:240px;border-radius:8px;border:1px solid #e2e8f0"></p>` : ''}
      <p style="font-size:15px;line-height:1.5">${esc(picture)} <a href="${a.survey}" style="color:#1b5d30">The survey</a> · <a href="${a.claim}" style="color:#1b5d30">Claim your listing</a></p>
      <p style="${SMALL}">${esc(sign)}</p></div>`,
  }
}

/** To a product vendor, before a discount event (the products round, Goal 10; app/api/cron/vendor-notices). */
export function vendorDiscountEventEmail(a: { name: string; starts: string; ends: string; percent: number | null; link: string; postal: string }) {
  const sign = `Autinerary Corp., ${a.postal}. You get this because you sell products through a ResourceHub Resource Account.`
  const lines = [
    `${a.name} runs from ${a.starts} to ${a.ends}. Many families look for products then.`,
    `Would you like to offer a discount${a.percent ? `, for example ${a.percent}% off` : ''}? You can opt each product in or out, and choose the percent, a sale price, or a code for your own store. Nothing changes unless you opt in.`,
  ]
  return {
    subject: `${a.name} is coming: a discount for ResourceHub's shop?`,
    text: `Hello,\n\n${lines.join('\n\n')}\n\nYour Resource Account: ${a.link}\n\n${sign}`,
    html: `<div style="${BOX}"><p style="font-size:16px">Hello,</p>${lines.map((l) => `<p style="font-size:16px;line-height:1.5">${esc(l)}</p>`).join('')}<p style="margin:24px 0"><a href="${a.link}" style="${BUTTON}">Choose your discounts</a></p><p style="${SMALL}">${esc(sign)}</p></div>`,
  }
}
