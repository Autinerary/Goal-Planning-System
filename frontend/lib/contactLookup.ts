// Server only: finding a way to reach a listing that has no email or website
// (the account holder's choice, 26 October 2026). Most of ResourceHub's
// OpenStreetMap listings are a name and a map pin; Send my request needs an
// email or a website. This looks for them on the web with OpenAI's web
// search, using only the listing's name, kind and place (never anything about
// the person), and keeps them only if they check out against the site itself
// (lib/requests.ts checkFoundContact). About 1–3 cents a lookup.
//
// Stand-ins for tests: OPENAI_BASE_URL (the Responses API), NOMINATIM_URL
// (OpenStreetMap's geocoder, free, at most one request a second), and
// CONTACT_LOOKUP_ALLOW_PRIVATE=on so a stand-in site on this machine can be
// read (never in production: see publicHost).

import { checkFoundContact } from '@/lib/requests'
import { publicHost } from '@/lib/publicUrl'

const OPENAI = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
const GEOCODER = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '')
// Plain ASCII: a header can't carry a curly apostrophe (the request throws).
const AGENT = 'Autinerary/1.0 (https://autinerary.ca; finding a service contact for a person who asked)'

export interface LookupListing {
  name: string
  category: string | null
  location?: { address?: string | null; city?: string | null; province?: string | null } | null
  geo_lat?: number | null
  geo_lng?: number | null
}

/** Where it is, in words: its address, or what OpenStreetMap's geocoder says is at its map pin. */
async function whereIs(r: LookupListing): Promise<string> {
  const said = [r.location?.address, r.location?.city, r.location?.province].filter((x) => typeof x === 'string' && x.trim()).join(', ')
  if (said) return said
  if (r.geo_lat == null || r.geo_lng == null) return ''
  try {
    const res = await fetch(`${GEOCODER}/reverse?format=jsonv2&zoom=17&lat=${encodeURIComponent(String(r.geo_lat))}&lon=${encodeURIComponent(String(r.geo_lng))}`, {
      headers: { 'User-Agent': AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    })
    const j = res.ok ? await res.json() : null
    return typeof j?.display_name === 'string' ? j.display_name.slice(0, 200) : `near ${r.geo_lat}, ${r.geo_lng}`
  } catch {
    return `near ${r.geo_lat}, ${r.geo_lng}`
  }
}

/** The answer's text, from a Responses API reply (a web_search_call item, then the message). */
function answerText(j: any): string {
  if (typeof j?.output_text === 'string') return j.output_text
  return (Array.isArray(j?.output) ? j.output : [])
    .filter((o: any) => o?.type === 'message')
    .flatMap((o: any) => (Array.isArray(o.content) ? o.content : []))
    .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
    .join('\n')
}

function parseAnswer(text: string): { website: string | null; email: string | null } | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0])
    const str = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, 300) : null)
    return { website: str(j.website), email: str(j.email) }
  } catch {
    return null
  }
}

/** Ask the web: the first model and tool OpenAI takes (which small models take web search changes over time). */
async function askWeb(r: LookupListing, where: string): Promise<{ website: string | null; email: string | null } | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const input = [
    'Find the official website, and the public email address for new clients or general inquiries, of this organization:',
    `Name: ${r.name}`,
    r.category ? `Kind: ${String(r.category).replace(/_/g, ' ')}` : '',
    `Where: ${where || 'Canada'}`,
    'Use only the organization’s own website: not a directory, a map, a review site or social media. If you are not sure a site is this same organization (the same name, in the same place), give null.',
    'Answer with JSON only, like {"website": "https://…" or null, "email": "…" or null}.',
  ].filter(Boolean).join('\n')
  const models = [...new Set([process.env.OPENAI_LOOKUP_MODEL, 'gpt-4.1-mini', 'gpt-4o-mini'].filter((x): x is string => !!x))]
  for (const model of models) {
    for (const tool of ['web_search', 'web_search_preview']) {
      try {
        const res = await fetch(`${OPENAI}/v1/responses`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, tools: [{ type: tool }], input }),
          signal: AbortSignal.timeout(45000),
        })
        if (res.status === 400 || res.status === 404) {
          console.error('contact lookup: not taken:', model, tool, (await res.text().catch(() => '')).slice(0, 200))
          continue
        }
        if (!res.ok) {
          console.error('contact lookup: OpenAI', res.status)
          return null
        }
        return parseAnswer(answerText(await res.json()))
      } catch (e) {
        console.error('contact lookup:', (e as Error)?.message)
        return null
      }
    }
  }
  return null
}

/** The site's own words (its text, and its mailto addresses), to check the find against. */
async function pageOf(start: string): Promise<{ url: string; text: string } | null> {
  try {
    let url = new URL(start)
    let res: Response | null = null
    // Up to three redirects, each one checked.
    for (let hop = 0; hop < 4; hop++) {
      if (!(await publicHost(url))) return null
      res = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(10000) })
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
      if (!next) break
      url = new URL(next, url)
      res = null
    }
    if (!res || !res.ok) return null
    const html = (await res.text()).slice(0, 1_500_000)
    const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]))
    const text = html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&#8217;/g, '’').replace(/&nbsp;/g, ' ')
    return { url: url.toString(), text: `${text} ${mailtos.join(' ')}` }
  } catch {
    return null
  }
}

/**
 * Look for a listing's website and email. Only what checks out is returned:
 * nulls when nothing does (or when looking isn't set up: no OPENAI_API_KEY).
 */
export async function lookUpContact(r: LookupListing): Promise<{ website: string | null; email: string | null; asked: boolean }> {
  if (!process.env.OPENAI_API_KEY) return { website: null, email: null, asked: false }
  const where = await whereIs(r)
  const found = await askWeb(r, where)
  if (!found?.website) return { website: null, email: null, asked: true }
  const page = await pageOf(found.website)
  const checked = checkFoundContact({ name: r.name, website: page?.url || found.website, email: found.email, pageText: page?.text || null })
  return { ...checked, asked: true }
}
