/**
 * Automatic moderation for Tidbits (the Tidbits round's planning note, Goal 6:
 * "an algorithm that automatically filters out & flags swear words ... must
 * be automatically censored ... (bleep) ... slurs ... anything else
 * unacceptable").
 *
 * - Slurs are refused before anything is saved: the writer is told which rule
 *   and asked to change it. Not a word is kept.
 * - Swear words are bleeped: "(bleep)" in place of the word, so the post still
 *   reads. Spellings that dodge a filter (f*ck, sh1t, f.u.c.k) are caught too.
 * - Everything else ("anything else unacceptable": threats, harassment,
 *   hate, self-harm) goes to OpenAI's moderation check when the server has a
 *   key; anything it flags is published but marked for a moderator
 *   (community_posts.auto_flag, STEP 83), and self-harm gets a content note.
 *
 * The slur list is kept encoded (base64), so it doesn't sit in the code as
 * plain text; decode it to review or change it.
 */

const SLURS = new Set(Buffer.from('Y2hpbmsKY29vbgpkeWtlCmZhZwpmYWdnb3QKZmFncwpnb29rCmtpa2UKbW9uZ29sb2lkCm5pZ2dhCm5pZ2dhcwpuaWdnZXIKbmlnZ2VycwpwYWtpCnJhZ2hhZWQKcmVkc2tpbgpyZXRhcmQKcmV0YXJkZWQKcmV0YXJkcwpzaGVtYWxlCnNwYXN0aWMKc3BhegpzcGljCnNxdWF3CnRhcmQKdG93ZWxoZWFkCnRyYWFueQp3ZXRiYWNr', 'base64').toString('utf8').split('\n'))

// Swear words and the ways people spell around a filter. A word matches when,
// lowercased with look-alike numbers and symbols read as letters and anything
// else taken out, it starts with one of these and ends with a usual ending.
const SWEARS = ['fuck', 'fuk', 'fck', 'fuq', 'phuck', 'motherfuck', 'shit', 'bullshit', 'bitch', 'biatch', 'asshole', 'arsehole', 'bastard',
  'cunt', 'dickhead', 'twat', 'wanker', 'bollocks', 'slut', 'whore', 'jackass', 'dumbass', 'goddamn']
const ENDINGS = /^(s|es|ed|er|ers|ing|in|y|ty|tier|ties|head|heads|face|hole|holes)?$/

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '*': 'u' }

/** A word as a filter should read it: lowercase, look-alikes as letters, nothing else. */
function squash(word: string): string {
  return word
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '')
}

function isSwear(word: string): boolean {
  const w = squash(word)
  if (w.length < 3) return false
  return SWEARS.some((s) => w.startsWith(s) && ENDINGS.test(w.slice(s.length)))
    // "f*ck": the star stands for the vowel.
    || SWEARS.some((s) => w.replace(/u/g, '') === s.replace(/u/g, '') && s.includes('u') && w.length === s.length)
}

function isSlur(word: string): boolean {
  const w = squash(word)
  return w.length >= 3 && (SLURS.has(w) || SLURS.has(w.replace(/s$/, '')))
}

// The words of a text with what lies between them, so it can be put back together exactly.
const TOKENS = /([^\s]+)/g

export interface ModerationResult {
  /** The text with swear words bleeped. */
  text: string
  /** How many words were bleeped. */
  bleeped: number
  /** True when the text has a slur: refuse it. */
  slur: boolean
}

/** Bleep swear words; say whether there is a slur. */
export function moderateText(text: string): ModerationResult {
  let bleeped = 0
  let slur = false
  const out = text.replace(TOKENS, (token) => {
    // Keep the punctuation around a word ("(fuck)," -> "((bleep)),"). At a
    // word's edges "!" and "*" are punctuation ("fuck!", markdown's
    // "**fuck**"); inside it they stand for letters ("sh!t", "f*ck").
    const m = token.match(/^([^A-Za-z0-9@$+]*)(.*?)([^A-Za-z0-9@$+]*)$/)
    const core = m ? m[2] : token
    if (!core) return token
    if (isSlur(core)) {
      slur = true
      return token
    }
    if (isSwear(core)) {
      bleeped++
      return `${m ? m[1] : ''}(bleep)${m ? m[3] : ''}`
    }
    return token
  })
  return { text: out, bleeped, slur }
}

/** The same for several fields at once (title, body, highlights). */
export function moderateFields<T extends Record<string, string | null | undefined>>(fields: T): { fields: T; bleeped: number; slur: boolean } {
  let bleeped = 0
  let slur = false
  const out = { ...fields }
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== 'string' || !v) continue
    const r = moderateText(v)
    bleeped += r.bleeped
    slur = slur || r.slur
    ;(out as Record<string, string | null | undefined>)[k] = r.text
  }
  return { fields: out, bleeped, slur }
}

export const SLUR_MESSAGE =
  'This has a slur in it, and Tidbits doesn’t allow slurs (community rule 2). Please change that word and try again.'

export interface ReviewFlag {
  /** Mark it for a moderator ('review'), with what was found. */
  flag: 'review' | null
  reason: string | null
  selfHarm: boolean
}

/**
 * OpenAI's moderation check (free, no text kept by Autinerary), when the
 * server has OPENAI_API_KEY. Never blocks: a failure or a slow answer means
 * no flag, and the community's Report button and moderators remain.
 */
export async function reviewFlag(text: string): Promise<ReviewFlag> {
  const key = process.env.OPENAI_API_KEY
  if (!key || !text.trim()) return { flag: null, reason: null, selfHarm: false }
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text.slice(0, 20000) }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return { flag: null, reason: null, selfHarm: false }
    const json = await res.json()
    const r = json?.results?.[0]
    if (!r?.flagged) return { flag: null, reason: null, selfHarm: false }
    const cats = Object.entries(r.categories || {}).filter(([, v]) => v).map(([k]) => k)
    return { flag: 'review', reason: `Automatic check: ${cats.join(', ')}`.slice(0, 300), selfHarm: cats.some((c) => c.startsWith('self-harm')) }
  } catch {
    return { flag: null, reason: null, selfHarm: false }
  }
}
