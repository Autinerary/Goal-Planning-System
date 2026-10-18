import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getReviewerProfiles } from '@/lib/supabase/queries'
import { markdownExcerpt } from '@/lib/community/markdown'
import { contentNoteLabel } from '@/lib/community/contentNotes'
import { INSTITUTIONS } from '@/lib/campus'
import { APP_URL } from '@/lib/appSignIn'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FoundItem {
  kind: 'review' | 'comment' | 'tidbit' | 'article' | 'campus' | 'kit'
  title: string
  excerpt: string
  href: string
  /** Who wrote it, and how they are connected (reviews and comments). */
  by?: string | null
  stars?: number
  helpful?: number
  /** Which of the top services it is about. */
  about?: string
}

// A word safe inside PostgREST's or() filter.
const safe = (w: string) => w.replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * GET /api/search/found?ids=a,b,c&words=x,y&norms=autism&q=…
 *
 * "Here's what we found!" after Enter (the team's planning note, October
 * 2026, Goal 7): besides the three services the search ranked first,
 *  - experiences and advice from the community about those three services:
 *    the reviews people found most helpful, then Tidbits that talk about them,
 *    then other reviews and comments;
 *  - general related information: Autinerary's starter kits and campus pages
 *    when they fit, articles, and Tidbits that were answered.
 * Up to three of each. Only what people may already read.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const ids = (sp.get('ids') || '').split(',').filter((id) => UUID.test(id)).slice(0, 3)
  const words = (sp.get('words') || '').split(',').map(safe).filter((w) => w.length >= 3).slice(0, 6)
  const norms = (sp.get('norms') || '').split(',').map((n) => n.trim().toLowerCase()).filter((n) => /^[a-z_]{2,40}$/.test(n)).slice(0, 4)
  const q = safe(sp.get('q') || '').toLowerCase()
  const supabase = createClient()

  // The three services' names.
  const { data: services } = ids.length ? await supabase.from('resources').select('id, name').in('id', ids) : { data: [] as { id: string; name: string }[] }
  const nameOf = new Map((services || []).map((s) => [s.id, s.name]))

  // Experiences and advice about them.
  const experiences: (FoundItem & { rank: number })[] = []
  if (ids.length) {
    const { data: reviews } = await supabase
      .from('ratings')
      .select('id, resource_id, user_id, overall_score, comment, helpful_count, created_at')
      .in('resource_id', ids)
      .not('comment', 'is', null)
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(9)
    const people = await getReviewerProfiles((reviews || []).map((r) => r.user_id))
    for (const r of reviews || []) {
      const text = String(r.comment || '').trim()
      if (text.length < 10) continue
      const who = people.get(r.user_id)
      experiences.push({
        kind: 'review',
        title: nameOf.get(r.resource_id) || 'A service',
        excerpt: text.length > 220 ? `${text.slice(0, 217)}…` : text,
        href: `/resources/${r.resource_id}#reviews`,
        by: who ? [who.full_name || 'A member', who.role].filter(Boolean).join(' · ') : null,
        stars: r.overall_score,
        helpful: r.helpful_count || 0,
        about: nameOf.get(r.resource_id),
        // The most helpful reviews first, then Tidbits, then the rest.
        rank: (r.helpful_count || 0) > 0 ? 1000 + (r.helpful_count || 0) : 100,
      })
    }
    for (const s of services || []) {
      const name = safe(s.name)
      if (name.length < 3 || name.length > 40) continue
      const { data: posts } = await supabase
        .from('community_posts')
        .select('id, title, body_markdown, solved_tldr, score, content_note')
        .eq('is_deleted', false)
        .or(`title.ilike.%${name}%,body_markdown.ilike.%${name}%`)
        .order('score', { ascending: false })
        .limit(2)
      for (const p of posts || []) {
        const note = contentNoteLabel((p as any).content_note)
        experiences.push({
          kind: 'tidbit',
          title: p.title,
          excerpt: note ? `Content note: ${note}` : p.solved_tldr || markdownExcerpt(p.body_markdown || '', 200),
          href: `/community/${p.id}`,
          about: s.name,
          rank: 500 + (p.score || 0),
        })
      }
    }
    const { data: comments } = await supabase
      .from('resource_comments')
      .select('id, resource_id, body, created_at')
      .in('resource_id', ids)
      .order('created_at', { ascending: false })
      .limit(3)
    for (const c of comments || []) {
      experiences.push({
        kind: 'comment',
        title: nameOf.get(c.resource_id) || 'A service',
        excerpt: c.body.length > 220 ? `${c.body.slice(0, 217)}…` : c.body,
        href: `/resources/${c.resource_id}#comments-heading`,
        about: nameOf.get(c.resource_id),
        rank: 50,
      })
    }
  }

  // General related information.
  const info: (FoundItem & { rank: number })[] = []
  const all = `${q} ${words.join(' ')}`
  if (/assess|diagnos/.test(all)) {
    info.push({ kind: 'kit', title: 'Getting an autism assessment in Ontario', excerpt: "Autinerary's starter kit: the steps, who to call, and what to bring.", href: `${APP_URL}/kits/assessment`, rank: 900 })
  }
  if (/school|iep|iprc|classroom|teacher/.test(all)) {
    info.push({ kind: 'kit', title: 'Getting support at school', excerpt: "Autinerary's starter kit: IEPs, IPRCs, and how to ask for support.", href: `${APP_URL}/kits/school`, rank: 890 })
  }
  const campus = INSTITUTIONS.find((i) => all.includes(i.name.toLowerCase()) || all.includes(i.slug.replace(/-/g, ' ')))
  if (campus) {
    info.push({ kind: 'campus', title: campus.name, excerpt: 'Services near each of its campuses: accessibility, health, quiet places and more.', href: `/campus/${campus.slug}`, rank: 880 })
  } else if (/college|universit|campus|accessib/.test(all)) {
    info.push({ kind: 'campus', title: 'Near a college or university', excerpt: 'Services near Ontario’s colleges and universities, campus by campus.', href: '/campus', rank: 700 })
  }
  if (words.length) {
    const or = words.flatMap((w) => [`name.ilike.%${w}%`, `description.ilike.%${w}%`]).join(',')
    const { data: articles } = await supabase
      .from('resources')
      .select('id, name, description')
      .eq('status', 'approved')
      .ilike('category', 'commentary')
      .or(or)
      .limit(3)
    for (const a of articles || []) {
      info.push({ kind: 'article', title: a.name, excerpt: String(a.description || '').slice(0, 200), href: `/resources/${a.id}`, rank: 600 })
    }
    let posts = supabase
      .from('community_posts')
      .select('id, title, body_markdown, solved_tldr, solved_key_insight, score, content_note, accepted_answer_id')
      .eq('is_deleted', false)
      .not('accepted_answer_id', 'is', null)
    posts = norms.length ? posts.overlaps('barrier_tags', norms) : posts.or(words.flatMap((w) => [`title.ilike.%${w}%`, `body_markdown.ilike.%${w}%`]).join(','))
    const { data: answered } = await posts.order('score', { ascending: false }).limit(3)
    for (const p of answered || []) {
      const note = contentNoteLabel((p as any).content_note)
      info.push({
        kind: 'tidbit',
        title: p.title,
        excerpt: note ? `Content note: ${note}` : p.solved_key_insight || p.solved_tldr || markdownExcerpt(p.body_markdown || '', 200),
        href: `/community/${p.id}`,
        rank: 400 + (p.score || 0),
      })
    }
  }

  const top = (list: (FoundItem & { rank: number })[]) => {
    const seen = new Set<string>()
    return list
      .sort((a, b) => b.rank - a.rank)
      .filter((x) => (seen.has(x.href) ? false : (seen.add(x.href), true)))
      .slice(0, 3)
      .map(({ rank: _rank, ...item }) => item)
  }
  return NextResponse.json({ experiences: top(experiences), info: top(info) })
}
