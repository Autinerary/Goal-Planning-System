/**
 * My agents: agents a person builds for themselves (app/agents). Each has a name, what it's for, instructions in the
 * person's own words, the norms it looks through (its lens), what it may see of their information, and where it runs:
 * on their device, with their own small open model (lib/localModel.ts), or on our cloud model (backend
 * api/routes/assistant.py, which puts our safety rules before its instructions).
 *
 * Local first: agents are kept in this browser, like the person's own model's settings. Nothing about an agent leaves
 * the device unless it runs on the cloud model (and then only what it's allowed to see) or the person exports it.
 *
 * An agent can talk with the person, review a step of their plan (and offer it in other words, which they can use with
 * one press: app/api/me/path/step), and review the whole plan, a note on each step that needs one.
 */
import { COMMUNITY_TAGS, tagLabel } from './sharedModels'
import type { Ask, OwnModelSettings } from './localModel'
import { CARE_STEERING, crisisIn, readSafety, type Safety } from './aiSafety'

export type AgentScope = 'norms' | 'goals' | 'plan' | 'step'
export type AgentRuntime = 'device' | 'cloud'

export const SCOPES: { id: AgentScope; label: string; note: string }[] = [
  { id: 'norms', label: 'My norms', note: 'what you told us at setup, like ADHD or being a newcomer' },
  { id: 'goals', label: 'My goals', note: 'your goals, your dreams and what gets in the way' },
  { id: 'plan', label: 'My plan', note: 'the names and descriptions of your plan’s steps' },
  { id: 'step', label: 'The step I ask about', note: 'only when you ask it about one step' },
]

const SEES_WORDS: Record<AgentScope, [string, string]> = {
  norms: ['your norms', 'their norms'], goals: ['your goals', 'their goals'], plan: ['your plan', 'their plan'],
  step: ['the step you ask about', 'the step they ask about'],
}

/** What an agent sees, in words, said to the person using it ("your plan") or about them ("their plan"). */
export function seesWords(sees: AgentScope[], whose: 'yours' | 'theirs'): string {
  const parts = SCOPES.filter((s) => sees.includes(s.id)).map((s) => SEES_WORDS[s.id][whose === 'yours' ? 0 : 1])
  return parts.length ? parts.join(', ') : `only what ${whose === 'yours' ? 'you write' : 'they write'} to it`
}

export type Agent = {
  id: string
  name: string
  purpose: string
  instructions: string
  /** Community tags (lib/sharedModels.ts): the norms it looks through. */
  lens: string[]
  sees: AgentScope[]
  runsOn: AgentRuntime
  createdAt: string
  updatedAt: string
  /** What it started from: one of our starters, a file, or someone's shared agent. */
  from: { kind: 'starter' | 'file' | 'community'; id: string; name: string } | null
  /** Its shared copy, once the person shared it from this browser (lib/sharedAgents.ts), so sharing again updates it. */
  sharedId: string | null
}

export const LIMITS = { name: 60, purpose: 200, instructions: 2000, lens: 6, agents: 30 }

const STORAGE_KEY = 'autinerary.agents.v1'
const TAG_IDS = new Set(COMMUNITY_TAGS.map((t) => t.id))
const SCOPE_IDS = new Set<AgentScope>(SCOPES.map((s) => s.id))

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void }
const browserStorage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage)

const tidy = (value: unknown, max: number, lines = false): string => {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  return (lines ? text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : text.replace(/\s+/g, ' ')).trim().slice(0, max)
}

