#!/usr/bin/env node
/**
 * Autinerary's own Learning pages as Tidbits (the team's notes, October 2026:
 * "Add some Tidbits, with the author as Autinerary ... taken right from our
 * own Learning info (https://www.autinerary.ca/learning/general-service-info).
 * Each individual page should be a separate Tidbit. Add the disclaimer at
 * the top. Add the quick links that link to each section in the page").
 *
 * Reads scripts/data/learning/<slug>.json: each page as the website shows it,
 * every dropdown opened (read 19 October 2026 with a browser, since the site
 * builds its pages in the browser): {slug, title, section, url, blocks: [{tag,
 * text, bold, links}]}.
 *
 * Each page becomes one Tidbit with the Autinerary byline, in the Parents
 * group: the page's own disclaimer first, then a line saying where it comes
 * from, then its sections as headings (so Tidbits shows its Quick Links), its
 * resource links, what it was adapted from and its references. The site's
 * own jump links and its survey button are left out. They are 'guide'
 * length (STEP 86: up to 3000 words, only for the team).
 *
 *   node scripts/import-learning-guides.mjs                  # check, and write previews to .qa-local/learning-preview/
 *   node scripts/import-learning-guides.mjs --apply [--author <user id>] [--draft]
 *
 * --apply publishes them (or saves drafts with --draft). Safe to re-run: a
 * team post with the same title is updated with the page's current text,
 * not added twice. The author is the account the team's posts belong to
 * (they show as "Autinerary" either way): --author, or the one the team's
 * existing posts use, or the first person in admin_users.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'scripts/data/learning')
const PREVIEW = path.join(ROOT, '.qa-local/learning-preview')
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const DRAFT = args.includes('--draft')
const authorAt = args.indexOf('--author')
const AUTHOR = authorAt >= 0 ? args[authorAt + 1] : null
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GUIDE_WORDS = 3000
const GROUP = 'parents'
// The order the website's menu gives them.
const ORDER = ['intro-to-autism', 'deep-dive-into-autism', 'signs-and-characteristics', 'assessment-and-diagnosis', 'general-service-info']
const TITLES = {
  'intro-to-autism': 'Intro to Autism: new to autism? Start here',
  'deep-dive-into-autism': 'A Deep Dive into Autism',
  'signs-and-characteristics': 'Signs & Characteristics of Autism',
  'assessment-and-diagnosis': 'Autism Assessment & Diagnosis',
  'general-service-info': 'Accessing Autism Services: providers and types of therapy',
}

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
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}

/** Plain text as Markdown: stray asterisks out (the renderer would read them as italics), bare addresses as links. */
function inline(text) {
  return text
    .replace(/​/g, '')
    .replace(/\*/g, '')
    .replace(/https?:\/\/[^\s)\]]+/g, (u) => {
      const trail = u.match(/[.,;:]+$/)?.[0] || ''
      const url = trail ? u.slice(0, -trail.length) : u
      return `[${host(url)}](${url})${trail}`
    })
    .trim()
}

/** "SERVICE PROVIDERS" → "Service providers"; mixed case stays as written. */
function sentenceCase(text) {
  if (text !== text.toUpperCase() || !/[A-Z]/.test(text)) return text
  const lower = text.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const headingText = (t) => sentenceCase(t.replace(/\s+/g, ' ').trim()).replace(/[!:]$/, '').trim()

export function toMarkdown(page) {
  const blocks = page.blocks.filter((b) => (b.text || '').replace(/​/g, '').trim())
  const out = []
  const own = page.url.replace(/\/$/, '')
  let i = 0

  // The hero: "Are you / NEW TO AUTISM? / If so, this is a good place to start".
  const hero = []
  while (i < blocks.length && (blocks[i].tag === 'H4' || (blocks[i].tag === 'H2' && hero.length === 1))) {
    hero.push(blocks[i].tag === 'H2' ? blocks[i].text.toLowerCase() : blocks[i].text)
    i++
  }
  // The page's own disclaimer, first.
  const disclaimer = blocks.find((b) => /^DISCLAIMER:/i.test(b.text))
  if (disclaimer) out.push(`> **Disclaimer:** ${inline(disclaimer.text.replace(/^DISCLAIMER:\s*/i, ''))}`)
  out.push(`*From Autinerary's Learning pages (${page.section}): [${page.title}](${page.url}).*`)
  if (hero.length) {
    const [a, b, c] = hero
    const line = [a && b ? `${a} ${b}` : a || b, c].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    out.push(/[.!?]$/.test(line) ? line : `${line}.`)
  }

  let list = false
  const endList = () => {
    if (list) list = false
  }
  // The website's sections are a kicker and a big title ("You should know..."
  // + "The Prevalence of Autism"); the headings inside one are its items
  // ("Name Responding", "1. Take Proactive Steps"), one level down.
  let inSection = false
  const BACK_MATTER = /^(this page (was )?(referenced|adapted)|references)/i
  for (; i < blocks.length; i++) {
    const b = blocks[i]
    const text = b.text.replace(/​/g, '').trim()
    const next = blocks[i + 1]
    if (b === disclaimer) continue
    // The site's own jump links, its "(Quick Links)" title and its survey button.
    if (b.tag === 'A' && (b.links[0]?.href || '').startsWith(`${own}#`)) continue
    if (b.tag === 'A' && /support our research/i.test(text)) continue
    if (/^\(?quick links\)?$/i.test(text)) continue

    if (b.tag === 'H1' || b.tag === 'H2') {
      endList()
      // A kicker ("Question 1:", "You should know...") before the real heading.
      if (next && (next.tag === 'H1' || next.tag === 'H2')) {
        const kicker = text
        const title = next.text.replace(/​/g, '').trim()
        i++
        if (/^study up!?$/i.test(title)) out.push(`## ${headingText(kicker)}`)
        else if (/^question \d+:?$/i.test(kicker)) out.push(`## ${kicker.replace(/:?$/, ':')} ${headingText(title)}`)
        else out.push(`## ${headingText(title)}`)
        inSection = true
        continue
      }
      if (BACK_MATTER.test(text)) {
        out.push(`## ${headingText(text)}`)
        inSection = false
        continue
      }
      if (b.tag === 'H2' && inSection) {
        out.push(`### ${headingText(text)}`)
        continue
      }
      out.push(`## ${headingText(text)}`)
      inSection = true
      continue
    }
    if (b.tag === 'BUTTON' || b.tag === 'H3' || b.tag === 'H4') {
      endList()
      out.push(`### ${headingText(text)}`)
      continue
    }
    if (b.tag === 'A') {
      const href = b.links[0]?.href
      if (!href) continue
      out.push(`- [${inline(text)}](${href})`)
      list = true
      continue
    }
    // Paragraphs: their own lines; "- " lines as a list.
    endList()
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      out.push(line.startsWith('- ') ? `- ${inline(line.slice(2))}` : inline(line))
    }
  }

  // Blank lines between blocks, none inside a list.
  const md = []
  for (const line of out) {
    const prev = md[md.length - 1]
    if (prev !== undefined && !(line.startsWith('- ') && prev.startsWith('- '))) md.push('')
    md.push(line)
  }
  return md.join('\n') + '\n'
}

