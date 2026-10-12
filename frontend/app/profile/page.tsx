'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/usePreferences'
import { createClient } from '@/lib/supabase/client'
import { newPasswordError } from '@/lib/passwordRules'
import UserAvatar from '../components/UserAvatar'
import DefaultAvatar from '../components/DefaultAvatar'
import ProfileCompletion from '../components/ProfileCompletion'
import NewPasswordFields from '../components/NewPasswordFields'
import PronounsField from '../components/PronounsField'
import PhotoField from './PhotoField'
import ChangeEmail from './ChangeEmail'
import AccountControls from './AccountControls'
import { previousPage } from '@/lib/navTrail'

/**
 * Your profile (Riipen Labs, Group 34: "add common application features in
 * the most used social medias such as a profile page"). There was no
 * /profile: what friends see sat halfway down Settings, the name at the top
 * of the app could not be changed, and a password could only be changed from
 * ResourceHub, by email. Profile & Discovery moved here from Settings.
 *
 * Group 34's profile page (slide 21) added a username, pronouns, a bio and a
 * photo (STEP 64; shown once it is applied), changing your email address,
 * your phone number, and pausing or deleting your account (AccountControls,
 * STEP 65).
 */

type Profile = {
  id: string
  display_name: string | null
  email: string | null
  avatar_emoji: string
  dream: string | null
  discoverable: boolean
  // STEP 64
  username?: string | null
  pronouns?: string | null
  bio?: string | null
  avatar_url?: string | null
}

const USERNAME_RULE = /^[a-z0-9_.]{3,20}$/

const AVATAR_OPTIONS = ['👤', '🧑', '👩', '👨', '🦊', '🐯', '🦁', '🐼', '🐧', '🦉', '🐢', '🚀', '⭐️', '💫']

const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'