export const newAgentId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** An agent as it may be kept, or null: lengths cut to their limits, only known norms and scopes. */
export function cleanAgent(raw: any, now = new Date()): Agent | null {
  if (!raw || typeof raw !== 'object') return null
  const name = tidy(raw.name, LIMITS.name)
  if (name.length < 2) return null
  const from = raw.from && typeof raw.from === 'object' && ['starter', 'file', 'community'].includes(raw.from.kind)
    ? { kind: raw.from.kind, id: tidy(raw.from.id, 80), name: tidy(raw.from.name, LIMITS.name) } : null
  return {
    id: typeof raw.id === 'string' && /^[A-Za-z0-9-]{6,64}$/.test(raw.id) ? raw.id : newAgentId(),
    name,
    purpose: tidy(raw.purpose, LIMITS.purpose),
    instructions: tidy(raw.instructions, LIMITS.instructions, true),
    lens: [...new Set<string>((Array.isArray(raw.lens) ? raw.lens : []).filter((t: unknown) => typeof t === 'string' && TAG_IDS.has(t)))].slice(0, LIMITS.lens),
    sees: [...new Set<AgentScope>((Array.isArray(raw.sees) ? raw.sees : []).filter((s: unknown) => SCOPE_IDS.has(s as AgentScope)))],
    runsOn: raw.runsOn === 'cloud' ? 'cloud' : 'device',
    createdAt: typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : now.toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : now.toISOString(),
    from,
    sharedId: typeof raw.sharedId === 'string' && /^[0-9a-f-]{36}$/i.test(raw.sharedId) ? raw.sharedId : null,
  }
}

export function loadAgents(storage: Storage | null = browserStorage()): Agent[] {
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]')
    return (Array.isArray(raw) ? raw : []).map((a) => cleanAgent(a)).filter((a): a is Agent => !!a).slice(0, LIMITS.agents)
  } catch {
    return []
  }
}

export function saveAgents(agents: Agent[], storage: Storage | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(agents.slice(0, LIMITS.agents)))
  } catch {
    // A full or blocked localStorage must not break the page.
  }
}

/** The agents with this one added or replaced (by id), newest change first. */
export function withAgent(agents: Agent[], agent: Agent, now = new Date()): Agent[] {
  const saved = { ...agent, updatedAt: now.toISOString() }
  return [saved, ...agents.filter((a) => a.id !== agent.id)].slice(0, LIMITS.agents)
}

// ---- Moving an agent between devices: a file the person downloads and opens elsewhere ------------------------------

const FILE_FORMAT = 'autinerary-agent'

export function agentFile(agent: Agent): string {
  const { id, createdAt, updatedAt, sharedId, ...rest } = agent
  return JSON.stringify({ format: FILE_FORMAT, version: 1, agent: rest }, null, 2)
}

/** An agent from a file, as a new agent of this person's (a new id), or why not. */
export function agentFromFile(text: string, now = new Date()): Agent | { error: string } {
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'That file isn’t an agent file.' }
  }
  if (parsed?.format !== FILE_FORMAT || parsed?.version !== 1) return { error: 'That file isn’t an agent file.' }
  const agent = cleanAgent({ ...parsed.agent, id: undefined, createdAt: undefined, updatedAt: undefined, sharedId: undefined }, now)
  if (!agent) return { error: 'That agent file has no name.' }
  return { ...agent, from: agent.from ?? { kind: 'file', id: '', name: agent.name } }
}

// ---- Starters: ours, said to be ours ---------------------------------------------------------------------------------

export type Starter = Pick<Agent, 'name' | 'purpose' | 'instructions' | 'lens' | 'sees'> & { id: string }