async function main() {
  const files = ORDER.filter((s) => fs.existsSync(path.join(DIR, `${s}.json`)))
  if (!files.length) return console.log('No pages in scripts/data/learning.')
  fs.mkdirSync(PREVIEW, { recursive: true })
  const guides = []
  for (const slug of files) {
    const page = JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8'))
    const body = toMarkdown(page)
    const n = words(body)
    const title = TITLES[slug] || page.title
    fs.writeFileSync(path.join(PREVIEW, `${slug}.md`), `# ${title}\n\n${body}`)
    const heads = body.split('\n').filter((l) => /^#{2,3} /.test(l)).length
    console.log(`${n <= GUIDE_WORDS ? 'ok  ' : 'LONG'} ${title}: ${n} words, ${heads} sections (preview: .qa-local/learning-preview/${slug}.md)`)
    if (n <= GUIDE_WORDS) guides.push({ slug, title, body, page })
  }
  if (!APPLY) return console.log(`${guides.length} ready. Check only: add --apply to publish them (after STEP 86).`)

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
  if (!author) author = (await get('community_posts?select=author_id&byline=eq.autinerary&order=created_at.asc&limit=1'))[0]?.author_id
  if (!author) author = (await get('admin_users?select=user_id&order=granted_at.asc&limit=1'))[0]?.user_id
  if (!author) throw new Error('No author: pass --author <user id>')
  const group = (await get(`community_groups?select=id&slug=eq.${GROUP}`))[0]?.id
  if (!group) throw new Error(`No ${GROUP} group: apply STEP 83 first`)

  let saved = 0
  for (const g of guides) {
    const row = {
      title: g.title,
      body_markdown: g.body,
      category_tags: ['learning', 'autism', g.page.section.toLowerCase().replace(/^about /, '')].slice(0, 5),
      barrier_tags: ['autism'],
      kind: 'tidbit',
      length_type: 'guide',
      status: DRAFT ? 'draft' : 'published',
      group_id: group,
      source: 'internal',
      byline: 'autinerary',
    }
    const same = await get(`community_posts?select=id,status&byline=eq.autinerary&title=eq.${encodeURIComponent(g.title)}&limit=1`)
    const r = same.length
      ? await fetch(`${url}/rest/v1/community_posts?id=eq.${same[0].id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ body_markdown: row.body_markdown, length_type: 'guide', category_tags: row.category_tags, barrier_tags: row.barrier_tags, ...(DRAFT ? {} : { status: 'published' }) }) })
      : await fetch(`${url}/rest/v1/community_posts`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ author_id: author, ...row }) })
    if (!r.ok) {
      const t = await r.text()
      console.log(`  NOT saved: ${g.title}: ${r.status} ${t}${/length_type|guide/.test(t) ? ' (is STEP 86 applied?)' : ''}`)
      continue
    }
    const [post] = await r.json()
    saved++
    console.log(`  ${same.length ? 'updated' : DRAFT ? 'saved as a draft' : 'published'}: ${g.title} → /community/post/${post.id}`)
  }
  console.log(`${saved} of ${guides.length} saved.`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
