/**
 * Shared OpenAI client for ServiceHub agents.
 * Lazy singleton + graceful fallback when no API key is configured
 * or a network call fails. Callers should treat `null` as "use rules".
 */

import OpenAI from 'openai'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

let _client: OpenAI | null = null

export function isLLMEnabled(): boolean {
  return !!OPENAI_API_KEY
}

function getClient(): OpenAI | null {
  if (!OPENAI_API_KEY) return null
  if (_client) return _client
  try {
    _client = new OpenAI({ apiKey: OPENAI_API_KEY })
    return _client
  } catch (err) {
    console.warn('[llm] OpenAI client init failed:', err)
    return null
  }
}

/**
 * One-shot text completion. Returns null on failure or when disabled.
 */
export async function completeText(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  try {
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 400,
    })
    return (res.choices[0]?.message?.content ?? '').trim() || null
  } catch (err) {
    console.warn('[llm] text completion failed:', err)
    return null
  }
}

/**
 * One-shot JSON completion. Returns parsed object or null.
 */
export async function completeJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<T | null> {
  const client = getClient()
  if (!client) return null
  try {
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system + ' Respond ONLY with valid JSON.' },
        { role: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 800,
      response_format: { type: 'json_object' },
    })
    const content = res.choices[0]?.message?.content ?? ''
    if (!content) return null
    return JSON.parse(content) as T
  } catch (err) {
    console.warn('[llm] json completion failed:', err)
    return null
  }
}
