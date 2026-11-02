/**
 * Shared agents (backend api/routes/shared_agents.py, STEP 97): one of the person's own agents (lib/agents.ts),
 * shared with everyone, people they pick, or by private link; and others' agents, to run on their own plan or add to
 * their own. An agent is words, so what's shared is exactly what the person sees in the share panel: its name, what
 * it's for, its instructions, its norms and what it may see. Never who shared it.
 */
import type { Agent, AgentScope } from './agents'

export type Visibility = 'everyone' | 'people' | 'link'

export type SharedAgent = {
  id: string
  name: string
  purpose: string
  instructions: string
  lens: string[]
  sees: AgentScope[]
  createdAt: string
  visibility: Visibility
  rating: { average: number | null; count: number }
  /** The rating weighted towards people whose setup answers are like yours. */
  ratingForYou: number | null
  /** How much of this agent's community you're part of, and the norms you share with it. */
  match: { score: number; shared: string[] }
  myRating: number | null
  mine: boolean
  builtOn: { id: string; name: string | null } | null
  builtOnCount: number
}

export type ShareAgentRequest = {
  name: string
  purpose: string
  instructions: string
  lens: string[]
  sees: AgentScope[]
  visibility: Visibility
  people: string[]
  builtOn: string | null
}

export type MySharedAgent = { id: string; name: string; purpose: string; lens: string[]; status: string; visibility: Visibility;
  linkKey: string | null; people: { id: string; name: string }[]; builtOn: string | null; createdAt: string }

export type Check = { passed: boolean; why?: string; applies?: boolean; waiting?: boolean; [key: string]: unknown }
export type Checks = Partial<Record<'words' | 'rules' | 'harm' | 'crowd' | 'audience' | 'lineage', Check>>

/** What sharing sends: the agent's own words, who may see it, and the shared agent it was made from, if any. */
export function shareRequest(agent: Agent, visibility: Visibility, people: string[]): ShareAgentRequest {
  return {
    name: agent.name, purpose: agent.purpose, instructions: agent.instructions, lens: agent.lens, sees: agent.sees,
    visibility, people: visibility === 'people' ? people : [],
    builtOn: agent.from?.kind === 'community' && agent.from.id ? agent.from.id : null,
  }
}

/** Someone's shared agent as one of the person's own, to change as they like. It runs on their device unless they
 *  choose otherwise, and it remembers where it came from (so sharing it again names it). */
export function fromShared(shared: Pick<SharedAgent, 'id' | 'name' | 'purpose' | 'instructions' | 'lens' | 'sees'>, now = new Date()): Agent {
  return {
    id: '', name: shared.name, purpose: shared.purpose, instructions: shared.instructions, lens: [...shared.lens],
    sees: [...shared.sees], runsOn: 'device', createdAt: now.toISOString(), updatedAt: now.toISOString(),
    from: { kind: 'community', id: shared.id, name: shared.name }, sharedId: null,
  }
}

/** The address of an agent shared by private link. */
export const agentLinkFor = (origin: string, key: string): string =>
  `${origin.replace(/\/$/, '')}/agents/community?key=${encodeURIComponent(key)}`

export class ShareError extends Error {
  checks?: Checks
  constructor(message: string, checks?: Checks) {
    super(message)
    this.checks = checks
  }
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

async function call<T>(apiUrl: string, token: string | null, path: string, init: { method?: string; body?: unknown } = {},
                       fetchFn: FetchFn = fetch): Promise<T> {
  const res = await fetchFn(`${apiUrl.replace(/\/$/, '')}/api/shared-agents${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    cache: 'no-store',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = out?.detail
    if (detail && typeof detail === 'object') throw new ShareError(String(detail.message || 'That didn’t work.'), detail.checks)
    throw new ShareError(typeof detail === 'string' ? detail : 'That didn’t work. Please try again.')
  }
  return out as T
}

const withKey = (path: string, key?: string | null) => (key ? `${path}?key=${encodeURIComponent(key)}` : path)

export const sharedAgentsStatus = (apiUrl: string, fetchFn?: FetchFn) =>
  call<{ enabled: boolean; minCrowd: number }>(apiUrl, null, '/status', {}, fetchFn)
export const listSharedAgents = (apiUrl: string, token: string | null, fetchFn?: FetchFn) =>
  call<{ enabled: boolean; agents: SharedAgent[]; sharedWithMe: SharedAgent[]; forYou: boolean }>(apiUrl, token, '', {}, fetchFn)
export const agentByLink = (apiUrl: string, token: string | null, key: string, fetchFn?: FetchFn) =>
  call<{ agent: SharedAgent }>(apiUrl, token, `/link/${encodeURIComponent(key)}`, {}, fetchFn)
export const listAgentPeople = (apiUrl: string, token: string, fetchFn?: FetchFn) =>
  call<{ people: { id: string; name: string }[] }>(apiUrl, token, '/people', {}, fetchFn)
export const listMySharedAgents = (apiUrl: string, token: string, fetchFn?: FetchFn) =>
  call<{ agents: MySharedAgent[] }>(apiUrl, token, '/mine', {}, fetchFn)
export const checkSharedAgent = (apiUrl: string, token: string, request: ShareAgentRequest, fetchFn?: FetchFn) =>
  call<{ passed: boolean; checks: Checks }>(apiUrl, token, '/check', { body: request }, fetchFn)
export const shareAgent = (apiUrl: string, token: string, request: ShareAgentRequest, fetchFn?: FetchFn) =>
  call<{ id: string; status: string; visibility: Visibility; linkKey: string | null; checks: Checks }>(apiUrl, token, '', { body: request }, fetchFn)
export const changeSharedAgent = (apiUrl: string, token: string, id: string, request: ShareAgentRequest, fetchFn?: FetchFn) =>
  call<{ id: string; status: string; visibility: Visibility; linkKey: string | null; checks: Checks }>(apiUrl, token, `/${id}`, { method: 'PATCH', body: request }, fetchFn)
export const takeDownSharedAgent = (apiUrl: string, token: string, id: string, fetchFn?: FetchFn) =>
  call<{ deleted: boolean }>(apiUrl, token, `/${id}`, { method: 'DELETE' }, fetchFn)
export const rateSharedAgent = (apiUrl: string, token: string, id: string, rating: number, key?: string | null, fetchFn?: FetchFn) =>
  call<{ saved: boolean; rating: { average: number | null; count: number }; ratingForYou: number | null; myRating: number }>(
    apiUrl, token, withKey(`/${id}/rating`, key), { body: { rating } }, fetchFn)
export const reportSharedAgent = (apiUrl: string, token: string, id: string, reason: string, key?: string | null, fetchFn?: FetchFn) =>
  call<{ reported: boolean }>(apiUrl, token, withKey(`/${id}/report`, key), { body: { reason } }, fetchFn)
