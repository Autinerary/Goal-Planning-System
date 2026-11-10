/**
 * The safety check, as the browser sees it (backend core/moderation.py; docs/ai-moderation.md).
 *
 * The server checks what goes to a cloud model and says what it did in each answer's `safety`. Here: the words for
 * the label on every AI answer (app/components/AiNote.tsx), and the one check the browser runs itself, for an agent on
 * the person's own device and for the help chat, where nothing reaches our server's check: a sign that someone may be
 * in danger, so the crisis lines are shown and the model is asked to answer with care. Plain data; the rules' patterns
 * are the server's (lib/checkerPolicy.ts).
 */
import { CHECKER_POLICY } from './checkerPolicy'

/** What the server's check did for one answer (backend core/moderation.py, for_screen). */
export type Safety = {
  /** "openai": our checker and OpenAI's moderation service, and our rules; "device": the checker on the person's own
   *  model, on their device, and our rules; "rules": our rules only; "unavailable": OpenAI didn't answer, so our rules
   *  only. */
  by: 'openai' | 'device' | 'rules' | 'unavailable'
  /** Someone may be at risk: show the crisis lines. */
  care?: boolean
  /** Kinds of personal details hidden from the AI: email, phone, id_number, address, password. */
  hidden?: string[]
  rewritten?: boolean
  dropped?: boolean
}

export function readSafety(raw: unknown): Safety | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const by = s.by === 'openai' || s.by === 'device' || s.by === 'rules' || s.by === 'unavailable' ? s.by : null
  if (!by) return null
  return {
    by,
    care: s.care === true,
    hidden: Array.isArray(s.hidden) ? s.hidden.filter((k): k is string => typeof k === 'string').slice(0, 6) : [],
    rewritten: s.rewritten === true,
    dropped: s.dropped === true,
  }
}

// ---- Our rules, in the person's own words --------------------------------------------------------------------------

// The server's own patterns (backend core/moderation.py: CRISIS, SETS_RULES_ASIDE, SCAM), generated into
// lib/checkerPolicy.ts, so the two can't drift; held to the same phrases (backend/tests/crisis_phrases.json and
// rule_phrases.json). "This is killing me" and "I want to die of embarrassment" are not crises.
const CRISIS: RegExp[] = CHECKER_POLICY.rules.crisis.map((p) => new RegExp(p, 'i'))
const SETS_RULES_ASIDE = new RegExp(CHECKER_POLICY.rules.setsRulesAside, 'i')
const SCAM = new RegExp(CHECKER_POLICY.rules.scam, 'i')

/** Phones type curly apostrophes ("don’t"): read them as straight ones. */
const plain = (text: string) => String(text ?? '').replace(/[’‘ʼ]/g, "'")

/** True when the words sound like someone may be in danger. */
export function crisisIn(text: string): boolean {
  const words = plain(text)
  return CRISIS.some((re) => re.test(words))
}

/** Something to answer carefully: the AI asked to set its rules aside, or the shape of a scam. */
export function steerIn(text: string): 'jailbreak' | 'exploitation' | null {
  const words = plain(text)
  if (SETS_RULES_ASIDE.test(words)) return 'jailbreak'
  if (SCAM.test(words)) return 'exploitation'
  return null
}

/** Added to an agent's rules on the person's own device when they may be at risk (the server's words, steering). */
export const CARE_STEERING =
  '\n\nA note for this reply only, from Autinerary\'s safety check (the person doesn\'t see it): they may be at risk. ' +
  'Reply warmly and briefly: thank them for telling you, say it matters, and that they can talk to someone right now: ' +
  'text or call 9-8-8 (the Suicide Crisis Helpline, any time), or call 911 if they or someone else is in danger now. If ' +
  'it\'s about someone else, help them support that person and share the same lines. Don\'t ask probing questions, ' +
  'don\'t diagnose, don\'t lecture, and don\'t promise what you can\'t do. If they asked for something else too, help ' +
  'with it simply. Say you\'re here to keep going whenever they\'re ready.'

/** The help chat's answer when someone may be in danger: the crisis lines, and no AI (as setup does). */
export const HELP_CARE_REPLY =
  'It sounds like things may be really hard right now, and that matters. You don’t have to work this out alone: you ' +
  'can text or call 9-8-8 any time to talk to someone, or call 911 if you or someone else is in danger now. The lines ' +
  'are below.'

// ---- The words on an AI answer --------------------------------------------------------------------------------------

const KIND_WORDS: Record<string, string> = {
  email: 'email address', phone: 'phone number', id_number: 'ID number', address: 'address', password: 'password',
}

/** "the phone number and email address" */
export function hiddenWords(kinds: string[]): string {
  const words = Array.from(new Set(kinds.map((k) => KIND_WORDS[k] ?? 'personal details')))
  if (!words.length) return ''
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
  return `the ${list}`
}

/** Shown once, above the input, after a message had personal details in it. */
export function hiddenNotice(kinds: string[]): string {
  const what = hiddenWords(kinds)
  return what ? `We hid ${what} in your message from the AI. It answered the rest.` : ''
}