export default function ProfilePage() {
  const router = useRouter()
  const { user, supabaseUser } = useAuth()
  const { prefs } = usePreferences()

  // ── Profile & Discovery (what other members see) ──
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Username, pronouns, bio and photo exist once STEP 64 is applied.
  const [extended, setExtended] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => { if (!cancelled) { setProfile(data.profile); setSaved(data.profile); setExtended(Boolean(data.extended)) } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Your profile could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const usernameDraft = (profile?.username || '').trim().replace(/^@/, '').toLowerCase()
  const usernameProblem = usernameDraft && !USERNAME_RULE.test(usernameDraft)
    ? 'A username is 3 to 20 letters, numbers, dots or underscores, with no spaces.'
    : null

  const saveProfile = async () => {
    if (!profile) return
    if (usernameProblem) { setError(usernameProblem); return }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.display_name || '',
          dream: profile.dream || '',
          avatar_emoji: profile.avatar_emoji,
          discoverable: profile.discoverable,
          ...(extended ? { username: usernameDraft, pronouns: profile.pronouns || '', bio: profile.bio || '' } : {}),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setProfile(body.profile)
      setSaved(body.profile)
      setSuccess('Saved')
      setTimeout(() => setSuccess(null), 2500)
    } catch (e: any) {
      setError(e.message || 'Your profile could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Your name (the account's, shown at the top of the app and on the Path) ──
  const [name, setName] = useState('')
  const [nameState, setNameState] = useState<null | 'saving' | 'saved' | string>(null)
  useEffect(() => { setName(user?.name || '') }, [user?.name])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim().slice(0, 80)
    if (!trimmed) { setNameState('Please type a name.'); return }
    setNameState('saving')
    // Both fields: the top bar reads full_name, the Path's heading reads name.
    const { error: updateError } = await createClient().auth.updateUser({ data: { full_name: trimmed, name: trimmed } })
    setNameState(updateError ? 'Your name could not be saved. Please try again.' : 'saved')
  }

  // ── Phone (the number verified for reminders by text, ReminderFields) ──
  const [sms, setSms] = useState<null | { available: boolean; phone: string | null }>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/me/sms', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { available: false, phone: null }))
      .then((json) => { if (!cancelled) setSms({ available: Boolean(json.available), phone: json.phone || null }) })
      .catch(() => { if (!cancelled) setSms({ available: false, phone: null }) })
    return () => { cancelled = true }
  }, [])

  // ── Password ──
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordState, setPasswordState] = useState<null | 'saving' | 'saved' | string>(null)
  const signsInWithPassword = !supabaseUser || (supabaseUser.identities || []).length === 0 || (supabaseUser.identities || []).some((i: any) => i.provider === 'email')

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = newPasswordError(password, confirm)
    if (problem) { setPasswordState(problem); return }
    setPasswordState('saving')
    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) {
      const message = (updateError.message || '').toLowerCase()
      setPasswordState(
        message.includes('reauthentic')
          ? 'For your security, sign out and sign in again, then change your password here.'
          : message.includes('different from the old')
            ? 'That is your current password. Please choose a new one.'
            : 'Your password could not be changed. Please try again.'
      )
      return
    }
    setPassword('')
    setConfirm('')
    setPasswordState('saved')
  }

  // A page in the app to go back to (lib/navTrail.ts), or the Path.
  const goBack = () => {
    if (previousPage()) router.back()
    else router.replace('/path')
  }

  const shown = saved || profile

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Your profile</h1>

        {/* The optional questions setup no longer asks, all of them, open
            (Riipen Labs, Group 29: "optional cards inside user settings"). */}
        <ProfileCompletion variant="page" />

        {/* How friends see you */}
        <section aria-labelledby="seen-heading" className={card}>
          <h2 id="seen-heading" className="text-lg font-bold text-slate-900">How friends see you</h2>
          <p className="mt-1 text-sm text-slate-600">Your card in Hare World, for people you are connected to.</p>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {shown?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown.avatar_url} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="keep-colors grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-purple-50 text-4xl" aria-hidden="true">{shown?.avatar_emoji || '👤'}</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-xl font-bold text-slate-900">{shown?.display_name || user?.name || 'No display name yet'}</p>
                {(shown?.username || shown?.pronouns) && (
                  <p className="text-sm text-slate-700">{[shown.username ? `@${shown.username}` : null, shown.pronouns].filter(Boolean).join(' · ')}</p>
                )}
                {shown?.bio && <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{shown.bio}</p>}
                <p className="text-sm text-slate-700">{shown?.dream || 'No dream added yet'}</p>
                {shown && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                    {shown.discoverable ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
                    {shown.discoverable ? 'Discoverable: people can find you in search' : 'Not discoverable: people can’t find you in search'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {prefs.character ? <UserAvatar {...prefs.character} size={72} /> : <DefaultAvatar size={72} />}
              <div className="text-sm">
                <p className="font-semibold text-slate-900">Your character</p>
                <p className="text-slate-600">{prefs.character ? 'On your race track' : 'A placeholder for now, on your race track'}</p>
                <Link href="/ideal-self" className="font-medium text-indigo-800 underline underline-offset-2">
                  {prefs.character ? 'Change it' : 'Design it'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Account */}
        <section id="account" aria-labelledby="account-heading" className={card}>
          <h2 id="account-heading" className="text-lg font-bold text-slate-900">Account</h2>

          <form onSubmit={saveName} className="mt-4">
            <label htmlFor="account-name" className="block text-sm font-semibold text-slate-800 mb-1">Your name</label>
            <p id="account-name-help" className="mb-2 text-xs text-slate-600">What Autinerary calls you, for example at the top of every page and on your Path.</p>
            <div className="flex flex-wrap gap-2">
              <input
                id="account-name"
                value={name}
                maxLength={80}
                autoComplete="name"
                aria-describedby="account-name-help"
                onChange={(e) => { setName(e.target.value); setNameState(null) }}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
              />
              <button type="submit" disabled={nameState === 'saving'} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
                {nameState === 'saving' ? 'Saving…' : 'Save name'}
              </button>
            </div>
            <p role="status" className="mt-2 text-sm">
              {nameState === 'saved' && <span className="font-medium text-emerald-800">Saved</span>}
              {nameState && nameState !== 'saved' && nameState !== 'saving' && <span className="text-red-700">{nameState}</span>}
            </p>
          </form>

          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800">Email</p>
            <p className="break-all text-slate-900">{user?.email}</p>
            {signsInWithPassword ? (
              <ChangeEmail current={user?.email || ''} pending={(supabaseUser as any)?.new_email || null} />
            ) : (
              <p className="mt-1 text-xs text-slate-600">You sign in with Google, so this is your Google account’s address.</p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800">Phone number</p>
            {sms === null ? (
              <p className="text-sm text-slate-600">Checking…</p>
            ) : sms.available ? (
              <>
                <p className="text-slate-900">{sms.phone || 'None added'}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Used only for reminders by text.{' '}
                  <Link href="/profile/settings#emails" className="font-medium text-indigo-800 underline underline-offset-2">
                    {sms.phone ? 'Change or remove it in Settings' : 'Add one in Settings'}
                  </Link>
                  , under Emails.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-700">Reminders by text aren’t switched on yet, so there is no number to add.</p>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="font-semibold text-slate-900">Password</h3>
            {signsInWithPassword ? (
              <form onSubmit={savePassword} className="mt-3 space-y-3">
                <NewPasswordFields idPrefix="change-password" password={password} confirm={confirm} onPassword={(v) => { setPassword(v); setPasswordState(null) }} onConfirm={(v) => { setConfirm(v); setPasswordState(null) }} />
                <button type="submit" disabled={passwordState === 'saving'} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
                  {passwordState === 'saving' ? 'Changing…' : 'Change password'}
                </button>
                <p role="status" className="text-sm">
                  {passwordState === 'saved' && <span className="font-medium text-emerald-800">Password changed. Use the new one next time you sign in, here and in ResourceHub.</span>}
                  {passwordState && passwordState !== 'saved' && passwordState !== 'saving' && <span className="text-red-700">{passwordState}</span>}
                </p>
              </form>
            ) : (
              <p className="mt-2 text-sm text-slate-700">You sign in with Google, so there is no Autinerary password to change.</p>
            )}
          </div>
        </section>

        {/* Profile & Discovery (moved from Settings) */}
        <section id="discovery" aria-labelledby="discovery-heading" className={card}>
          <h2 id="discovery-heading" className="text-lg font-bold text-slate-900">Profile &amp; Discovery</h2>
          <p className="mb-6 mt-1 text-sm text-slate-600">
            What other Hare World members see about you, and whether they can find you in search.
          </p>

          {loading && (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
            </div>
          )}

          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {profile && !loading && (
            <div className="space-y-6">
              <div>
                <label htmlFor="profile-display-name" className="block text-sm font-semibold text-slate-800 mb-1">Display name</label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={profile.display_name || ''}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="What other people see"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-purple-500 focus:outline-none"
                  maxLength={80}
                />
              </div>

              {extended && (
                <>
                  <div>
                    <label htmlFor="profile-username" className="block text-sm font-semibold text-slate-800 mb-1">Username</label>
                    <p id="profile-username-help" className="mb-2 text-xs text-slate-600">
                      Optional. People can find you by it. 3 to 20 letters, numbers, dots or underscores.
                    </p>
                    <div className="flex items-center rounded-lg border border-slate-200 focus-within:border-purple-500">
                      <span className="pl-3 text-slate-600" aria-hidden="true">@</span>
                      <input
                        id="profile-username"
                        type="text"
                        value={profile.username || ''}
                        onChange={(e) => { setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/\s/g, '') }); setError(null) }}
                        autoCapitalize="none"
                        autoComplete="username"
                        spellCheck={false}
                        maxLength={21}
                        aria-describedby="profile-username-help profile-username-problem"
                        aria-invalid={Boolean(usernameProblem)}
                        className="w-full rounded-lg px-1 py-2 focus:outline-none"
                      />
                    </div>
                    <p id="profile-username-problem" className="mt-1 text-xs text-red-700">{usernameProblem || ''}</p>
                  </div>

                  <PronounsField idPrefix="profile-pronouns" value={profile.pronouns || ''} onChange={(pronouns) => setProfile({ ...profile, pronouns })} />

                  <div>
                    <label htmlFor="profile-bio" className="block text-sm font-semibold text-slate-800 mb-1">About you</label>
                    <textarea
                      id="profile-bio"
                      value={profile.bio || ''}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="A few words for the people you connect with"
                      rows={3}
                      maxLength={500}
                      aria-describedby="profile-bio-help"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-purple-500 focus:outline-none"
                    />
                    <p id="profile-bio-help" className="mt-1 text-xs text-slate-600">Optional. Shown on your card. {(profile.bio || '').length}/500</p>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="profile-dream" className="block text-sm font-semibold text-slate-800 mb-1">Your dream / current goal</label>
                <textarea
                  id="profile-dream"
                  value={profile.dream || ''}
                  onChange={(e) => setProfile({ ...profile, dream: e.target.value })}
                  placeholder="e.g. Build a neurodivergent-friendly workspace"
                  rows={2}
                  maxLength={280}
                  aria-describedby="profile-dream-help"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-purple-500 focus:outline-none"
                />
                <p id="profile-dream-help" className="mt-1 text-xs text-slate-600">Shown on your card to friends and on the matching screen.</p>
              </div>

              {extended && profile.id && (
                <PhotoField
                  userId={profile.id}
                  url={profile.avatar_url || null}
                  emoji={profile.avatar_emoji}
                  onSaved={(row) => {
                    setProfile((p) => (p ? { ...p, avatar_url: row?.avatar_url ?? null } : p))
                    setSaved((p) => (p ? { ...p, avatar_url: row?.avatar_url ?? null } : p))
                  }}
                />
              )}

              <div role="group" aria-labelledby="profile-avatar-label">
                <p id="profile-avatar-label" className="mb-2 block text-sm font-semibold text-slate-800">{profile.avatar_url ? 'Picture, if you remove your photo' : 'Picture'}</p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-pressed={profile.avatar_emoji === emoji}
                      onClick={() => setProfile({ ...profile, avatar_emoji: emoji })}
                      className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 text-2xl transition-all ${
                        profile.avatar_emoji === emoji ? 'scale-110 border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {profile.discoverable ? <Eye className="h-4 w-4 text-emerald-700" aria-hidden="true" /> : <EyeOff className="h-4 w-4 text-slate-600" aria-hidden="true" />}
                      <span id="discoverable-label" className="font-semibold text-slate-900">Discoverable</span>
                    </div>
                    <p id="discoverable-help" className="text-xs text-slate-600">
                      When on, other signed-in people can find you by searching your name{extended ? ', your username' : ''} or your whole email
                      address, and send you a request. Your email address is never shown to them. When off, nobody can find you in search.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={profile.discoverable}
                    aria-labelledby="discoverable-label"
                    aria-describedby="discoverable-help"
                    onClick={() => setProfile({ ...profile, discoverable: !profile.discoverable })}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${profile.discoverable ? 'bg-emerald-600' : 'bg-slate-400'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${profile.discoverable ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 pt-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  Save
                </button>
                <span role="status" className="text-sm font-medium text-emerald-800">{success ? `✓ ${success}` : ''}</span>
              </div>
            </div>
          )}
        </section>

        <AccountControls
          onDiscoverable={(discoverable) => {
            setProfile((p) => (p ? { ...p, discoverable } : p))
            setSaved((p) => (p ? { ...p, discoverable } : p))
          }}
        />

        {/* Everything else about you lives elsewhere; say where */}
        <section aria-labelledby="more-heading" className={card}>
          <h2 id="more-heading" className="text-lg font-bold text-slate-900">More</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {[
              { href: '/hare-world', title: 'Your people', body: 'Friends, mentors and role models, in Hare World' },
              { href: '/about-me', title: 'About me', body: 'You, in your own words. Only you see it, and the assistant if you say so' },
              { href: '/ideal-self', title: 'Your Dream Self', body: 'Your character, and your Dream Self’s goals' },
              { href: '/profile/settings', title: 'Settings', body: 'How the app looks, language, reminders and emails, back-ups' },
              { href: '/profile/accessibility', title: 'Accessibility', body: 'Text size, contrast, motion and reading aloud' },
              { href: '/profile/diagnostic', title: 'Condition & Support Profile', body: 'Optional, private: so plans can fit how you work' },
              { href: '/privacy#choices', title: 'Your information', body: 'See, correct or delete it, or close your account' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <span>
                    <span className="block font-medium text-slate-900">{item.title}</span>
                    <span className="block text-sm text-slate-600">{item.body}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
