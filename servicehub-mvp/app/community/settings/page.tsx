'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, RefreshCw } from 'lucide-react'
import type { CommunityProfileRow } from '@/types/community'
import { validatePseudonym } from '@/lib/community/pseudonym'
import ImageUploader from '@/components/community/ImageUploader'
import ChefAvatar from '@/components/community/ChefAvatar'

interface MeResponse {
  profile: CommunityProfileRow | null
  user_id?: string
  is_admin?: boolean
}

// Paths, Tasks and Calendar switches are hidden: no profile shows that data
// (app/api/community/profiles/[id] returns none), so they did nothing
// (Riipen Labs, Group 34). The columns and the PATCH route still take them.
// These two only list yours on your profile page; the posts and answers
// themselves stay in Tidbits either way, which the hints now say.
const TOGGLES: Array<{
  key: keyof Pick<CommunityProfileRow, 'show_posts' | 'show_answers'>
  label: string
  hint: string
}> = [
  { key: 'show_posts', label: 'Posts', hint: 'Show the questions you have asked on your profile page.' },
  { key: 'show_answers', label: 'Answers', hint: 'Show the answers you have written on your profile page.' },
]

export default function CommunitySettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [optingIn, setOptingIn] = useState(false)
  const [draft, setDraft] = useState<Partial<CommunityProfileRow>>({})
  const [saveOk, setSaveOk] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/community/profiles/me')
      const data = (await res.json()) as MeResponse
      setMe(data)
      setDraft(data.profile ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const optIn = async () => {
    setOptingIn(true)
    setError(null)
    try {
      const res = await fetch('/api/community/profiles/me', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || 'Opt-in failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to opt in')
    } finally {
      setOptingIn(false)
    }
  }

  const save = async () => {
    if (!me?.user_id) return
    setSaveOk(false)
    if (draft.pseudonym) {
      const err = validatePseudonym(draft.pseudonym)
      if (err) {
        setError(err)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/community/profiles/${me.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || 'Save failed')
      }
      await load()
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="max-w-3xl mx-auto px-4 py-10 text-gray-500">Loading…</div>

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-rose-600">
        Could not load. <Link className="underline" href="/community">Back to Tidbits</Link>.
      </div>
    )
  }

  // Not opted in yet.
  if (!me.profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Link
          href="/community"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tidbits
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Join Tidbits</h1>
          {/* This promised "opt out anytime", but nothing removes a community
              profile. The Public profile switch on this page is the control
              that exists, so that is what it now says (Riipen Labs, Group 34). */}
          <p className="text-sm text-gray-700">
            Tidbits is the ResourceHub community. You&apos;ll post under a generated pseudonym,
            and your real name is never shown. You can change your pseudonym, choose what your
            profile shows, and turn your public profile off at any time on this page.
          </p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={optIn}
            disabled={optingIn}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {optingIn ? 'Creating your profile…' : 'Opt in & get my pseudonym'}
          </button>
        </div>
      </div>
    )
  }

  // Edit form.
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tidbits
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Community settings</h1>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Identity</h2>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Pseudonym</label>
          <input
            type="text"
            value={draft.pseudonym ?? ''}
            onChange={(e) => setDraft({ ...draft, pseudonym: e.target.value })}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={32}
          />
          <p className="text-xs text-gray-500 mt-1">3-32 chars. Letters, numbers, _ or -.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Bio</label>
          <textarea
            value={draft.bio ?? ''}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            maxLength={1000}
            placeholder="A few words about what you're working on (optional)."
          />
        </div>
        {/* A picture to upload, not a web address to type (the Tidbits round:
            "Editing Profile"); every profile wears the chef's hat. */}
        <div>
          <p className="block text-sm font-medium text-gray-900 mb-1">Your picture (optional)</p>
          <div className="flex items-start gap-4">
            <div className="pt-3">
              <ChefAvatar author={{ pseudonym: draft.pseudonym ?? '', avatar_url: draft.avatar_url ?? null }} size="lg" />
            </div>
            <div className="flex-1">
              <ImageUploader
                urls={draft.avatar_url ? [draft.avatar_url] : []}
                onChange={(urls) => setDraft({ ...draft, avatar_url: urls[0] ?? null })}
                max={1}
              />
              <p className="mt-1 text-xs text-gray-700">Without one, your first letter shows, wearing the chef&apos;s hat every Tidbits profile has. Not a photo of anyone else, please.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Profile visibility</h2>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={draft.is_public ?? true}
            onChange={(e) => setDraft({ ...draft, is_public: e.target.checked })}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">Public profile</span>
            {/* resolveVisibility lets admins past a private profile, and the
                feed shows posts and answers whatever this is set to. */}
            <span className="block text-xs text-gray-500">
              When off, only you and moderators can see your profile page, and the choices below
              are ignored. Your posts and answers still appear in Tidbits under your pseudonym.
            </span>
          </span>
        </label>
        <div className="divide-y divide-gray-100">
          {TOGGLES.map((t) => (
            <label key={t.key} className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={(draft[t.key] ?? me.profile![t.key]) as boolean}
                onChange={(e) => setDraft({ ...draft, [t.key]: e.target.checked })}
                className="mt-1"
                disabled={!(draft.is_public ?? me.profile!.is_public)}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{t.label}</span>
                <span className="block text-xs text-gray-500">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {saveOk && (
        <p className="text-sm text-emerald-700 flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Saved.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
