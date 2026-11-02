'use client'

/**
 * My agents: agents a person builds to look at their plan their way (lib/agents.ts). Kept in this browser; each runs on
 * their device with their own model, or on our cloud model, as they choose; each sees only what they allow. They can
 * talk with one, have it look at their plan, or ask it about a step (app/components/AskMyAgents.tsx).
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Agent, STARTERS, agentFile, agentFromFile, agentFromStarter, lensWords, loadAgents, personData, saveAgents, withAgent } from '@/lib/agents'
import { useAgentPath } from '../context/AgentPathContext'
import AgentForm from './AgentForm'
import { AgentPlanReview, AgentTalk } from './AgentTalk'

type Open = { id: string; panel: 'talk' | 'plan' } | null

export default function AgentsPage() {
  const { payload, pathPlanning } = useAgentPath()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const data = personData(payload, pathPlanning)

  useEffect(() => {
    setAgents(loadAgents())
    setLoaded(true)
  }, [])

  const keep = (next: Agent[]) => {
    setAgents(next)
    saveAgents(next)
  }

  const save = (agent: Agent) => {
    keep(withAgent(agents, agent))
    setEditing(null)
    setNotice(`Saved ${agent.name}.`)
  }

  const remove = (agent: Agent) => {
    if (!window.confirm(`Remove ${agent.name} from this browser? If you haven't saved it as a file, it's gone.`)) return
    keep(agents.filter((a) => a.id !== agent.id))
    if (open?.id === agent.id) setOpen(null)
    setNotice(`Removed ${agent.name}.`)
  }

  const download = (agent: Agent) => {
    const url = URL.createObjectURL(new Blob([agentFile(agent)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'}.agent.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const openFile = async (file: File | null) => {
    if (!file) return
    const made = agentFromFile(await file.text())
    if ('error' in made) return setNotice(made.error)
    setEditing(made)
    setNotice(`Opened ${made.name}. Check it, then save it.`)
  }

  // A new agent: empty, seeing nothing, on the device. It gets its id when it's saved (cleanAgent).
  const blank = () => setEditing({ id: '', name: '', purpose: '', instructions: '', lens: [], sees: [], runsOn: 'device', createdAt: '', updatedAt: '', from: null })

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">My agents</h1>
        <p className="text-slate-600">
          Build agents that look at your plan your way: what they look out for, how they talk to you, and what they can see.
          They’re kept in this browser. Each runs on your device with your own small open model, or on our cloud model, as
          you choose.
        </p>
      </header>

      {notice && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}

      {editing ? (
        <AgentForm key={editing.id || 'new'} agent={editing} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={blank} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Build an agent</button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Open an agent file</button>
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Agent file"
            onChange={(e) => { openFile(e.target.files?.[0] || null); e.target.value = '' }} />
        </div>
      )}

      {loaded && agents.length > 0 && (
        <section aria-labelledby="mine-heading" className="space-y-4">
          <h2 id="mine-heading" className="text-lg font-semibold text-slate-900">Your agents</h2>
          <ul className="space-y-4">
            {agents.map((agent) => (
              <li key={agent.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">{agent.name}</h3>
                  {agent.purpose && <p className="text-sm text-slate-700">{agent.purpose}</p>}
                  <p className="text-xs text-slate-500">
                    {agent.runsOn === 'cloud' ? 'Runs on our cloud model' : 'Runs on your device'}
                    {agent.lens.length > 0 && ` · looks through: ${lensWords(agent.lens)}`}
                    {agent.from?.kind === 'starter' && ` · started from Autinerary’s “${agent.from.name}”`}
                    {agent.from?.kind === 'file' && ' · opened from a file'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button type="button" aria-expanded={open?.id === agent.id && open.panel === 'talk'}
                    onClick={() => setOpen(open?.id === agent.id && open.panel === 'talk' ? null : { id: agent.id, panel: 'talk' })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">Talk</button>
                  <button type="button" aria-expanded={open?.id === agent.id && open.panel === 'plan'}
                    onClick={() => setOpen(open?.id === agent.id && open.panel === 'plan' ? null : { id: agent.id, panel: 'plan' })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">Look at my plan</button>
                  <button type="button" onClick={() => setEditing(agent)} className="rounded-lg px-3 py-1.5 text-slate-700 underline">Change</button>
                  <button type="button" onClick={() => download(agent)} className="rounded-lg px-3 py-1.5 text-slate-700 underline">Save as a file</button>
                  <button type="button" onClick={() => remove(agent)} className="rounded-lg px-3 py-1.5 text-red-700 underline">Remove</button>
                </div>
                {open?.id === agent.id && open.panel === 'talk' && <AgentTalk agent={agent} data={data} />}
                {open?.id === agent.id && open.panel === 'plan' && <AgentPlanReview agent={agent} data={data} />}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">
            You can also ask your agents about one step, on that step’s page. <Link href="/milestones" className="underline">Your steps</Link>
          </p>
        </section>
      )}

      {!editing && (
        <section aria-labelledby="starters-heading" className="space-y-3">
          <h2 id="starters-heading" className="text-lg font-semibold text-slate-900">Start from one of ours</h2>
          <p className="text-sm text-slate-600">Starters written by the Autinerary team. Change anything before you save it.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="font-medium text-slate-900">{s.name}</p>
                <p className="text-sm text-slate-700">{s.purpose}</p>
                <button type="button" onClick={() => setEditing(agentFromStarter(s))} className="text-sm text-cyan-700 underline">Start from this</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Agents write with AI, from your instructions. They can be wrong, and they are not medical or clinical advice.
        Sharing agents with others: <span className="text-slate-600">coming soon</span>.
      </p>
    </main>
  )
}
