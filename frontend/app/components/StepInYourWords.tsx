'use client'

/**
 * "Put this step in your own words" on a step's page: the person rewrites a step the planner wrote, and it changes
 * everywhere in their plan (app/api/me/path/step, lib/stepEdits.ts). "Use the original" puts the planner's back.
 * Steps written this way can go into the person's own model's training set (Settings, Models, Build my training set).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MAX_STEP_DESCRIPTION, MAX_STEP_NAME } from '@/lib/stepEdits'

type Props = {
  milestoneId: string
  name: string
  description: string
  edited: boolean
  onSaved: (step: { name: string; description: string; edited: boolean }) => void
}

export default function StepInYourWords({ milestoneId, name, description, edited, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [draftDescription, setDraftDescription] = useState(description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) {
      setDraftName(name)
      setDraftDescription(description)
    }
  }, [name, description, open])

  const send = async (body: Record<string, unknown>) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/me/path/step', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, ...body }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out?.error || 'That didn’t save. Please try again.')
      onSaved({ name: out.name, description: out.description, edited: !!out.edited })
      setOpen(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {edited && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">In your words</span>}
        <button type="button" onClick={() => setOpen(true)} className="text-cyan-700 underline underline-offset-2">
          {edited ? 'Change your words' : 'Put this step in your own words'}
        </button>
        {edited && (
          <button type="button" disabled={saving} onClick={() => send({ action: 'restore' })} className="text-slate-600 underline underline-offset-2">
            Use the original
          </button>
        )}
        {saved && <span role="status" className="text-emerald-700">Saved</span>}
        {error && <span role="alert" className="text-red-700">{error}</span>}
      </div>
    )
  }

  return (
    <form
      className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        send({ name: draftName, description: draftDescription })
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-800">The step</span>
        <input
          value={draftName}
          maxLength={MAX_STEP_NAME}
          onChange={(e) => setDraftName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-800">What it means for you</span>
        <textarea
          value={draftDescription}
          maxLength={MAX_STEP_DESCRIPTION}
          rows={3}
          onChange={(e) => setDraftDescription(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
        />
      </label>
      <p className="text-xs text-slate-600">
        Your words replace the planner&apos;s everywhere in your plan, and you can go back to the original. Steps you
        write can also go into your own model&apos;s training set, if you choose them in{' '}
        <Link href="/settings/models/training-set" className="underline">Build my training set</Link>.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || draftName.trim().length < 2} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  )
}
