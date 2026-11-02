// "Tell Autinerary what you need" on My agents (backend core/agent_setup.py, POST /api/onboarding/agent-setup, or the
// device job agent-setup on the person's own model): what each built-in agent will do for them, and a 7th agent
// drafted for the rest, opened in Build an agent to check and save. What each of the six will do is kept in this
// browser, with what they asked, so My agents still says it next time.
import type { Agent, AgentScope } from './agents'
import type { AgentKey } from './agentInsights'

export type SetupGoal = { text: string; area: string }
export type SetupSeventh = { name: string; purpose: string; instructions: string; lens: string[]; sees: AgentScope[] }
export type SetupResult = { goal: SetupGoal | null; forYou: Partial<Record<AgentKey, string>>; seventh: SetupSeventh | null }
export type SavedSetup = { asked: string; goal: SetupGoal | null; forYou: Partial<Record<AgentKey, string>>; at: string }

export const SETUP_KEY = 'autinerary.agents.setup.v1'
export const MAX_ASK = 500

export function loadSetup(storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage): SavedSetup | null {
  try {
    const raw = JSON.parse(storage?.getItem(SETUP_KEY) || 'null')
    if (!raw || typeof raw !== 'object' || typeof raw.asked !== 'string' || typeof raw.forYou !== 'object') return null
    return raw as SavedSetup
  } catch {
    return null
  }
}

export function saveSetup(asked: string, result: SetupResult, storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage) {
  const saved: SavedSetup = { asked, goal: result.goal, forYou: result.forYou || {}, at: new Date().toISOString() }
  try { storage?.setItem(SETUP_KEY, JSON.stringify(saved)) } catch {}
  return saved
}

/** The drafted 7th, as an agent to check in Build an agent: on the device, like any new agent. Saving gives it an id. */
export function draftAgent(seventh: SetupSeventh): Agent {
  return {
    id: '', name: seventh.name, purpose: seventh.purpose, instructions: seventh.instructions, lens: [...seventh.lens],
    sees: [...seventh.sees], runsOn: 'device', createdAt: '', updatedAt: '', from: null, sharedId: null,
  }
}

/** Setup, starting with the goal they asked for: /onboarding?goal=…&area=… (app/onboarding/page.tsx). */
export function planLink(goal: SetupGoal): string {
  return `/onboarding?${new URLSearchParams({ goal: goal.text, area: goal.area })}`
}
