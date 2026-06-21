'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Eye, EyeOff, Save, Loader2 } from 'lucide-react'

type Profile = {
  id: string
  display_name: string | null
  email: string | null
  avatar_emoji: string
  dream: string | null
  discoverable: boolean
}

const AVATAR_OPTIONS = ['👤', '🧑', '👩', '👨', '🦊', '🐯', '🦁', '🐼', '🐧', '🦉', '🐢', '🚀', '⭐️', '💫']

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/profile', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => { if (!cancelled) setProfile(data.profile) })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load profile') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    if (!profile) return
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
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setProfile(body.profile)
      setSuccess('Saved!')
      setTimeout(() => setSuccess(null), 2500)
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-6">
          <h1 className="text-2xl font-bold mb-1">Profile & Discovery</h1>
          <p className="text-slate-600 mb-6 text-sm">
            Control what other Hare World members see about you, and whether they can find you in search.
          </p>

          {loading && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {profile && !loading && (
            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Display name</label>
                <input
                  type="text"
                  value={profile.display_name || ''}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="What other people see"
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                  maxLength={80}
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  disabled
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Email is fixed by your account. Other users can search by it if you make your profile discoverable.</p>
              </div>

              {/* Dream / Current Goal */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Your dream / current goal</label>
                <textarea
                  value={profile.dream || ''}
                  onChange={(e) => setProfile({ ...profile, dream: e.target.value })}
                  placeholder="e.g. Build a neurodivergent-friendly workspace"
                  rows={2}
                  maxLength={280}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">Shown on your card to friends and on the matching screen.</p>
              </div>

              {/* Avatar */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setProfile({ ...profile, avatar_emoji: emoji })}
                      className={`w-10 h-10 text-2xl flex items-center justify-center rounded-lg border-2 transition-all ${
                        profile.avatar_emoji === emoji
                          ? 'border-purple-500 bg-purple-50 scale-110'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discoverable toggle */}
              <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {profile.discoverable
                        ? <Eye className="w-4 h-4 text-emerald-600" />
                        : <EyeOff className="w-4 h-4 text-slate-500" />}
                      <span className="font-semibold text-slate-900">Discoverable</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      When ON, other signed-in users can find you by name or email and send you a friend request.
                      When OFF, only people who already have your direct link can see your profile.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={profile.discoverable}
                    onClick={() => setProfile({ ...profile, discoverable: !profile.discoverable })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      profile.discoverable ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        profile.discoverable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                {success && <span className="text-sm font-medium text-emerald-700">✓ {success}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
