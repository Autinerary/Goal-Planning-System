'use client'

/**
 * Model harness preferences.
 *
 * The agents are fixed; the model behind each one is the user's choice. This
 * module stores that choice locally and shapes it into the `llm_config` /
 * `llmConfig` payload the backend expects.
 *
 * Stored client-side only: it is a preference, not a credential. API keys stay
 * on the server — the browser never sees or sends one.
 */

export type Effort = 'low' | 'medium' | 'high'

export type AgentChoice = {
  model?: string
  effort?: Effort
}

export type ModelPrefs = {
  model?: string
  effort: Effort
  agents: Record<string, AgentChoice>
}

export type CatalogueModel = {
  id: string
  label: string
  provider: string
  provider_label: string
  description: string
  native_reasoning: boolean
  available: boolean
}

export type Limits = {
  requests_per_minute: number
  tokens_per_day: number
  usd_per_day: number | null
  cost_tracking: boolean
  priced_models: string[]
  /** Set when MODEL_PRICING is present but unusable, so a typo is visible. */
  pricing_error: string | null
}

export type Usage = {
  requests_last_minute: number
  requests_per_minute_limit: number
  tokens_today: number
  tokens_per_day_limit: number
  tokens_remaining: number
  /** Null when the server has no configured prices — never a guessed figure. */
  usd_today: number | null
  usd_per_day_limit: number | null
  cost_tracking: boolean
  /** False when counts live only in process memory and reset on restart. */
  durable: boolean
}

export type Catalogue = {
  models: CatalogueModel[]
  efforts: { id: Effort; label: string; description: string }[]
  agents: { id: string; label: string }[]
  default_model: string | null
  default_effort: Effort
  any_available: boolean
  limits: Limits
}

const STORAGE_KEY = 'autinerary.modelPrefs.v1'

export const DEFAULT_PREFS: ModelPrefs = { effort: 'medium', agents: {} }

export function loadModelPrefs(): ModelPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw)
    return {
      model: typeof parsed?.model === 'string' ? parsed.model : undefined,
      effort: (['low', 'medium', 'high'] as const).includes(parsed?.effort)
        ? parsed.effort
        : 'medium',
      agents: parsed?.agents && typeof parsed.agents === 'object' ? parsed.agents : {},
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveModelPrefs(prefs: ModelPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    // Lets an open picker in another tab reflect the change.
    window.dispatchEvent(new CustomEvent('autinerary:model-prefs', { detail: prefs }))
  } catch {
    // A full or blocked localStorage must not break planning.
  }
}

/** Shape prefs into the request body field the backend parses. */
export function toLlmConfig(prefs: ModelPrefs = loadModelPrefs()) {
  const agents: Record<string, AgentChoice> = {}
  for (const [id, choice] of Object.entries(prefs.agents || {})) {
    if (choice?.model || choice?.effort) agents[id] = choice
  }
  return {
    model: prefs.model,
    effort: prefs.effort,
    agents,
  }
}

export async function fetchCatalogue(apiBase: string): Promise<Catalogue | null> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/models`)
    if (!res.ok) return null
    return (await res.json()) as Catalogue
  } catch {
    return null
  }
}

export async function fetchUsage(apiBase: string, accessToken?: string): Promise<Usage | null> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/models/usage`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!res.ok) return null
    return (await res.json()) as Usage
  } catch {
    return null
  }
}
