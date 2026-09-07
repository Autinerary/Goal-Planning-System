import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bulk-import/parse — freeform text in, structured items out.
 *
 * Odosa: "dump a list of recommended milestones & resources in a list, bullet
 * points, or really whatever format works, as long as it's text."
 *
 * Nothing is written here. This returns candidates for the user to correct,
 * which is the explicit requirement — the commit route is separate.
 *
 * The category and dimension vocabularies are read from the LIVE database and
 * passed into the prompt, then re-validated against that same list on the way
 * out. A model asked to classify freely will happily invent a plausible
 * category, and a suggestion filed under a category that does not exist is
 * invisible forever.
 */

const MODELS = [
  process.env.OPENAI_PARSE_MODEL,
  'gpt-4o-mini',
  'gpt-4o',
].filter(Boolean) as string[]

// Matches CategorySelect in ServiceHub — a resource must land in a category
// the rest of the app can actually filter on.
const RESOURCE_CATEGORIES = [
  'therapist', 'school', 'doctor', 'park', 'store', 'app', 'book',
  'support_group', 'organization', 'workshop', 'recreation', 'other',
] as const

// Matches the path planner's dimension keys.
const DIMENSIONS = ['education', 'workplace', 'relationships', 'health', 'barrier'] as const

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Bulk import is not configured. Set OPENAI_API_KEY.', code: 'no_api_key' },
      { status: 503 }
    )
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = String(body?.text || '').trim()
  if (text.length < 10) {
    return NextResponse.json({ error: 'Paste a list first.' }, { status: 400 })
  }
  // A cap that fits a long list but not a pasted book — the model call is
  // billed per token and a runaway paste is the obvious way to burn money.
  if (text.length > 20000) {
    return NextResponse.json(
      { error: 'That list is too long. Split it into a few smaller pastes.' },
      { status: 413 }
    )
  }

  // Real categories, from the database, not a hardcoded list that drifts.
  const { data: catRows } = await supabase
    .from('path_categories')
    .select('key, title')
    .order('sort_order')
  const categories = (catRows || []).map((c: any) => ({ key: String(c.key), title: String(c.title) }))
  const categoryKeys = new Set(categories.map((c) => c.key))

  const prompt =
    `Read this list and pull out every distinct MILESTONE (a step someone takes) ` +
    `and RESOURCE (a service, place, app, book, person or organisation).\n\n` +
    `For each item return:\n` +
    `  kind: "milestone" or "resource"\n` +
    `  name: short, as written\n` +
    `  description: one sentence, ONLY if the text actually says more. Otherwise null.\n` +
    `  categoryKey: one of [${categories.map((c) => c.key).join(', ')}] or null if genuinely unclear\n` +
    `  dimension: milestones only, one of [${DIMENSIONS.join(', ')}]\n` +
    `  resourceCategory: resources only, one of [${RESOURCE_CATEGORIES.join(', ')}]\n` +
    `  confidence: "high" if it is clearly stated, "low" if you inferred it\n\n` +
    `Rules: do not invent items that are not in the text. Do not invent details ` +
    `the text does not contain — leave description null rather than embellishing. ` +
    `Use ONLY the category values listed above.\n\n` +
    `Respond with ONLY a JSON array.\n\nLIST:\n${text}`

  let lastError: { status: number; text: string } | null = null

  for (const model of MODELS) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const raw = String(json?.choices?.[0]?.message?.content || '[]')
      const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()

      let parsed: any[]
      try {
        const p = JSON.parse(cleaned)
        parsed = Array.isArray(p) ? p : []
      } catch {
        console.error('[bulk-import/parse] unparseable model output:', cleaned.slice(0, 300))
        return NextResponse.json(
          { error: 'Could not read a list from that text.', code: 'unparseable' },
          { status: 502 }
        )
      }

      const items = parsed
        .filter((it) => it && typeof it.name === 'string' && it.name.trim())
        .slice(0, 200)
        .map((it, i) => {
          const kind = it.kind === 'resource' ? 'resource' : 'milestone'
          // Re-validate every classification. Anything the model invented
          // falls back to a safe default the user can then correct, rather
          // than being written as-is.
          const categoryKey =
            typeof it.categoryKey === 'string' && categoryKeys.has(it.categoryKey)
              ? it.categoryKey
              : null
          return {
            id: `bulk_${Date.now()}_${i}`,
            kind,
            name: String(it.name).trim().slice(0, 200),
            description:
              typeof it.description === 'string' && it.description.trim()
                ? it.description.trim().slice(0, 500)
                : null,
            categoryKey,
            dimension:
              kind === 'milestone' && DIMENSIONS.includes(it.dimension)
                ? it.dimension
                : kind === 'milestone'
                ? 'education'
                : null,
            resourceCategory:
              kind === 'resource' && RESOURCE_CATEGORIES.includes(it.resourceCategory)
                ? it.resourceCategory
                : kind === 'resource'
                ? 'other'
                : null,
            confidence: it.confidence === 'high' ? 'high' : 'low',
          }
        })

      return NextResponse.json({ items, categories, model })
    }

    const t = await res.text()
    lastError = { status: res.status, text: t }
    if (!/does not exist|not found|unknown model/i.test(t)) break
  }

  console.error('[bulk-import/parse] OpenAI error:', lastError?.status, lastError?.text?.slice(0, 300))
  let reason = ''
  try { reason = String(JSON.parse(lastError?.text || '{}')?.error?.message || '').slice(0, 200) } catch {}
  return NextResponse.json(
    { error: reason ? `Couldn't read that list: ${reason}` : "Couldn't read that list." },
    { status: 502 }
  )
}
