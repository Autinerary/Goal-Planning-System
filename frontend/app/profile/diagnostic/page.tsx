'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react'
import DiagnosticProfileSection from '../../onboarding/DiagnosticProfileSection'
import {
  CONDITION_GROUPS,
  EMPTY_DIAGNOSTIC_PROFILE,
  type DiagnosticProfile,
} from '@/lib/diagnostic-profile'

function emptyProfile(): DiagnosticProfile {
  return {
    ...EMPTY_DIAGNOSTIC_PROFILE,
    consentToStore: true,
    conditions: [],
    supportContext: { ...EMPTY_DIAGNOSTIC_PROFILE.supportContext },
  }
}

export default function DiagnosticProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<DiagnosticProfile>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/diagnostic-profile', { cache: 'no-store', credentials: 'include' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
        return body
      })
      .then((body) => {
        if (cancelled || !body?.diagnosticProfile?.profile) return
        setProfile({
          ...emptyProfile(),
          ...body.diagnosticProfile.profile,
          consentToStore: true,
          supportContext: {
            ...EMPTY_DIAGNOSTIC_PROFILE.supportContext,
            ...(body.diagnosticProfile.profile.supportContext || {}),
          },
        })
      })
      .catch((reason) => { if (!cancelled) setError(reason?.message || 'Could not load your private details.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const toggleCondition = (conditionId: string, conditionLabel: string) => {
    const selected = profile.conditions.some((condition) => condition.conditionId === conditionId)
    setProfile({
      ...profile,
      conditions: selected
        ? profile.conditions.filter((condition) => condition.conditionId !== conditionId)
        : [...profile.conditions, {
            conditionId,
            conditionLabel,
            status: 'prefer_not_to_say',
            subtypeIds: [],
            notes: '',
          }],
    })
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/me/diagnostic-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, consentToStore: true }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setMessage('Private support details saved.')
    } catch (reason: any) {
      setError(reason?.message || 'Could not save your private details.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Permanently delete all saved condition and support details?')) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/me/diagnostic-profile', {
        method: 'DELETE',
        credentials: 'include',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setProfile(emptyProfile())
      setMessage('Private support details deleted.')
    } catch (reason: any) {
      setError(reason?.message || 'Could not delete your private details.')
    } finally {
      setSaving(false)
    }
  }

  const selectedLabels = profile.conditions.map((condition) => condition.conditionLabel)

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-6 w-6 flex-none text-cyan-700" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Condition &amp; Support Profile</h1>
              <p className="mt-1 text-sm text-slate-600">
                Review or change private, self-reported details used to personalize support. This is not a diagnostic test or medical record.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading private details...
            </div>
          ) : (
            <>
              {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {message && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

              <div className="mt-6">
                <h2 className="font-semibold text-slate-900">Conditions or differences to include</h2>
                <p className="mt-1 text-sm text-slate-600">Choose only what is useful. Diagnosis status and all follow-up details are optional.</p>
                <div className="mt-4 space-y-2">
                  {CONDITION_GROUPS.map((group) => (
                    <details key={group.id} className="rounded-lg border border-slate-200">
                      <summary className="cursor-pointer px-4 py-3 font-medium text-slate-800">{group.label}</summary>
                      <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
                        {group.conditions.map((condition) => {
                          const selected = profile.conditions.some((item) => item.conditionId === condition.id)
                          return (
                            <button
                              key={condition.id}
                              type="button"
                              onClick={() => toggleCondition(condition.id, condition.label)}
                              className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${
                                selected
                                  ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                                  : 'border-slate-200 text-slate-700 hover:border-cyan-300'
                              }`}
                            >
                              {selected && <Check className="mr-1 inline h-4 w-4" />}
                              {condition.label}
                            </button>
                          )
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              <DiagnosticProfileSection
                selectedBarriers={selectedLabels}
                value={profile}
                onChange={setProfile}
                showConsent={false}
              />

              <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save private details
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-red-200 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete all details
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
