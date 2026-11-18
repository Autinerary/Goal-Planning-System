'use client'

import Link from 'next/link'
import { useEffect, useState, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Download, Upload, RotateCcw, Trash2, AlertTriangle, Route, ShieldCheck } from 'lucide-react'
import { loadMovement, movementSummary, exportMovement, clearMovement, type RouteVisit } from '@/lib/movement'
import SettingsPreferences from '../../components/SettingsPreferences'
import HereForSetting from '../../components/HereForSetting'
import GamificationSettings from '../../components/GamificationSettings'
import { usePreferences } from '../../context/usePreferences'
import FeedbackButton from '../../components/FeedbackButton'

// The parts of a backup, in words (app/api/me/data names them by table).
const PART_NAMES: Record<string, string> = {
  race_progress: 'steps you finished and hearted',
  calendar_tasks: 'your calendar',
  life_stats_snapshots: 'your stats history',
  life_stats_checkins: 'your mood check-ins',
  ideal_self_portraits: 'your Dream Self picture',
  user_paths: 'your plan',
  user_diagnostic_profiles: 'your Condition & Support Profile',
}
const partNames = (tables: string[]) => tables.map((t) => PART_NAMES[t] || t.replace(/_/g, ' ')).join(', ')

export default function ProfileSettingsPage() {
  const router = useRouter()

  // ── Data & Progress management ──
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dataBusy, setDataBusy] = useState<null | 'backup' | 'restore' | 'reset' | 'wipe'>(null)
  const { update: updatePreferences } = usePreferences()
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const [dataErr, setDataErr] = useState<string | null>(null)
  // A restore that left parts out: the page waits, with a button to reload, so the list can be read.
  const [restoredPartly, setRestoredPartly] = useState(false)
  const [confirm, setConfirm] = useState<null | 'progress' | 'all'>(null)
  // The confirmation is a real dialog: its title and text are read out, focus starts on Cancel (the safe choice) and
  // stays inside it, Escape closes it, and focus goes back to the button that opened it.
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const askToConfirm = (scope: 'progress' | 'all') => {
    openerRef.current = document.activeElement as HTMLElement | null
    setConfirm(scope)
  }
  const closeConfirm = () => {
    setConfirm(null)
    setTimeout(() => openerRef.current?.focus(), 0)
  }
  useEffect(() => {
    if (confirm) cancelRef.current?.focus()
  }, [confirm])
  const onDialogKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeConfirm()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') || [])
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

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

  // The calendar's key is per account (calendarAddedTasks:<user id>), so the
  // bare name never matched anything; clear every variant.
  const clearLocal = (keys: string[]) => {
    try {
      keys.forEach(k => localStorage.removeItem(k))
      if (keys.includes('calendarAddedTasks')) Object.keys(localStorage).filter(k => k.startsWith('calendarAddedTasks:')).forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
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
    setDataBusy('restore'); setDataMsg(null); setDataErr(null); setRestoredPartly(false)
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
      clearLocal([...PROGRESS_LS_KEYS])
      // What couldn't be restored is said, by name, and the page waits: it
      // used to say "Restored N records" and reload, even when the plan itself
      // was left out (bug audit, 17 November 2026).
      const skipped: string[] = Array.isArray(json.skipped) ? json.skipped.filter((t: unknown): t is string => typeof t === 'string') : []
      if (skipped.length) {
        setDataMsg(`Restored ${total} record${total === 1 ? '' : 's'}.`)
        setDataErr(`These parts couldn’t be restored: ${partNames(skipped)}. Everything else is back. Reload the page to see it, and try the restore again later for the rest.`)
        setRestoredPartly(true)
      } else {
        setDataMsg(`Restored ${total} record${total === 1 ? '' : 's'}. Reloading…`)
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (e: any) {
      setDataErr(e?.message || 'Restore failed.')
    } finally {
      setDataBusy(null)
    }
  }

  const doReset = async (scope: 'progress' | 'all') => {
    closeConfirm()
    setRestoredPartly(false)
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
      // Ticks on plan tasks live with the preferences (lib/planTaskDone.ts).
      await updatePreferences({ planTaskDone: {} })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <button
          onClick={() => router.push('/profile/accessibility')}
          className="mb-4 ml-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          Accessibility →
        </button>
        <button
          onClick={() => router.push('/profile/diagnostic')}
          className="mb-4 ml-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ShieldCheck className="w-4 h-4 text-cyan-700" /> Condition &amp; Support Profile
        </button>
        <button
          onClick={() => router.push('/settings/models')}
          className="mb-4 ml-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          AI models →
        </button>
        <button
          onClick={() => router.push('/groups')}
          className="mb-4 ml-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          Groups →
        </button>
        <FeedbackButton className="mb-4 ml-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm" />

        <HereForSetting />
        <SettingsPreferences />
        <GamificationSettings />

        {/* Profile & Discovery moved to Your profile (/profile), with the
            account name and password (Riipen Labs, Group 34). */}
        <Link
          href="/profile#discovery"
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-slate-50"
        >
          <span>
            <span className="block text-xl font-bold text-slate-900">Profile &amp; Discovery</span>
            <span className="mt-1 block text-sm text-slate-600">
              Your name, picture and dream, who can find you, and your password are on Your profile.
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
        </Link>

        {/* ── Data & Progress ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
          <h2 className="text-xl font-bold mb-1">Data &amp; Progress</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Back up your data before testing, restore it later, or start over with a clean slate.
            To see, correct or delete anything else, see{' '}
            <Link href="/privacy#choices" className="font-medium text-indigo-800 underline underline-offset-2">Privacy</Link>.
          </p>

          {dataMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{dataMsg}</div>
          )}
          {dataErr && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {dataErr}
              {restoredPartly && (
                <button type="button" onClick={() => window.location.reload()} className="mt-2 block font-semibold text-red-900 underline underline-offset-2">
                  Reload the page
                </button>
              )}
            </div>
          )}

          {/* Backup + Restore */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-semibold disabled:opacity-50"
            >
              {dataBusy === 'restore' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Restore from backup
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={onRestoreFile} className="hidden" />
          </div>

          {/* Danger zone */}
          <div className="border border-red-200 rounded-xl p-4 bg-red-50/40">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-bold text-red-700 text-sm">Danger zone</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">Reset progress</div>
                  <p className="text-xs text-slate-600">Clears completed steps, hearts, calendar tasks, stats and your Dream Self picture. Keeps your account and your generated plan.</p>
                </div>
                <button
                  onClick={() => askToConfirm('progress')}
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
                  <p className="text-xs text-slate-600">Deletes all progress, your generated plan <strong>and</strong> your Condition &amp; Support Profile, then takes you back to setup. Your login stays.</p>
                </div>
                <button
                  onClick={() => askToConfirm('all')}
                  disabled={dataBusy !== null}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {dataBusy === 'wipe' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Restart
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── App Journey (movement order) ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Route className="w-5 h-5 text-cyan-600" />
            <h2 className="text-xl font-bold">App Journey</h2>
          </div>
          <p className="text-slate-600 mb-4 text-sm">
            The order you moved through the app this session. This helps us understand how people
            navigate, you can export it to share as feedback.
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold"
                >
                  <Trash2 className="w-4 h-4" /> Clear
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm modal: a real dialog (role, title, text, focus, Escape). */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overlay-scroll" onClick={closeConfirm}>
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-reset-title"
            aria-describedby="confirm-reset-text"
            onKeyDown={onDialogKey}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-5 h-5 ${confirm === 'all' ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true" />
              <h2 id="confirm-reset-title" className="text-lg font-bold text-slate-900">{confirm === 'all' ? 'Full restart?' : 'Reset progress?'}</h2>
            </div>
            <p id="confirm-reset-text" className="text-sm text-slate-600 mb-6">
              {confirm === 'all'
                ? 'This permanently deletes your progress, your generated plan and your Condition & Support Profile, then takes you back to setup. This can’t be undone. Back up first if you want to restore later.'
                : 'This permanently clears your progress (steps, hearts, calendar, stats, portrait) but keeps your plan. This can’t be undone. Back up first if you want to restore later.'}
            </p>
            <div className="flex gap-3">
              <button ref={cancelRef} type="button" onClick={closeConfirm} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-800 rounded-lg font-semibold hover:bg-slate-50">Cancel</button>
              <button
                type="button"
                onClick={() => doReset(confirm)}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold ${confirm === 'all' ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'}`}
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