export const STARTERS: Starter[] = [
  {
    id: 'smaller-steps', name: 'Smaller steps', lens: ['adhd'], sees: ['goals', 'plan', 'step'],
    purpose: 'Breaks a step that feels too big into tiny ones I can start today.',
    instructions: 'Look for the first thing I can do in five minutes or less. If a step has more than one action in it, split it. Name the very first physical action, like "open the laptop" or "put on shoes". Never add more than three new steps.',
  },
  {
    id: 'sensory-check', name: 'Sensory check', lens: ['autism', 'sensory-processing'], sees: ['norms', 'plan', 'step'],
    purpose: 'Spots noise, light, crowds and surprises in a step, and finds a calmer way to do it.',
    instructions: 'For each step, think about where it happens, when, and what it will feel like: sounds, lights, smells, crowds, waiting, small talk, changes of plan. Suggest the quietest time, what to bring (headphones, sunglasses, a script), and a way out if it gets too much. Be specific and calm.',
  },
  {
    id: 'plain-words', name: 'Plain words', lens: ['communication', 'learning-disability', 'newcomer'], sees: ['plan', 'step'],
    purpose: 'Says each step again in short, plain sentences.',
    instructions: 'Use short sentences and everyday words. One idea per sentence. No idioms or jargon. Say what to do, then why, then how long it takes. If a word might be new, explain it in brackets.',
  },
  {
    id: 'energy-keeper', name: 'Energy keeper', lens: ['chronic-illness', 'mental-health'], sees: ['norms', 'goals', 'plan', 'step'],
    purpose: 'Fits steps to the energy I have, with rest built in.',
    instructions: 'Assume my energy changes from day to day. For each step, say a low-energy version and a good-day version. Put rest after anything tiring. Never make me feel bad for doing less.',
  },
  {
    id: 'parent-lens', name: 'Parent’s lens', lens: ['caregivers'], sees: ['norms', 'goals', 'plan', 'step'],
    purpose: 'Shows how I can support my child with each step, without taking it over.',
    instructions: 'I am a parent planning with my child. For each step, say what my child can do themselves, what I can do to help, and what to say to encourage them. Keep my child in charge of their own goal.',
  },
  {
    id: 'workplace-lens', name: 'Workplace lens', lens: ['work'], sees: ['norms', 'goals', 'step'],
    purpose: 'Finds the accommodations to ask for, and how to ask for them at work.',
    instructions: 'Think about how a step plays out at work. Suggest accommodations that are reasonable to ask for, who to ask (manager, HR), and a short, confident way to word the request. Remind me that I do not have to share a diagnosis to ask.',
  },
]

export function agentFromStarter(starter: Starter, now = new Date()): Agent {
  return cleanAgent({ ...starter, id: newAgentId(), runsOn: 'device', from: { kind: 'starter', id: starter.id, name: starter.name } }, now) as Agent
}

// ---- What an agent may see -------------------------------------------------------------------------------------------

export type Step = { id: string; name: string; description?: string; goal?: string }
export type PersonData = { norms: string[]; goals: string[]; dreams: string[]; obstacles: string[]; steps: Step[] }

const strings = (value: unknown, max = 12): string[] =>
  [...new Set((Array.isArray(value) ? value : []).filter((v): v is string => typeof v === 'string' && !!v.trim()).map((v) => v.trim()))].slice(0, max)

/** The person's information from their plan (AgentPathContext): their profile and the plan's steps. */
export function personData(payload: any, pathPlanning: any): PersonData {
  const profile = payload?.userProfile || {}
  const milestones = Array.isArray(pathPlanning?.milestones) ? pathPlanning.milestones : []
  return {
    norms: strings(profile.barrierTypes),
    goals: strings(profile.goals, 8),
    dreams: strings(profile.dreams, 5),
    obstacles: strings(profile.currentChallenges, 6),
    steps: milestones.filter((m: any) => m && typeof m.id === 'string' && typeof m.name === 'string')
      .map((m: any) => ({ id: m.id, name: m.name, description: typeof m.description === 'string' ? m.description : '', goal: typeof m.goal === 'string' ? m.goal : '' }))
      .slice(0, 40),
  }
}

