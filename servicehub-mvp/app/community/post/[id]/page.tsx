'use client'

import RelationshipBadge from '@/components/community/RelationshipBadge'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Lock,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Quote,
  ChefHat,
  Cookie,
  ExternalLink,
  Boxes,
  PenLine,
} from 'lucide-react'
import ChefAvatar from '@/components/community/ChefAvatar'
import WellDoneRating from '@/components/community/WellDoneRating'
import BiteTracker from '@/components/community/BiteTracker'
import TreatToast, { type Treat } from '@/components/community/TreatToast'
import RulesDialog, { useCommunityRules } from '@/components/community/RulesDialog'
import { playBite, playWellDone } from '@/lib/community/treats'
import type { CommunityPostDetail, CommunityAnswerNode } from '@/types/community'
import VoteButton from '@/components/community/VoteButton'
import Markdown from '@/components/community/Markdown'
import SolvedBanner from '@/components/community/SolvedBanner'
import QuickLinks from '@/components/community/QuickLinks'
import BadgeList from '@/components/community/BadgeList'
import HelpfulPoints from '@/components/community/HelpfulPoints'
import ThreadedAnswer from '@/components/community/ThreadedAnswer'
import AnswerComposer from '@/components/community/AnswerComposer'
import AcceptSolutionModal from '@/components/community/AcceptSolutionModal'
import ReportButton from '@/components/community/ReportButton'
import SponsoredCard from '@/components/search/SponsoredCard'
import { feedbackMailto } from '@/lib/feedback'
import ListenButton from '@/components/layout/ListenButton'
import KeepButton from '@/components/myResources/KeepButton'
import { useMyProfile } from '@/lib/useMyProfile'
import { contentNoteLabel } from '@/lib/community/contentNotes'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { lengthOf } from '@/lib/community/tidbits'

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams?.get('from') ?? ''
  const context = searchParams?.get('context') ?? ''
  const contextQuery = (() => {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (context) query.set('context', context)
    const built = query.toString()
    return built ? `?${built}` : ''
  })()
  // Odosa's "Comment on": the passage a reader highlighted in the post
  // body, carried into the composer below.
  const [quotedText, setQuotedText] = useState<string | null>(null)
  // Who is reading, for "Save to My Resources".
  const { profile: me } = useMyProfile()
  const bodyRef = useRef<HTMLDivElement>(null)
  // A post with a content note opens only when the reader chooses (Riipen
  // Labs, Group 15: "content warnings"; lib/community/contentNotes.ts).
  const [revealed, setRevealed] = useState(false)

  /** Pull the reader's current selection, but only if it actually lies inside
   *  the post body — otherwise selecting text in a reply, or in the nav,
   *  would quote the wrong thing entirely. */
  const captureSelection = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    const text = sel?.toString().trim() ?? ''
    if (!text || !bodyRef.current || !sel?.anchorNode) {
      setQuotedText(null)
      return
    }
    if (!bodyRef.current.contains(sel.anchorNode)) {
      setQuotedText(null)
      return
    }
    // The DB caps this at 1000; trim here so the user sees what will be saved.
    setQuotedText(text.slice(0, 1000))
    document.getElementById('answer-composer-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const [post, setPost] = useState<CommunityPostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptTarget, setAcceptTarget] = useState<CommunityAnswerNode | null>(null)
  const [lockBusy, setLockBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Bites and Well-Dones (the Tidbits round, Goal 3): the pop-up and the sound.
  const [treat, setTreat] = useState<Treat | null>(null)
  const rules = useCommunityRules()
  const [rulesOpen, setRulesOpen] = useState(false)
  const onBite = useCallback((first: boolean) => {
    if (!first) return
    playBite()
    setTreat({ kind: 'bite', key: Date.now() })
    setPost((p) => (p ? { ...p, viewer_bitten: true, bite_count: (p.bite_count ?? 0) + 1 } : p))
  }, [])

  const reload = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/community/posts/${params.id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Load failed (${res.status})`)
      }
      const data = await res.json()
      setPost(data.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    reload()
  }, [reload])

  const onAccept = async (key_insight: string, tldr: string) => {
    if (!acceptTarget || !post) return
    const res = await fetch(`/api/community/posts/${post.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer_id: acceptTarget.id, key_insight, tldr }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      throw new Error(j?.error || `Accept failed (${res.status})`)
    }
    setAcceptTarget(null)
    await reload()
  }

  const toggleLock = async () => {
    if (!post || lockBusy) return
    setLockBusy(true)
    try {
      await fetch(`/api/community/posts/${post.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: !post.is_locked }),
      })
      await reload()
    } finally {
      setLockBusy(false)
    }
  }

  const deletePost = async () => {
    if (!post || deleteBusy) return
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
    } catch {
      // A failed delete used to show nothing at all (Riipen Labs, Group 34).
      setDeleteError('This post could not be deleted. Please try again.')
      setDeleteBusy(false)
      return
    }
    router.push('/community')
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-gray-500 text-sm">Loading post…</div>
    )
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-rose-600 text-sm">{error}</div>
    )
  }
  if (!post) return null

  return (
    /* Chrome so this is not a dead end (Odosa) — every community page needs a
       way back to ResourceHub, not just the feed. */
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Tidbits', href: '/community' },
          { label: 'Post', href: '/community/post' },
        ]}
      />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href={`/community${contextQuery}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tidbits
      </Link>

      {post.is_solved && post.solved_key_insight && post.solved_tldr && (
        <SolvedBanner keyInsight={post.solved_key_insight} tldr={post.solved_tldr} />
      )}

      {post.status === 'draft' && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-gray-900">
          This is a draft: only you can see it.{' '}
          <Link href={`/community/write?id=${post.id}`} className="font-medium underline underline-offset-2">Keep writing, or publish it</Link>
        </p>
      )}

      <article className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {post.kind === 'tidbit' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-950">
              <ChefHat className="w-3 h-3" aria-hidden="true" /> {lengthOf(post.length_type).label} · {post.word_count} words
            </span>
          )}
          {post.group && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">{post.group.name}</span>}
          {post.source === 'external' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-950">
              <ExternalLink className="w-3 h-3" aria-hidden="true" /> A review of an article
            </span>
          )}
          {post.is_solved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-600 text-white">
              <CheckCircle2 className="w-3 h-3" />
              Solved
            </span>
          )}
          {post.is_locked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-gray-200 text-gray-700">
              <Lock className="w-3 h-3" />
              Locked
            </span>
          )}
          {post.barrier_tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              #{t}
            </span>
          ))}
          {post.category_tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {t}
            </span>
          ))}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <ChefAvatar author={post.author} />
          {post.author.team || (post.author.anonymous && !post.viewer_can_edit) ? (
            <span className="font-medium text-gray-900">
              {post.author.pseudonym}
              {post.author.team && <span className="ml-1 text-xs font-normal text-gray-700">(the Autinerary team)</span>}
            </span>
          ) : (
            <Link
              href={`/community/profile/${post.author.user_id}${contextQuery}`}
              className="font-medium text-blue-700 underline underline-offset-2"
            >
              {post.author.pseudonym}
            </Link>
          )}
          {post.author.anonymous && post.viewer_can_edit && <span className="text-xs text-gray-700">(published anonymously: others see &ldquo;Anonymous&rdquo;)</span>}
          {!post.author.team && !post.author.anonymous && (
            <>
              <RelationshipBadge relationship={post.author_relationship} />
              <HelpfulPoints karma={post.author.karma} />
              <BadgeList badges={post.author.top_badges} max={3} />
            </>
          )}
          {post.viewer_can_edit && post.kind === 'tidbit' && (
            <Link href={`/community/write?id=${post.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 underline underline-offset-2">
              <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> Edit
            </Link>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {post.kind === 'tidbit' ? (post.published_at ? `published ${new Date(post.published_at).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'not published yet') : `asked ${new Date(post.created_at).toLocaleString()}`}
          </span>
        </div>
        {/* Keep a published Tidbit in My Resources, as a Post (STEP 86). */}
        {post.kind === 'tidbit' && post.published_at && me && (
          <div>
            <KeepButton kind="post" id={post.id} signedIn={me.signedIn} />
          </div>
        )}
        {post.source === 'external' && post.external_url && (
          <p className="flex flex-wrap gap-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
            <a href={post.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-800 underline underline-offset-2">
              Read the article here <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            {post.external_platform_url && (
              <a href={post.external_platform_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-800 underline underline-offset-2">
                See more from {post.external_platform || 'its site'} here <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </p>
        )}
        <div className="flex gap-4 items-start pt-2">
          {/* viewer_can_edit is set only for the post's author. */}
          {post.kind !== 'tidbit' && (
          <VoteButton
            score={post.score}
            viewerVote={post.viewer_vote}
            targetType="post"
            targetId={post.id}
            disabled={post.is_locked}
            isOwn={post.viewer_can_edit}
          />
          )}
          <div className="flex-1 min-w-0">
            {post.content_note && !revealed ? (
              <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-4 mb-4">
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">Content note:</span> {contentNoteLabel(post.content_note)}.
                </p>
                <p className="mt-1 text-sm text-gray-700">The person who asked added this note. The post and its answers stay hidden until you choose.</p>
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="mt-3 rounded-lg border border-gray-400 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                >
                  Show the post
                </button>
              </div>
            ) : (<>
            {post.content_note && (
              <p className="mb-3 text-sm text-gray-700"><span className="font-semibold">Content note:</span> {contentNoteLabel(post.content_note)}.</p>
            )}
            {/* Unlocking moment — the author's highlighted key sentence (Odosa) */}
            {post.unlocking_moment && (
              <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 mb-4">
                <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-amber-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Unlocking moment
                </div>
                <p className="text-sm text-amber-900 font-medium italic">“{post.unlocking_moment}”</p>
              </div>
            )}
            {/* What didn't work — the author's highlighted dead ends (Odosa) */}
            {post.what_didnt_work && (
              <div className="rounded-xl border-l-4 border-rose-400 bg-rose-50 px-4 py-3 mb-4">
                <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-rose-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> What didn&apos;t work
                </div>
                <p className="text-sm text-rose-900 font-medium italic">“{post.what_didnt_work}”</p>
              </div>
            )}
            {/* Quick links, built from the post's own headings. Sits above the
                body so it works as a contents list rather than something you
                only find after scrolling past what it was meant to help you
                skip. Renders nothing on a post with fewer than two headings. */}
            <div className="mb-4">
              <QuickLinks source={post.body_markdown} />
            </div>

            {post.kind === 'tidbit' && (
              <ListenButton target="#tidbit-body" label="Listen to this Tidbit" className="mb-3" />
            )}
            <div ref={bodyRef} id="tidbit-body">
              <Markdown source={post.body_markdown} />
            </div>
            {/* Integrated Resources: what the Tidbit mentions (Goal 2). */}
            {(post.items?.length ?? 0) > 0 && (
              <section aria-labelledby="integrated-heading" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h2 id="integrated-heading" className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <Boxes className="h-5 w-5 text-emerald-800" aria-hidden="true" /> Integrated Resources
                </h2>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {post.items!.map((i) => (
                    <li key={`${i.kind}:${i.id}`}>
                      <Link href={i.href} className="block rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm hover:border-emerald-400">
                        <span className="text-xs text-gray-700">{i.kind === 'product' ? 'Product' : 'Service'}</span>
                        <span className="block font-medium text-gray-900">{i.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {post.kind === 'tidbit' && (
              <BiteTracker postId={post.id} words={post.word_count ?? 0} enabled={!!post.viewer_can_rate && !post.viewer_bitten} onBite={onBite} />
            )}
            </>)}

            {/* Odosa: a "Comment on" button beside the normal Comment action,
                so a reader can reply to one specific passage rather than the
                whole story. Enabled only once something is actually selected
                inside the body — a button that silently does nothing is
                worse than one that is visibly waiting. */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={captureSelection}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
              >
                <Quote className="w-3.5 h-3.5" /> Comment on a highlighted part
              </button>
              <span className="text-[0.6875rem] text-gray-400">
                Select any text above, then click this.
              </span>
            </div>
            {post.image_urls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.image_urls.map((u) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={u}
                    src={u}
                    alt="attachment"
                    className="max-h-72 rounded-lg border border-gray-200"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 text-xs">
          <ReportButton targetType="post" targetId={post.id} />
          {/* Customer service (Goal 8): an email to the team, labelled [Tidbits] with the post's title. */}
          <a
            href={feedbackMailto('', { kind: 'general', about: 'tidbits', item: post.title || 'A Tidbit' })}
            onClick={(e) => {
              e.currentTarget.href = feedbackMailto(window.location.href, { kind: 'general', about: 'tidbits', item: post.title || 'A Tidbit' })
            }}
            className="text-gray-600 underline underline-offset-2 hover:text-gray-900"
          >
            Feedback for the team
          </a>
          {post.viewer_can_edit && (
            <button
              type="button"
              onClick={deletePost}
              disabled={deleteBusy}
              className="text-gray-500 hover:text-rose-600 disabled:opacity-50"
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </button>
          )}
          {post.viewer_can_moderate && (
            <button
              type="button"
              onClick={toggleLock}
              disabled={lockBusy}
              className="text-gray-500 hover:text-amber-600 inline-flex items-center gap-1"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {post.is_locked ? 'Unlock' : 'Lock'}
            </button>
          )}
          <span className="ml-auto text-gray-400">
            {post.view_count} {post.view_count === 1 ? 'view' : 'views'}
          </span>
        </div>
        {deleteError && (
          <p className="text-xs text-rose-600" role="alert">
            {deleteError}
          </p>
        )}
      </article>

      {post.kind === 'tidbit' && post.status === 'published' && (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
            <span className="inline-flex items-center gap-1">
              <ChefHat className="h-4 w-4 text-amber-700" aria-hidden="true" />
              {post.well_done_count ? `${post.well_done_avg} out of 5 from ${post.well_done_count} Well-Done${post.well_done_count === 1 ? '' : 's'}` : 'No Well-Dones yet'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cookie className="h-4 w-4 text-amber-700" aria-hidden="true" /> {post.bite_count ?? 0} Bite{post.bite_count === 1 ? '' : 's'}
            </span>
          </p>
          {post.viewer_can_rate && (
            <WellDoneRating
              postId={post.id}
              initial={post.viewer_well_done ?? null}
              onDone={(d) => {
                if (d.first) {
                  playWellDone()
                  setTreat({ kind: 'well-done', rating: d.rating, key: Date.now() })
                }
                setPost((p) => (p ? { ...p, viewer_well_done: d.rating, well_done_count: d.well_done_count, well_done_avg: d.well_done_avg } : p))
              }}
            />
          )}
        </div>
      )}

      {/* A sponsored service on the Tidbit's topic, when they're on (Goal 7). */}
      {post.kind === 'tidbit' && post.status === 'published' && (
        <SponsoredCard
          placement="tidbits"
          q={[post.title, post.group?.name, ...(post.category_tags || []), ...(post.barrier_tags || [])].filter(Boolean).join(' ')}
          category={(post.category_tags || []).join(',')}
        />
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {post.answer_count} {post.kind === 'tidbit' ? (post.answer_count === 1 ? 'comment' : 'comments') : post.answer_count === 1 ? 'answer' : 'answers'}
        </h2>
        {post.content_note && !revealed ? (
          <p className="text-sm text-gray-600 mb-3">Hidden with the post, until you choose to show it.</p>
        ) : post.answers.length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">
            Be the first to share what worked for you.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {post.answers.map((a) => (
              <ThreadedAnswer
                key={a.id}
                answer={a}
                postId={post.id}
                viewerCanAccept={post.viewer_can_accept && !post.is_locked}
                onAccept={(ans) => setAcceptTarget(ans)}
                onReply={reload}
                onDeleted={reload}
              />
            ))}
          </div>
        )}
      </section>

      {!post.is_locked && post.status !== 'draft' && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900" id="answer-composer-anchor">
            {post.kind === 'tidbit' ? 'Your comment' : 'Your answer'}
          </h2>
          {rules.needed && (
            <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gray-900">
              Before your first answer or comment, please read the community rules.{' '}
              <button type="button" onClick={() => setRulesOpen(true)} className="font-medium text-blue-800 underline underline-offset-2">
                Read them
              </button>
            </p>
          )}
          <AnswerComposer
            postId={post.id}
            onSubmitted={reload}
            quotedText={quotedText}
            onClearQuote={() => setQuotedText(null)}
          />
        </section>
      )}

      <TreatToast treat={treat} />
      <RulesDialog
        open={rulesOpen}
        reason="post"
        onClose={() => setRulesOpen(false)}
        onAgree={async () => {
          const ok = await rules.accept()
          if (ok) setRulesOpen(false)
          return ok
        }}
      />
      <AcceptSolutionModal
        open={!!acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onSubmit={onAccept}
        answerExcerpt={acceptTarget?.body_markdown.slice(0, 200)}
      />
      </main>
      <Footer />
    </div>
  )
}
