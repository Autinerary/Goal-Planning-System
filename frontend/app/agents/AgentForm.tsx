'use client'

/** Building or changing one of the person's agents (lib/agents.ts): every field in plain words, nothing chosen for them. */
import { useState } from 'react'
import Link from 'next/link'
import { Agent, AgentScope, LIMITS, SCOPES, cleanAgent } from '@/lib/agents'
import { COMMUNITY_TAGS } from '@/lib/sharedModels'

export default function AgentForm({ agent, onSave, onCancel, heading, note }: {
  agent: Agent; onSave: (a: Agent) => void; onCancel: () => void
  /** For an agent drafted from what someone asked for (app/agents/AgentSetup.tsx), instead of "Change …". */
  heading?: string; note?: string
}) {
  const [draft, setDraft] = useState<Agent>(agent)
  const set = (change: Partial<Agent>) => setDraft((d) => ({ ...d, ...change }))
  const toggle = <T,>(list: T[], item: T, on: boolean): T[] => (on ? [...list, item] : list.filter((x) => x !== item))
  const valid = draft.name.trim().length >= 2

  return (
    <form
      aria-labelledby="agent-form-heading"
      className="rounded-xl border border-slate-200 p-4 space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        const clean = cleanAgent(draft)
        if (clean) onSave(clean)
      }}
    >
      <h2 id="agent-form-heading" className="text-lg font-semibold text-slate-900">
        {heading || (agent.name ? `Change ${agent.name}` : 'Build an agent')}
      </h2>
      {note && <p className="text-sm text-slate-700">{note}</p>}

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-800">Name</span>
        <input value={draft.name} maxLength={LIMITS.name} onChange={(e) => set({ name: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="For example: Calm mornings" />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-800">What it’s for</span>
        <input value={draft.purpose} maxLength={LIMITS.purpose} onChange={(e) => set({ purpose: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="One sentence: what it helps you with" />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-800">How it works, in your words</span>
        <span className="block text-slate-600">
          What should it look out for? How should it talk to you? What should it never do? It follows these, but never
          above our safety rules.
        </span>
        <textarea value={draft.instructions} maxLength={LIMITS.instructions} rows={6} onChange={(e) => set({ instructions: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <span className="block text-xs text-slate-500">{draft.instructions.length} of {LIMITS.instructions} characters</span>
      </label>

      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium text-slate-800">The norms it looks through (up to {LIMITS.lens})</legend>
        <div className="flex flex-wrap gap-2">
          {COMMUNITY_TAGS.map((t) => (
            <label key={t.id} className="flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5">
              <input type="checkbox" checked={draft.lens.includes(t.id)} disabled={!draft.lens.includes(t.id) && draft.lens.length >= LIMITS.lens}
                onChange={(e) => set({ lens: toggle(draft.lens, t.id, e.target.checked) })} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium text-slate-800">What it can see</legend>
        <p className="text-slate-600">Nothing else of yours reaches it. Leave them all off and it only reads what you write to it.</p>
        {SCOPES.map((s) => (
          <label key={s.id} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={draft.sees.includes(s.id)}
              onChange={(e) => set({ sees: toggle<AgentScope>(draft.sees, s.id, e.target.checked) })} />
            <span><span className="font-medium">{s.label}</span>: {s.note}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium text-slate-800">Where it runs</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="agent-runs-on" className="mt-1" checked={draft.runsOn === 'device'} onChange={() => set({ runsOn: 'device' })} />
          <span>
            <span className="font-medium">On my device</span>, with my own small open model. Nothing it reads or writes leaves this
            device. Set it up in <Link href="/settings/models" className="underline">Use my own model</Link>.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="agent-runs-on" className="mt-1" checked={draft.runsOn === 'cloud'} onChange={() => set({ runsOn: 'cloud' })} />
          <span>
            <span className="font-medium">On our cloud model</span>. Stronger, but what it can see, and what you write to it, go
            to the AI company that runs that model.
          </span>
        </label>
      </fieldset>

      <p className="text-xs text-slate-500">Your agents are kept in this browser, not in your account. To use one on another device, save it as a file.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={!valid} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Save agent
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
      </div>
    </form>
  )
}
