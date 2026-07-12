'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Eye, EyeOff, Save, Loader2, Download, Upload, RotateCcw, Trash2, AlertTriangle, Route } from 'lucide-react'
import { loadMovement, movementSummary, exportMovement, clearMovement, type RouteVisit } from '@/lib/movement'

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

  // ── Data & Progress management ──
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dataBusy, setDataBusy] = useState<null | 'backup' | 'restore' | 'reset' | 'wipe'>(null)
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const [dataErr, setDataErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'progress' | 'all'>(null)

  // ── App journey (movement order) ──
  const [movement, setMovement] = useState<RouteVisit[]>([])
  useEffect(() => {
    setMovement(loadMovement())
    const onMove = (e: Event) => setMovement(((e as CustomEvent).detail as RouteVisit[]) || loadMovement())
    window.addEventListener('autinerary:movement', onMove as EventListener)
    return () => window.removeEventListener('autinerary:movement', onMove as EventListener)
  }, [])

  // localStorage keys that mirror server-side progress.
  const PROGRESS_LS_KEYS = ['completedMilestoneIds', 'heartedGoals', 'calendarAddedTasks', 'todaysMotivation', 'pendingSavedResources']
  const PLAN_LS_KEYS = ['autinerary_profile', 'autinerary_onboarding_draft']

  const clearLocal = (keys: string[]) => {
    try { keys.forEach(k => localStorage.removeItem(k)) } catch { /* ignore */ }
  }

  const downloadBackup = async () => {
    setDataBusy('backup'); setDataMsg(null); setDataErr(null)
    try {
      const res = await fetch('/api/me/data', { cache: 'no-store', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      const blob = new Blob([JSON.stringify(json.backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `autinerary-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setDataMsg('Backup downloaded.')
    } catch (e: any) {
      setDataErr(e?.message || 'Backup failed.')
    } finally {
      setDataBusy(null)
    }
  }

  const onRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setDataBusy('restore'); setDataMsg(null); setDataErr(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const backup = parsed?.tables ? parsed : parsed?.backup
      if (!backup?.tables) throw new Error('That file doesn’t look like an Autinerary backup.')
      const res = await fetch('/api/me/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ backup }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      const total = Object.values(json.restored || {}).reduce((a: number, b: any) => a + Number(b), 0)
      setDataMsg(`Restored ${total} record${total === 1 ? '' : 's'}. Reloading…`)
      clearLocal([...PROGRESS_LS_KEYS])
      setTimeout(() => window.location.reload(), 1200)
    } catch (e: any) {
      setDataErr(e?.message || 'Restore failed.')
    } finally {
      setDataBusy(null)
    }
  }

  const doReset = async (scope: 'progress' | 'all') => {
    setConfirm(null)
    setDataBusy(scope === 'all' ? 'wipe' : 'reset'); setDataMsg(null); setDataErr(null)
    try {
      const res = await fetch('/api/me/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scope }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      clearLocal(scope === 'all' ? [...PROGRESS_LS_KEYS, ...PLAN_LS_KEYS] : PROGRESS_LS_KEYS)
      if (scope === 'all') {
        setDataMsg('Everything cleared. Starting fresh…')
        setTimeout(() => { window.location.href = '/onboarding' }, 1200)
      } else {
        setDataMsg('Progress reset. Reloading…')
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (e: any) {
      setDataErr(e?.message || 'Reset failed.')
      setDataBusy(null)
    }
  }

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

        <button
          onClick={() => router.push('/profile/accessibility')}
          className="mb-4 ml-2 inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          Accessibility →
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

        {/* ── Data & Progress ── */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-6 mt-6">
          <h2 className="text-xl font-bold mb-1">Data &amp; Progress</h2>
          <p className="text-slate-600 mb-5 text-sm">
            Back up your data before testing, restore it later, or start over with a clean slate.
          </p>

          {dataMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{dataMsg}</div>
          )}
          {dataErr && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{dataErr}</div>
          )}

          {/* Backup + Restore */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <button
              onClick={downloadBackup}
              disabled={dataBusy !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {dataBusy === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Back up my data
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={dataBusy !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-semibold disabled:opacity-50"
            >
              {dataBusy === 'restore' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Restore from backup
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={onRestoreFile} className="hidden" />
          </div>

          {/* Danger zone */}
          <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50/40">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-bold text-red-700 text-sm">Danger zone</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">Reset progress</div>
                  <p className="text-xs text-slate-600">Clears completed steps, hearts, calendar tasks, stats and your AI portrait. Keeps your account and your generated plan.</p>
                </div>
                <button
                  onClick={() => setConfirm('progress')}
                  disabled={dataBusy !== null}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-white border-2 border-amber-400 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50 disabled:opacity-50"
                >
                  {dataBusy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reset
                </button>
              </div>
              <div className="flex items-start justify-between gap-3 pt-3 border-t border-red-100">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">Full restart</div>
                  <p className="text-xs text-slate-600">Deletes all progress <strong>and</strong> your generated plan, then sends you back through onboarding. Your login stays.</p>
                </div>
                <button
                  onClick={() => setConfirm('all')}
                  disabled={dataBusy !== null}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {dataBusy === 'wipe' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Restart
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── App Journey (movement order) ── */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-6 mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Route className="w-5 h-5 text-cyan-600" />
            <h2 className="text-xl font-bold">App Journey</h2>
          </div>
          <p className="text-slate-600 mb-4 text-sm">
            The order you moved through the app this session. This helps us understand how people
            navigate — you can export it to share as feedback.
          </p>

          {movement.length === 0 ? (
            <p className="text-sm text-slate-500">No screens recorded yet. Move around the app and it&apos;ll show here.</p>
          ) : (
            <>
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                {movement.map((v, i) => (
                  <span key={i}>
                    <span className="font-medium text-slate-900">{v.label}</span>
                    {i < movement.length - 1 && <span className="text-slate-400"> → </span>}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500 mb-4">{movement.length} screen views recorded.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportMovement}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold"
                >
                  <Download className="w-4 h-4" /> Export journey
                </button>
                <button
                  onClick={() => { clearMovement(); setMovement([]) }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold"
                >
                  <Trash2 className="w-4 h-4" /> Clear
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-5 h-5 ${confirm === 'all' ? 'text-red-500' : 'text-amber-500'}`} />
              <h3 className="text-lg font-bold text-slate-900">{confirm === 'all' ? 'Full restart?' : 'Reset progress?'}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              {confirm === 'all'
                ? 'This permanently deletes your progress and your generated plan, then restarts onboarding. This can’t be undone — back up first if you want to restore later.'
                : 'This permanently clears your progress (steps, hearts, calendar, stats, portrait) but keeps your plan. This can’t be undone — back up first if you want to restore later.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2 bg-white border-2 border-slate-300 text-slate-800 rounded-lg font-semibold hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => doReset(confirm)}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold ${confirm === 'all' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {confirm === 'all' ? 'Delete everything' : 'Reset progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
