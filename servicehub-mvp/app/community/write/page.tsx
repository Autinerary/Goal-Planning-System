'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChefHat, EyeOff, Lightbulb, Link2, Save, Send } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import Markdown from '@/components/community/Markdown'
import ItemPicker, { type PickedItem } from '@/components/community/ItemPicker'
import RulesDialog, { useCommunityRules } from '@/components/community/RulesDialog'
import { CONTENT_NOTES } from '@/lib/community/contentNotes'
import { LENGTHS, platformOf, wordCount, type LengthType } from '@/lib/community/tidbits'

interface Group {
  slug: string
  name: string
  description: string | null
  member_count: number
  joined: boolean
}

/**
 * Write a Tidbit (the Tidbits round's planning note, Goals 2, 4 and 5): a
 * Tidbit (500 words) or a Tadbit (1000), told the "short and sweet" rule
 * before starting, with a word count and a pop-up past the limit; in one of
 * your groups; your own experience or a review of an article elsewhere; the
 * services and products it mentions; anonymous if you like; saved as a draft
 * or published. ?id= edits one of yours.
 */
function WriteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params?.get('id') || null
  const rules = useCommunityRules()
  const [rulesOpen, setRulesOpen] = useState(false)

  const [loaded, setLoaded] = useState(!editId)
  const [id, setId] = useState<string | null>(editId)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [lengthType, setLengthType] = useState<LengthType>('tidbit')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  // The key sentence (the team's notes, October 2026: "add an option when
  // writing a Tidbit to highlight the key sentence"; Tidbits' Solutions).
  const [keySentence, setKeySentence] = useState('')
  const [keyHint, setKeyHint] = useState('')
  const bodyBox = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(true)
  const [group, setGroup] = useState('')
  const [source, setSource] = useState<'internal' | 'external'>('internal')
  const [externalUrl, setExternalUrl] = useState('')
  const [items, setItems] = useState<PickedItem[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [contentNote, setContentNote] = useState('')
  const [busy, setBusy] = useState<'' | 'draft' | 'publish'>('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [overLimit, setOverLimit] = useState(false)
  const warnedAt = useRef<number | null>(null)

  const limit = LENGTHS[lengthType].words
  const words = wordCount(body)
  const platform = useMemo(() => (source === 'external' ? platformOf(externalUrl) : null), [source, externalUrl])

  // The groups, yours first.
  useEffect(() => {
    fetch('/api/community/groups', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setGroupsOpen(d.open !== false)
        const list = ((d.groups as Group[]) ?? []).sort((a, b) => Number(b.joined) - Number(a.joined))
        setGroups(list)
        setGroup((g) => g || list.find((x) => x.joined)?.slug || '')
      })
      .catch(() => setGroups([]))
  }, [])

  // Editing one of yours.
  useEffect(() => {
    if (!editId) return
    fetch(`/api/community/posts/${editId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const p = d.post
        if (!p) return setError(d.error || 'That Tidbit wasn’t found.')
        if (!p.viewer_can_edit || p.kind !== 'tidbit') return setError('You can only edit your own Tidbits here.')
        // The team's guides are longer than a Tadbit, and kept up to date from their Learning pages.
        if (p.length_type === 'guide') return setError('This is one of the team’s guides: it’s updated from the Learning page it comes from.')
        setTitle(p.title || '')
        setBody(p.body_markdown || '')
        setKeySentence(p.unlocking_moment || '')
        setLengthType(p.length_type === 'tadbit' ? 'tadbit' : 'tidbit')
        setStatus(p.status === 'published' ? 'published' : 'draft')
        setGroup(p.group?.slug || '')
        setSource(p.source === 'external' ? 'external' : 'internal')
        setExternalUrl(p.external_url || '')
        setAnonymous(!!p.is_anonymous)
        setContentNote(p.content_note || '')
        setItems(((p.items as any[]) ?? []).map((i) => ({ kind: i.kind, id: i.id, name: i.name })))
      })
      .catch(() => setError('That Tidbit couldn’t be loaded.'))
      .finally(() => setLoaded(true))
  }, [editId])

  // The first time, the community rules.
  useEffect(() => {
    if (rules.needed) setRulesOpen(true)
  }, [rules.needed])

  // "Keep it short & sweet!": once each time the words go past the limit.
  useEffect(() => {
    if (words > limit && warnedAt.current !== limit) {
      warnedAt.current = limit
      setOverLimit(true)
    }
    if (words <= limit) warnedAt.current = null
  }, [words, limit])

  const save = async (publish: boolean) => {
    if (busy) return
    setError('')
    setSaved('')
    if (publish && words > limit) return setOverLimit(true)
    if (rules.needed) return setRulesOpen(true)
    setBusy(publish ? 'publish' : 'draft')
    try {
      // Choosing a group you aren't in joins it.
      const chosen = groups?.find((g) => g.slug === group)
      if (publish && chosen && !chosen.joined) {
        const j = await fetch('/api/community/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ slug: group, join: true }) })
        if (!j.ok) throw new Error((await j.json().catch(() => null))?.error || 'Couldn’t join that group.')
        setGroups((list) => list?.map((g) => (g.slug === group ? { ...g, joined: true, member_count: g.member_count + 1 } : g)) ?? null)
      }
      const payload = {
        kind: 'tidbit',
        status: publish ? 'published' : 'draft',
        length_type: lengthType,
        title: title.trim(),
        body_markdown: body.trim(),
        group: group || undefined,
        source,
        external_url: source === 'external' ? externalUrl.trim() : undefined,
        items: items.map((i) => ({ kind: i.kind, id: i.id })),
        is_anonymous: anonymous,
        content_note: contentNote || null,
        unlocking_moment: keySentence.trim() || null,
      }
      const res = await fetch(id ? `/api/community/posts/${id}` : '/api/community/posts', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        if (d?.code === 'rules') setRulesOpen(true)
        if (d?.code === 'too_long') setOverLimit(true)
        throw new Error(d?.error || 'That didn’t save. Please try again.')
      }
      const newId = d?.id || id
      if (publish) return router.push(`/community/post/${newId}`)
      setId(newId)
      setStatus('draft')
      setSaved(d?.bleeped ? 'Saved as a draft. A swear word was bleeped (community rule 3).' : 'Saved as a draft. Only you can see it, in My Tidbits.')
      if (!editId && newId) router.replace(`/community/write?id=${newId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save.')
    } finally {
      setBusy('')
    }
  }

  const blockers: string[] = []
  if (title.trim().length < 8) blockers.push('a title of at least 8 characters')
  if (body.trim().length < 20) blockers.push('a little more in the Tidbit')
  if (!group) blockers.push('a group')
  if (source === 'external' && !/^https:\/\//.test(externalUrl.trim())) blockers.push('the link to the article (https://…)')
  if (words > limit) blockers.push(`under ${limit} words`)

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Tidbits', href: '/community' }, { label: id ? 'Edit a Tidbit' : 'Write a Tidbit', href: '/community/write' }]} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <Link href="/community" className="inline-flex items-center gap-1 text-sm text-gray-800 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Tidbits
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <ChefHat className="h-7 w-7 text-amber-700" aria-hidden="true" /> {id ? (status === 'published' ? 'Edit your Tidbit' : 'Your draft') : 'Write a Tidbit'}
          </h1>
          {/* Goal 5: "Let the users know before they start creating their post about the character limit, with a 'Short & Sweet' rule". */}
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-gray-900">
            <span className="font-semibold">The short and sweet rule:</span> one idea, what you tried and what worked, in a Tidbit (up to 500 words) or a
            Tadbit (up to 1000). Readers come for the useful part.{' '}
            <Link href="/community/guidelines" className="font-medium text-blue-800 underline underline-offset-2">
              Community guidelines
            </Link>
          </p>
        </div>

        {!groupsOpen ? (
          <p className="rounded-xl border border-gray-300 bg-white p-4 text-gray-900">Tidbits open soon. Until then, you can ask the community a question.</p>
        ) : !loaded ? (
          <p className="text-sm text-gray-700">Loading…</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save(true)
            }}
            className="space-y-6"
          >
            <fieldset>
              <legend className="text-sm font-semibold text-gray-900">How long</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(Object.keys(LENGTHS) as LengthType[]).map((k) => (
                  <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${lengthType === k ? 'border-amber-600 bg-amber-50' : 'border-gray-300 bg-white'}`}>
                    <input type="radio" name="length" value={k} checked={lengthType === k} onChange={() => setLengthType(k)} className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="font-semibold text-gray-900">{LENGTHS[k].label}</span>
                      <span className="block text-gray-800">{LENGTHS[k].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-semibold text-gray-900">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={250} className={`mt-1 ${input}`} placeholder="What it's about, in a few words" />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="tidbit-body" className="text-sm font-semibold text-gray-900">
                  Your {LENGTHS[lengthType].label}
                </label>
                <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs font-medium text-blue-800 underline underline-offset-2">
                  {preview ? 'Edit' : 'Preview'}
                </button>
              </div>
              {preview ? (
                <div className="mt-1 rounded-xl border border-gray-200 bg-white p-3">
                  <Markdown source={body || '*Nothing to preview yet*'} />
                </div>
              ) : (
                <textarea
                  id="tidbit-body"
                  ref={bodyBox}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  maxLength={30000}
                  aria-describedby="tidbit-words"
                  placeholder="What you tried, what worked, and what you'd tell someone starting out. Markdown works (## for a heading, - for a list)."
                  className={`mt-1 ${input}`}
                />
              )}
              <p id="tidbit-words" className={`mt-1 text-right text-xs ${words > limit ? 'font-semibold text-red-800' : 'text-gray-700'}`} aria-live="polite">
                {words} of {limit} words
              </p>
            </div>

            {/* The key sentence: shown highlighted at the top of the Tidbit,
                and under Solutions in Tidbits. */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <label htmlFor="key-sentence" className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <Lightbulb className="h-4 w-4 text-amber-700" aria-hidden="true" /> Key sentence (optional)
              </label>
              <p id="key-sentence-hint" className="mt-0.5 text-xs text-gray-800">
                The one sentence that helped most. It&apos;s highlighted at the top of your Tidbit, and your Tidbit shows under
                Solutions.
              </p>
              <textarea
                id="key-sentence"
                value={keySentence}
                onChange={(e) => setKeySentence(e.target.value.slice(0, 280))}
                rows={2}
                maxLength={280}
                aria-describedby="key-sentence-hint"
                placeholder="What finally worked was…"
                className={`mt-2 ${input}`}
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={preview}
                  onClick={() => {
                    const el = bodyBox.current
                    const picked = el ? el.value.slice(el.selectionStart, el.selectionEnd).trim() : ''
                    if (!picked) return setKeyHint('Select a sentence in your Tidbit above first, then press this.')
                    setKeySentence(picked.replace(/\s+/g, ' ').slice(0, 280))
                    setKeyHint('')
                  }}
                  className="text-xs font-semibold text-blue-800 underline underline-offset-2 disabled:opacity-60"
                >
                  Use the sentence I selected above
                </button>
                <span className="text-xs text-gray-700">{keySentence.length} / 280</span>
              </div>
              {keyHint && (
                <p role="status" className="mt-1 text-xs text-gray-900">
                  {keyHint}
                </p>
              )}
            </div>

            <label className="block text-sm font-semibold text-gray-900">
              Group
              <select value={group} onChange={(e) => setGroup(e.target.value)} className={`mt-1 ${input} bg-white`}>
                <option value="">Choose a group</option>
                {(groups ?? []).map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                    {g.joined ? '' : ' (you’ll join it)'}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-gray-700">
                Tidbits are written in a group you&apos;re in. <Link href="/community/groups" className="underline underline-offset-2">All groups</Link>
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-gray-900">Where it comes from</legend>
              <div className="mt-2 space-y-2 text-sm text-gray-900">
                <label className="flex items-start gap-2">
                  <input type="radio" name="source" checked={source === 'internal'} onChange={() => setSource('internal')} className="mt-0.5 h-4 w-4" />
                  My own experience
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="source" checked={source === 'external'} onChange={() => setSource('external')} className="mt-0.5 h-4 w-4" />
                  A review of an article somewhere else
                </label>
              </div>
              {source === 'external' && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-900">
                    The article&apos;s link
                    <span className="relative mt-1 block">
                      <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden="true" />
                      <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://" className={`${input} pl-9`} />
                    </span>
                  </label>
                  {platform && (
                    <p className="mt-1 text-xs text-gray-700">
                      Readers will see &ldquo;Read the article here&rdquo; and &ldquo;See more from {platform.name} here&rdquo;.
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            <div>
              <p className="text-sm font-semibold text-gray-900">Services and products you mention (optional)</p>
              <p className="mb-2 text-xs text-gray-700">They show at the end, as Integrated Resources, so readers can find them.</p>
              <ItemPicker items={items} onChange={setItems} />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-900">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <EyeOff className="h-4 w-4" aria-hidden="true" /> Publish anonymously
                </span>
                <span className="block text-gray-800">It shows as &ldquo;Anonymous&rdquo;, not your pseudonym, and isn&apos;t on your profile. Moderators can still see who wrote it.</span>
              </span>
            </label>

            <label className="block text-sm font-semibold text-gray-900">
              Content note (optional)
              <select value={contentNote} onChange={(e) => setContentNote(e.target.value)} className={`mt-1 ${input} bg-white`}>
                <option value="">No content note</option>
                {CONTENT_NOTES.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>

            {saved && (
              <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-gray-900">
                {saved}{' '}
                <Link href="/community/mine?tab=drafts" className="font-medium underline underline-offset-2">
                  My Tidbits
                </Link>
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
            )}
            {blockers.length > 0 && <p className="text-right text-sm text-gray-700">To publish it needs {blockers.join(', ')}.</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => save(false)} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60">
                <Save className="h-4 w-4" aria-hidden="true" /> {busy === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
              <button type="submit" disabled={!!busy || blockers.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                <Send className="h-4 w-4" aria-hidden="true" /> {busy === 'publish' ? 'Publishing…' : status === 'published' ? 'Save changes' : 'Publish'}
              </button>
            </div>
          </form>
        )}

        {/* Goal 5: "a pop-up with 'Keep it short & sweet! Please keep your T under [the limit]'". */}
        {overLimit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div role="alertdialog" aria-modal="true" aria-labelledby="limit-title" aria-describedby="limit-body" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 id="limit-title" className="text-xl font-bold text-gray-900">
                Keep it short and sweet!
              </h2>
              <p id="limit-body" className="mt-2 text-sm text-gray-800">
                Please keep your {LENGTHS[lengthType].label} under {limit} words. It has {words} now.
                {lengthType === 'tidbit' ? ' Need more room? Make it a Tadbit (up to 1000 words).' : ''}
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {lengthType === 'tidbit' && words <= LENGTHS.tadbit.words && (
                  <button type="button" onClick={() => { setLengthType('tadbit'); setOverLimit(false) }} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                    Make it a Tadbit
                  </button>
                )}
                <button type="button" autoFocus onClick={() => setOverLimit(false)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                  I&apos;ll shorten it
                </button>
              </div>
            </div>
          </div>
        )}
        <RulesDialog open={rulesOpen} reason="post" onClose={() => setRulesOpen(false)} onAgree={async () => { const ok = await rules.accept(); if (ok) setRulesOpen(false); return ok }} />
      </main>
      <Footer />
    </div>
  )
}

export default function WriteTidbitPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10 text-gray-700">Loading…</div>}>
      <WriteInner />
    </Suspense>
  )
}
