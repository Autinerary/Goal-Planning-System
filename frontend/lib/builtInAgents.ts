// The six agents built into every plan (backend core/built_in_agents.py), shown on My agents beside the ones a
// person builds: what each does, what it looks at, and the instructions it gives the model, read from its code.
// built-in-agents.json is written by `./venv/bin/python -m core.built_in_agents --write` in backend/, and the
// backend's tests fail if it no longer matches the agents' code.
import data from './built-in-agents.json'
import type { AgentKey } from './agentInsights'

export type BuiltInAgent = {
  number: number
  id: AgentKey
  name: string
  does: string
  looksAt: string
  /** Why it gives a model no instructions, when it gives none. */
  note: string
  prompts: { label: string; text: string }[]
}

export const BUILT_IN_AGENTS: BuiltInAgent[] = data.agents as BuiltInAgent[]

/** An instruction split into the words sent as they are and the parts filled in for each plan (‹…›, [When …:]). */
export function promptParts(text: string): { text: string; filled: boolean }[] {
  const parts: { text: string; filled: boolean }[] = []
  const pattern = /‹[^›]*›|\[[A-Z][^\]]*:\]/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) parts.push({ text: text.slice(last, match.index), filled: false })
    parts.push({ text: match[0], filled: true })
    last = match.index! + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), filled: false })
  return parts
}
