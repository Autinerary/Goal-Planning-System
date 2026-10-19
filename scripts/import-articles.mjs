#!/usr/bin/env node
/**
 * Articles by the Autinerary team, as Tidbit drafts (the Tidbits round's
 * planning note, Goal 10: "Populate the Tidbits with articles whose author is
 * Autinerary"; the 5Qs report's article series). Each was written from
 * official pages, and every fact has a quote from its source
 * (.qa-local/articles/BRIEF.md and check_articles.py).
 *
 * Reads scripts/data/articles/<file>.json:
 *   {"checked", "articles": [{slug, title, length_type, group, tags, summary,
 *    body_markdown, claims, sources, integrated, notes}]}
 *
 * Saves each as a draft Tidbit with the byline "Autinerary" (STEP 83), in its
 * group, with its sources and the ResourceHub searches it points to at the
 * end. Nothing is published: the team reads each draft (My Tidbits, as the
 * author, or the post page as an admin), checks what its notes say, and
 * publishes it. Safe to re-run: a team draft or post with the same title is
 * left alone.
 *
 *   node scripts/import-articles.mjs [file ...]                     # check only
 *   node scripts/import-articles.mjs --apply [--author <user id>] [file ...]
 *
 * The author is the account the drafts belong to (it shows as "Autinerary"
 * either way); without --author, the first person in admin_users.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'scripts/data/articles')
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const authorAt = args.indexOf('--author')
const AUTHOR = authorAt >= 0 ? args[authorAt + 1] : null
const ONLY = args.filter((a, i) => !a.startsWith('--') && (authorAt < 0 || i !== authorAt + 1))

// The same as STEP 83 and servicehub-mvp/lib/community/tidbits.ts.
const LIMITS = { tidbit: 500, tadbit: 1000 }
const GROUPS = ['autistic-adults', 'adhd', 'audhd', 'parents', 'siblings', 'teens-young-adults', 'students', 'learning-differences', 'tourette-tics', 'anxiety-ocd', 'newcomers', 'work', 'professionals-allies']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function loadEnv() {
  for (const f of ['servicehub-mvp/.env.local', 'frontend/.env.local', 'backend/.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** The body as published: the article, where ResourceHub can help (if asked), and its sources. */
function bodyOf(a, withHelp = true) {
  const help = withHelp ? (a.integrated || []).filter((i) => i.kind === 'search' && /^\/[^/]/.test(i.url)) : []
  const parts = [a.body_markdown.trim()]
  if (help.length) parts.push(`**Where ResourceHub can help**\n\n${help.map((i) => `- [${i.name}](${i.url})`).join('\n')}`)
  parts.push(`**Sources**\n\n${a.sources.map((s) => `- [${s.label}](${s.url})`).join('\n')}`)
  return parts.join('\n\n')
}

/**
 * The database counts every word at publish, sources too (STEP 83). Sources
 * always stay. Over the limit with them: first leave out the ResourceHub
 * list; still over, a Tidbit becomes a Tadbit (up to 1000).
 */
function finalize(a) {
  const full = bodyOf(a, true)
  if (words(full) <= (LIMITS[a.length_type] || 0)) return { length_type: a.length_type, body: full, note: '' }
  const lean = bodyOf(a, false)
  if (words(lean) <= (LIMITS[a.length_type] || 0)) return { length_type: a.length_type, body: lean, note: 'without the ResourceHub list' }
  if (a.length_type === 'tidbit' && words(full) <= LIMITS.tadbit) return { length_type: 'tadbit', body: full, note: 'as a Tadbit, with its sources' }
  return { length_type: a.length_type, body: full, note: '' }
}

function problems(a) {
  const out = []
  if (!a.title?.trim() || a.title.length > 200) out.push('title')
  if (!LIMITS[a.length_type]) out.push(`length_type ${a.length_type}`)
  if (!GROUPS.includes(a.group)) out.push(`group ${a.group}`)
  if (!a.sources?.length) out.push('no sources')
  const urls = new Set((a.sources || []).map((s) => s.url))
  for (const c of a.claims || []) if (!urls.has(c.source)) out.push(`a claim's source isn't in sources: ${c.source}`)
  const f = finalize(a)
  const n = words(f.body)
  if (LIMITS[f.length_type] && n > LIMITS[f.length_type]) out.push(`${n} words with its sources, over ${LIMITS[f.length_type]}`)
  return out
}

async function main() {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && (!ONLY.length || ONLY.includes(f.replace(/\.json$/, '')))) : []
  if (!files.length) return console.log('No article files in scripts/data/articles.')
  const all = []
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
    for (const a of d.articles) {
      const bad = problems(a)
      const fin = finalize(a)
      console.log(`${bad.length ? 'FIX ' : 'ok  '} ${f}: ${a.title} (${fin.length_type}, ${a.group}, ${words(fin.body)} words with sources${fin.note ? `, ${fin.note}` : ''})${bad.length ? `: ${bad.join('; ')}` : ''}`)
      if (!bad.length) all.push(a)
    }
  }
  console.log(`${all.length} articles ready`)
  if (!APPLY) return console.log('Check only: add --apply to save them as drafts (after STEP 83).')

  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (servicehub-mvp/.env.local)')
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const get = async (q) => {
    const r = await fetch(`${url}/rest/v1/${q}`, { headers: H })
    if (!r.ok) throw new Error(`${q.split('?')[0]}: ${r.status} ${await r.text()}`)
    return r.json()
  }

  let author = AUTHOR
  if (author && !UUID.test(author)) throw new Error('--author takes a user id')
  if (!author) author = (await get('admin_users?select=user_id&order=granted_at.asc&limit=1'))[0]?.user_id
  if (!author) throw new Error('No author: pass --author <user id>')
  const groups = Object.fromEntries((await get('community_groups?select=id,slug')).map((g) => [g.slug, g.id]))
  if (!Object.keys(groups).length) throw new Error('No groups: apply STEP 83 first')

  let saved = 0
  for (const a of all) {
    const same = await get(`community_posts?select=id,status&byline=eq.autinerary&title=eq.${encodeURIComponent(a.title)}&limit=1`)
    if (same.length) {
      console.log(`  already there (${same[0].status}): ${a.title}`)
      continue
    }
    const fin = finalize(a)
    const row = {
      author_id: author,
      title: a.title.trim(),
      body_markdown: fin.body,
      category_tags: (a.tags || []).map((t) => String(t).toLowerCase().slice(0, 32)).slice(0, 5),
      barrier_tags: [],
      kind: 'tidbit',
      length_type: fin.length_type,
      status: 'draft',
      group_id: groups[a.group],
      source: 'internal',
      byline: 'autinerary',
    }
    const r = await fetch(`${url}/rest/v1/community_posts`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(row) })
    if (!r.ok) {
      console.log(`  NOT saved: ${a.title}: ${r.status} ${await r.text()}`)
      continue
    }
    saved++
    console.log(`  saved as a draft: ${a.title}`)
  }
  console.log(`${saved} drafts saved. Read each one, check what its notes say, then publish it from the post page.`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