/** Where an answer came from, for its label. */
export type AnswerSource = {
  /** The model's name ("GPT-4o mini"), or how it ran ("your own model on this device"). */
  model?: string | null
  /** One of the person's agents. */
  agent?: string | null
  /** Ran on the person's own device, in this browser or Ollama: our server never saw it. */
  onDevice?: boolean
}

/** The lines of "About this answer", in order. */
export function aboutAnswer(source: AnswerSource, safety: Safety | null): string[] {
  const lines: string[] = []
  const model = source.model ? ` (${source.model})` : ''
  lines.push(source.agent
    ? `Written by AI${model} for your agent “${source.agent}”, from its instructions and what you wrote.`
    : `Written by AI${model}, from what you wrote${source.onDevice ? '' : ' and what you chose to share'}.`)
  if (safety?.by === 'device') {
    lines.push('It was checked for safety before you saw it, on your own device, by your own model: your words didn’t go anywhere else. A model on a phone or laptop catches a little less than our check in the cloud.')
  } else if (source.onDevice) {
    lines.push('It ran on your own device, and only our own rules checked it there: your words didn’t go anywhere else. If a message sounds like you may be in danger, the crisis lines are still shown.')
  } else if (safety?.by === 'openai') {
    lines.push('It was checked for safety before you saw it.')
  } else if (safety?.by === 'rules') {
    lines.push('Only our own rules checked it, because your words went to your own model and nowhere else.')
  } else if (safety?.by === 'unavailable') {
    lines.push('The safety check couldn’t run this time, so only our own rules checked it.')
  }
  if (safety?.hidden?.length) lines.push(`${hiddenWords(safety.hidden).replace(/^the /, 'Your ')} ${safety.hidden.length === 1 ? 'was' : 'were'} hidden from the AI.`)
  lines.push('AI can be wrong, so check anything important. It isn’t medical, legal or clinical advice.')
  return lines
}

/** The one-time notice before someone's first AI chat (app/components/AiChatNotice.tsx). */
export const NOTICE_KEY = 'autinerary_ai_notice_seen'

// ---- The team's counts (STEP 101, ai_safety_events; app/admin/ai-safety) ------------------------------------------

/** One line of ai_safety_events: what the check found and did, with no words and no account. */
export type SafetyEvent = {
  created_at: string
  surface: string
  direction: string
  severity: number
  category: string
  action: string
  checked_by: string
  hidden: string[] | null
}

/** What the check did, in the team's words, in the order shown. "unchecked": OpenAI's service didn't answer. */
export const ACTION_WORDS: [string, string][] = [
  ['care', 'Answered with care, crisis lines shown'],
  ['steer', 'Answered with a note to the AI (something risky asked)'],
  ['hide', 'Personal details hidden from the AI'],
  ['rewritten', 'Answer failed the check, written again'],
  ['dropped', 'Answer failed twice, not shown'],
  ['unchecked', 'Couldn’t run (our rules only)'],
]

export const CATEGORY_WORDS: Record<string, string> = {
  care: 'May be at risk', personal_info: 'Personal details', sexual: 'Sexual content', violence: 'Violence',
  hate_harassment: 'Hate or harassment', dangerous: 'Serious harm or crime', jailbreak: 'Getting around the rules',
  exploitation: 'A possible scam', medical_advice: 'Medical advice (in an answer)', none: 'Nothing',
}

export type WeekCounts = { start: string; care: number; steer: number; hide: number; answers: number; unchecked: number }
export type SafetySummary = {
  total: number
  byAction: Record<string, number>
  byCategory: Record<string, number>
  bySurface: Record<string, number>
  hidden: Record<string, number>
  weeks: WeekCounts[]
}

const actionOf = (e: SafetyEvent) => (e.checked_by === 'unavailable' && e.action === 'allow' ? 'unchecked' : e.action)

/** The Monday a day falls in, as YYYY-MM-DD (UTC). */
function mondayOf(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Counts by what was done, what was found, where, and week by week (the last `weeks` weeks, newest first). */
export function summarise(events: SafetyEvent[], now: Date, weeks = 8): SafetySummary {
  const add = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }
  const out: SafetySummary = { total: 0, byAction: {}, byCategory: {}, bySurface: {}, hidden: {}, weeks: [] }
  const starts: string[] = []
  for (let i = 0; i < weeks; i++) starts.push(mondayOf(new Date(now.getTime() - i * 7 * 864e5)))
  const byWeek = new Map(starts.map((s) => [s, { start: s, care: 0, steer: 0, hide: 0, answers: 0, unchecked: 0 } as WeekCounts]))
  for (const e of events) {
    const action = actionOf(e)
    out.total++
    add(out.byAction, action)
    if (e.category !== 'none') add(out.byCategory, e.category)
    add(out.bySurface, e.surface)
    for (const k of e.hidden ?? []) add(out.hidden, k)
    const week = byWeek.get(mondayOf(new Date(e.created_at)))
    if (!week) continue
    if (action === 'care') week.care++
    else if (action === 'steer') week.steer++
    else if (action === 'hide') week.hide++
    else if (action === 'rewritten' || action === 'dropped') week.answers++
    else if (action === 'unchecked') week.unchecked++
  }
  out.weeks = starts.map((s) => byWeek.get(s)!)
  return out
}
