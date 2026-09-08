'use client'

/**
 * Model picker — the harness control surface.
 *
 * One default model and thinking effort for everything, plus an optional
 * per-agent override so a user can put a stronger model on path planning and a
 * cheap fast one on scheduling.
 *
 * Models the server has no credentials for are listed but disabled, so a
 * missing option reads as a deployment fact rather than a bug.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Catalogue,
  DEFAULT_PREFS,
  Effort,
  ModelPrefs,
  Usage,
  fetchCatalogue,
  fetchUsage,
  loadModelPrefs,
  saveModelPrefs,
} from '@/lib/modelPrefs'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ModelSettingsPage() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [prefs, setPrefs] = useState<ModelPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPrefs(loadModelPrefs())
    ;(async () => {
      const { data } = await createClient().auth.getSession()
      setUsage(await fetchUsage(API_URL, data.session?.access_token))
    })().catch(() => {})
    fetchCatalogue(API_URL)
      .then(setCatalogue)
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback((next: ModelPrefs) => {
    setPrefs(next)
    saveModelPrefs(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }, [])

  const available = (catalogue?.models || []).filter((m) => m.available)

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-slate-500">Loading models…</p>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <Link href="/profile/settings" className="text-sm text-slate-500 hover:text-slate-800">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Models</h1>
        <p className="text-sm text-slate-600">
          Choose which model runs your plan and how much thinking it does. You can give
          individual agents their own model — for example a stronger one for planning and a
          faster one for scheduling.
        </p>
      </header>

      {!catalogue && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Couldn&apos;t reach the server to load the model list. Your existing choice is kept.
        </div>
      )}

      {catalogue && !catalogue.any_available && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No model is configured on the server yet, so the agents are running on their
          built-in rules. Add a provider key on the server to enable model selection.
        </div>
      )}

      {catalogue && (
        <>
          {usage && (
            <section className="rounded-xl border-2 border-slate-200 p-4 space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Today&apos;s usage</h2>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-cyan-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (usage.tokens_today / Math.max(1, usage.tokens_per_day_limit)) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-sm text-slate-600">
                {usage.tokens_today.toLocaleString()} of{' '}
                {usage.tokens_per_day_limit.toLocaleString()} tokens used. Higher thinking
                effort and larger models use this up faster.
              </p>
              <p className="text-xs text-slate-500">
                {usage.cost_tracking && usage.usd_today !== null
                  ? `Estimated spend today: $${usage.usd_today.toFixed(2)}`
                  : 'Cost in dollars isn\u2019t tracked on this server, so only token usage is shown.'}
              </p>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Default model</h2>
            <div className="grid gap-2">
              <label className="flex items-start gap-3 rounded-xl border-2 border-slate-200 p-3 cursor-pointer hover:border-slate-300">
                <input
                  type="radio"
                  name="default-model"
                  className="mt-1"
                  checked={!prefs.model}
                  onChange={() => update({ ...prefs, model: undefined })}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    Server default
                    {catalogue.default_model ? ` (${catalogue.default_model})` : ''}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Let the server pick. Uses the local fine-tune when it is running.
                  </span>
                </span>
              </label>

              {catalogue.models.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3 ${
                    m.available
                      ? 'border-slate-200 cursor-pointer hover:border-slate-300'
                      : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <input
                    type="radio"
                    name="default-model"
                    className="mt-1"
                    disabled={!m.available}
                    checked={prefs.model === m.id}
                    onChange={() => update({ ...prefs, model: m.id })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      {m.label}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {m.provider_label}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500">{m.description}</span>
                    {!m.available && (
                      <span className="block text-xs text-amber-700 mt-1">
                        Not configured on this server.
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Thinking effort</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {catalogue.efforts.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => update({ ...prefs, effort: e.id })}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    prefs.effort === e.id
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-sm font-medium text-slate-900">{e.label}</span>
                  <span className="block text-xs text-slate-500">{e.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Per-agent overrides</h2>
            <p className="text-sm text-slate-600">
              Leave an agent on “Use default” unless you want it handled differently.
            </p>
            <div className="space-y-2">
              {catalogue.agents.map((a) => {
                const choice = prefs.agents[a.id] || {}
                const setChoice = (next: { model?: string; effort?: Effort }) =>
                  update({ ...prefs, agents: { ...prefs.agents, [a.id]: { ...choice, ...next } } })

                return (
                  <div
                    key={a.id}
                    className="rounded-xl border-2 border-slate-200 p-3 flex flex-wrap items-center gap-3"
                  >
                    <span className="text-sm font-medium text-slate-900 flex-1 min-w-[10rem]">
                      {a.label}
                    </span>

                    <select
                      value={choice.model || ''}
                      onChange={(e) => setChoice({ model: e.target.value || undefined })}
                      className="rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm"
                      aria-label={`Model for ${a.label}`}
                    >
                      <option value="">Use default</option>
                      {available.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={choice.effort || ''}
                      onChange={(e) =>
                        setChoice({ effort: (e.target.value || undefined) as Effort | undefined })
                      }
                      className="rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm"
                      aria-label={`Thinking effort for ${a.label}`}
                    >
                      <option value="">Default effort</option>
                      {catalogue.efforts.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update(DEFAULT_PREFS)}
              className="rounded-lg border-2 border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Reset to defaults
            </button>
            {saved && <span className="text-sm text-emerald-700">Saved</span>}
          </div>
        </>
      )}
    </main>
  )
}