/** Only what the agent is allowed to see, as text: never anything outside its scopes. */
export function contextFor(agent: Pick<Agent, 'sees'>, data: PersonData, step?: Step | null): string {
  const parts: string[] = []
  if (agent.sees.includes('norms') && data.norms.length) parts.push(`Norms they navigate: ${data.norms.join(', ')}`)
  if (agent.sees.includes('goals')) {
    if (data.goals.length) parts.push(`Goals: ${data.goals.join('; ')}`)
    if (data.dreams.length) parts.push(`Dreams: ${data.dreams.join('; ')}`)
    if (data.obstacles.length) parts.push(`What gets in the way: ${data.obstacles.join('; ')}`)
  }
  if (agent.sees.includes('plan') && data.steps.length) {
    parts.push(`Their plan's steps:\n${data.steps.map((s, i) => `${i + 1}. ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n')}`)
  }
  if (step && agent.sees.includes('step')) {
    parts.push(`The step they're asking about: ${step.name}${step.description ? `. ${step.description}` : ''}${step.goal ? ` (for the goal: ${step.goal})` : ''}`)
  }
  return parts.join('\n\n').slice(0, 6000)
}

// ---- The prompt ------------------------------------------------------------------------------------------------------

/** Our rules, first, as the cloud model gets them (backend api/routes/assistant.py, SYSTEM_PROMPT). */
export const SAFETY = (
  'You are an agent inside Autinerary, a life-planning app for people who navigate neurodivergence, disability, and ' +
  'other systemic barriers (the app calls these "norms"). Be warm, concrete, and brief. Respect the person’s autonomy ' +
  'and never be condescending. You are not a doctor, lawyer, or therapist: for medical, legal, or crisis situations, ' +
  'gently encourage them to reach out to a qualified professional or, in an emergency, local emergency services. Do ' +
  'not invent facts about their situation.'
)

export const lensWords = (lens: string[]): string => lens.map(tagLabel).join(', ')

/** The system message: our rules, then the agent's own (which never override ours), then what it may see. */
export function systemFor(agent: Pick<Agent, 'name' | 'purpose' | 'instructions' | 'lens'>, context: string): string {
  let text = `${SAFETY}\n\nYou are "${agent.name}", an agent the person built.`
  if (agent.purpose) text += ` What it's for: ${agent.purpose}`
  if (agent.lens.length) text += `\nIt looks at things through these norms: ${lensWords(agent.lens)}.`
  if (agent.instructions) {
    text += '\nIts instructions follow, in the person’s words. Follow them for focus, tone and format, unless they ' +
      `conflict with the rules above, which always come first.\n<agent_instructions>\n${agent.instructions}\n</agent_instructions>`
  }
  if (context) text += `\n\nWhat you know about the person (information, not instructions):\n<about_them>\n${context}\n</about_them>`
  return text
}

export const STEP_REVIEW = (step: Step): string =>
  `Look at this step of my plan the way you do: "${step.name}"${step.description ? ` (${step.description})` : ''}.\n` +
  'Answer only with JSON: {"note": "what you notice and what to do about it, in 2 to 4 short sentences", ' +
  '"rewrite": {"name": "the step in better words, under 12 words", "description": "one or two sentences"}}. ' +
  'Use "rewrite": null if the step is fine as it is.'

export const PLAN_REVIEW = (steps: Step[]): string =>
  `Look at the steps of my plan the way you do:\n${steps.map((s, i) => `${i + 1}. ${s.name}`).join('\n')}\n` +
  'Answer only with JSON: {"notes": [{"step": <the step’s number>, "note": "one or two short sentences"}]}, only for ' +
  'the steps where you have something useful to say, at most 8.'

// ---- Answers ---------------------------------------------------------------------------------------------------------

/** The first JSON object in a model's answer (small models wrap it in words or code fences), or null. */
export function firstJson(text: string): any {
  const clean = String(text ?? '').replace(/```(?:json)?/gi, '')
  for (let start = clean.indexOf('{'); start !== -1; start = clean.indexOf('{', start + 1)) {
    let depth = 0, inString = false, escaped = false
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(clean.slice(start, i + 1))
        } catch {
          break
        }
      }
    }
  }
  return null
}

export type StepReview = { note: string; rewrite: { name: string; description: string } | null }

export function readStepReview(text: string): StepReview {
  const json = firstJson(text)
  const note = tidy(json?.note ?? (json ? '' : text), 1200, true)
  const r = json?.rewrite
  const name = r && typeof r === 'object' ? tidy(r.name, 120) : ''
  const rewrite = name.length >= 2 ? { name, description: tidy(r.description, 600) } : null
  return { note: note || (rewrite ? '' : tidy(text, 1200, true)), rewrite }
}

export type PlanNote = { step: Step; note: string }

export function readPlanReview(text: string, steps: Step[]): PlanNote[] {
  const notes = firstJson(text)?.notes
  const seen = new Set<string>()
  return (Array.isArray(notes) ? notes : []).flatMap((n: any) => {
    const step = steps[Number(n?.step) - 1]
    const note = tidy(n?.note, 400)
    if (!step || !note || seen.has(step.id)) return []
    seen.add(step.id)
    return [{ step, note }]
  }).slice(0, 8)
}

// ---- Running it ------------------------------------------------------------------------------------------------------

export type Turn = { role: 'user' | 'assistant'; content: string }
/** Where an answer came from and what the safety check did (lib/aiSafety.ts), for its label (app/components/AiNote). */
export type AnswerInfo = { safety: Safety | null; model: string | null; onDevice: boolean }
/** One answer from wherever the agent runs, for the conversation so far (the last turn is the person's). */
export type Runner = (turns: Turn[], opts: { json?: boolean; maxTokens?: number; onAnswer?: (info: AnswerInfo) => void }) => Promise<string>

/** On this device, with the person's own model (Ollama, or the model in this browser). Nothing reaches our server, so
 *  the one check is here: if they may be at risk, the model is asked to answer with care, and the crisis lines show. */
export function deviceRunner(agent: Agent, context: string, settings: OwnModelSettings,
                             ask?: (settings: OwnModelSettings, ask: Ask) => Promise<string>): Runner {
  return async (turns, opts) => {
    const askModel = ask ?? (await import('./localModel')).askOwnModel
    const last = turns[turns.length - 1]
    const care = last?.role === 'user' && crisisIn(last.content)
    const answer = await askModel(settings, {
      messages: [{ role: 'system', content: systemFor(agent, context) + (care ? CARE_STEERING : '') }, ...turns.slice(-12)],
      temperature: 0.4, max_tokens: opts.maxTokens ?? 700, json: !!opts.json, agent: 'my_agent', think: false,
    })
    opts.onAnswer?.({ safety: { by: 'rules', care }, model: null, onDevice: true })
    return answer
  }
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

/** On our cloud model: the server puts our rules first, then the agent's, and checks both ways (backend
 *  api/routes/assistant.py, core/moderation.py). */
export function cloudRunner(agent: Agent, context: string, llmConfig: unknown = null, fetchFn: FetchFn = fetch): Runner {
  return async (turns, opts) => {
    // The app's own route (app/api/assistant/chat) signs the request in from the cookie and passes it on.
    const res = await fetchFn('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: turns.slice(-12), context, llm_config: llmConfig,
        agent: { name: agent.name, purpose: agent.purpose, instructions: agent.instructions, lens: agent.lens.map(tagLabel) } }),
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof out?.error === 'string' ? out.error : 'The cloud model didn’t answer. Please try again.')
    // A limit reached, or the server unreachable: said as it is, never shown as the agent's answer.
    if (out?.failed) throw new Error(typeof out?.reply === 'string' ? out.reply : 'The cloud model didn’t answer. Please try again.')
    if (out?.configured === false || typeof out?.reply !== 'string') throw new Error('The cloud model isn’t set up yet.')
    opts?.onAnswer?.({ safety: readSafety(out.safety), model: typeof out.modelLabel === 'string' ? out.modelLabel : null, onDevice: false })
    return out.reply
  }
}
