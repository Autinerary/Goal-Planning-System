/**
 * The safety check, as the browser sees it (backend core/moderation.py; docs/ai-moderation.md).
 *
 * The server checks what goes to a cloud model and says what it did in each answer's `safety`. Here: the words for
 * the label on every AI answer (app/components/AiNote.tsx), and the one check the browser runs itself, for an agent on
 * the person's own device and for the help chat, where nothing reaches our server's check: a sign that someone may be
 * in danger, so the crisis lines are shown and the model is asked to answer with care. Plain data, no imports.
 */

/** What the server's check did for one answer (backend core/moderation.py, for_screen). */
export type Safety = {
  /** "openai": OpenAI's moderation service and our rules; "rules": our rules only (the person's own model, or ours);
   *  "unavailable": OpenAI's service didn't answer, so our rules only. */
  by: 'openai' | 'rules' | 'unavailable'
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
  const by = s.by === 'openai' || s.by === 'rules' || s.by === 'unavailable' ? s.by : null
  if (!by) return null
  return {
    by,
    care: s.care === true,
    hidden: Array.isArray(s.hidden) ? s.hidden.filter((k): k is string => typeof k === 'string').slice(0, 6) : [],
    rewritten: s.rewritten === true,
    dropped: s.dropped === true,
  }
}

// ---- Danger, in the person's own words ------------------------------------------------------------------------------

// The same phrases as the server's (backend core/moderation.py, CRISIS), held to one list in
// backend/tests/crisis_phrases.json. "This is killing me" and "I want to die of embarrassment" are not here.
const RELATIONS = '(?:partner|boyfriend|girlfriend|husband|wife|ex|dad|father|mom|mum|mother|parent|parents|' +
  'step-?(?:dad|mom|mum|father|mother)|brother|sister|roommate|caregiver|support\\s+worker|landlord|boss|guardian|uncle|' +
  'aunt|grandpa|grandma)'
const CRISIS: RegExp[] = [
  /\b(?:kill(?:ing)?|hurt(?:ing)?|harm(?:ing)?|cut(?:ting)?|hang(?:ing)?|shoot(?:ing)?|starv(?:e|ing)|burn(?:ing)?)\s+myself\b/i,
  /\b(?:end|take|ending|taking)\s+my\s+(?:own\s+)?life\b|\bcommit(?:ting)?\s+suicide\b|\bsuicidal\b/i,
  /\bwant(?:ed)?\s+to\s+die\b(?!\s+(?:of|from|laughing|with|in\s+peace))/i,
  /\b(?:do\s*n[o']?t|don't|dont)\s+want\s+to\s+(?:live|be\s+alive|exist|wake\s+up|be\s+here\s+any\s*more)/i,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b|\bno\s+reason\s+to\s+(?:live|keep\s+going|go\s+on)\b|\bend\s+it\s+all\b|\bwish\s+i\s+(?:was|were)\s+dead\b/i,
  /\bi(?:'m|\s+am|'ve\s+been|\s+have\s+been)?\s+(?:been\s+)?self[\s-]?harm(?:ing)?\b/i,
  /\b(?:took|take|taking|taken)\s+an?\s+overdose\b|\boverdos(?:e|ed|ing)\s+on\s+purpose\b/i,
  new RegExp(`\\b(?:my\\s+)?${RELATIONS}\\s+(?:hits|hit|hurts|beats|beat|chokes|choked|kicks|slaps|punches|threatens\\s+to\\s+(?:hurt|kill))\\s+me\\b`, 'i'),
  new RegExp(`\\b(?:my\\s+)?${RELATIONS}\\s+(?:takes|took|keeps|steals|stole)\\s+(?:all\\s+)?my\\s+(?:money|odsp|cheque|check|paycheque|paycheck|benefits?|bank\\s+card)\\b`, 'i'),
  /\b(?:scared|afraid|terrified)\s+to\s+go\s+home\b|\bnot\s+safe\s+at\s+home\b/i,
  /\b(?:nobody|no\s?one)\s+would\s+(?:care|notice|miss\s+me)\s+if\s+i\b/i,
  /\bi(?:'ve|\s+have)?\s+(?:already\s+|just\s+)?(?:wrote|written|writing|write)\s+(?:my\s+|a\s+|some\s+)?(?:goodbye|good-bye|suicide)\s+(?:letters?|notes?)\b/i,
  // Someone they're worried about: the answer helps them support that person, with the same lines.
  /\b(?:she|he|they|my\s+\w+)\s+(?:wants?|wanted|is\s+going|was\s+going|plans?|planning|tried|is\s+trying|talks?\s+about\s+wanting|keeps?\s+saying\s+(?:she|he|they)\s+wants?)\s+to\s+(?:kill\s+(?:herself|himself|themselves|themself)|end\s+(?:her|his|their)\s+(?:own\s+)?life)\b/i,
]

/** True when the words sound like someone may be in danger. Phones type curly apostrophes ("don’t"). */
export function crisisIn(text: string): boolean {
  const words = String(text ?? '').replace(/[’‘ʼ]/g, "'")
  return CRISIS.some((re) => re.test(words))
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
  if (source.onDevice) {
    lines.push('It ran on your own device, so your words didn’t go to our safety check or anywhere else. If a message sounds like you may be in danger, the crisis lines are still shown.')
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
